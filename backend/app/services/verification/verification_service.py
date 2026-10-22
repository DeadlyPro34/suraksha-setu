"""Policy and persistence for report consistency checks."""

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.verification import Verification, VerificationResult


def derive_result(
    agent_output: dict[str, Any],
    independent_corroboration: Optional[bool] = None,
) -> VerificationResult:
    """Classify checks without treating consistency as independent proof.

    Timestamp and location checks alone cannot corroborate a report: in the
    report analysis flow, the incident is created from that report, so those
    checks can compare the report with its own values and always pass. A
    failed check is recorded as rejected on the verification row only;
    incomplete checks or consistent checks without an independent signal are
    uncertain. Verified requires both checks to pass and independent
    corroboration.
    """
    timestamp_mismatch = agent_output.get("timestamp_mismatch_flag")
    geolocation_mismatch = agent_output.get("geolocation_mismatch_flag")

    if timestamp_mismatch is True or geolocation_mismatch is True:
        return VerificationResult.rejected
    if timestamp_mismatch is None or geolocation_mismatch is None:
        return VerificationResult.uncertain
    if (
        timestamp_mismatch is False
        and geolocation_mismatch is False
        and independent_corroboration is True
    ):
        return VerificationResult.verified
    return VerificationResult.uncertain


def persist_verification(
    db: Session,
    report_id: UUID,
    agent_output: dict[str, Any],
) -> Verification:
    """Insert or update one verification row, preserving unchecked NULLs."""
    verification = (
        db.query(Verification)
        .filter(Verification.report_id == report_id)
        .one_or_none()
    )
    if verification is None:
        verification = Verification(report_id=report_id)

    verification.result = derive_result(agent_output)
    verification.credibility_score = agent_output.get("credibility_score")
    verification.timestamp_mismatch_flag = agent_output.get(
        "timestamp_mismatch_flag"
    )
    verification.geolocation_mismatch_flag = agent_output.get(
        "geolocation_mismatch_flag"
    )
    verification.image_reuse_flag = agent_output.get("image_reuse_flag")
    verification.verified_at = datetime.now(timezone.utc)
    db.add(verification)
    db.flush()
    return verification
