from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.agents.misinformation_agent import evaluate_consistency
from app.models.verification import Verification, VerificationResult
from app.services.verification.verification_service import (
    derive_result,
    persist_verification,
)


@pytest.mark.parametrize(
    ("output", "corroboration", "expected"),
    [
        ({"timestamp_mismatch_flag": None, "geolocation_mismatch_flag": None}, None, VerificationResult.uncertain),
        ({"timestamp_mismatch_flag": True, "geolocation_mismatch_flag": False}, None, VerificationResult.rejected),
        ({"timestamp_mismatch_flag": False, "geolocation_mismatch_flag": True}, None, VerificationResult.rejected),
        ({"timestamp_mismatch_flag": False, "geolocation_mismatch_flag": False}, None, VerificationResult.uncertain),
        ({"timestamp_mismatch_flag": False, "geolocation_mismatch_flag": False}, True, VerificationResult.verified),
        ({"timestamp_mismatch_flag": True, "geolocation_mismatch_flag": False}, True, VerificationResult.rejected),
    ],
)
def test_derive_result(output, corroboration, expected):
    assert derive_result(output, corroboration) == expected


def test_consistent_report_has_full_credibility():
    now = datetime.now(timezone.utc)
    result = evaluate_consistency(now, now, (19.0, 72.0), (19.0, 72.0))
    assert result["credibility_score"] == 1.0
    assert result["timestamp_mismatch_flag"] is False
    assert result["geolocation_mismatch_flag"] is False


def test_old_report_flags_timestamp_mismatch():
    now = datetime.now(timezone.utc)
    result = evaluate_consistency(now - timedelta(days=5), now, (19.0, 72.0), (19.0, 72.0))
    assert result["credibility_score"] == 0.6
    assert result["timestamp_mismatch_flag"] is True


def test_distant_report_flags_geolocation_mismatch():
    now = datetime.now(timezone.utc)
    result = evaluate_consistency(now, now, (19.0, 72.0), (20.0, 73.0))
    assert result["credibility_score"] == 0.6
    assert result["geolocation_mismatch_flag"] is True


def test_old_and_distant_report_flags_both_mismatches():
    now = datetime.now(timezone.utc)
    result = evaluate_consistency(now - timedelta(days=5), now, (19.0, 72.0), (20.0, 73.0))
    assert result["credibility_score"] == 0.2
    assert result["timestamp_mismatch_flag"] is True
    assert result["geolocation_mismatch_flag"] is True


def test_missing_inputs_leave_score_unknown():
    result = evaluate_consistency(None, None, None, None)
    assert result["credibility_score"] is None
    assert result["timestamp_mismatch_flag"] is None
    assert result["geolocation_mismatch_flag"] is None


def test_persist_verification_updates_the_existing_report_row():
    class Query:
        def __init__(self, db):
            self.db = db

        def filter(self, *_expressions):
            return self

        def one_or_none(self):
            return self.db.row

    class FakeDB:
        row = None

        def query(self, _model):
            return Query(self)

        def add(self, row):
            self.row = row

        def flush(self):
            pass

    db = FakeDB()
    report_id = uuid4()
    first = persist_verification(
        db,
        report_id,
        {
            "credibility_score": 1.0,
            "timestamp_mismatch_flag": False,
            "geolocation_mismatch_flag": False,
            "image_reuse_flag": None,
        },
    )
    second = persist_verification(
        db,
        report_id,
        {
            "credibility_score": 0.6,
            "timestamp_mismatch_flag": True,
            "geolocation_mismatch_flag": False,
            "image_reuse_flag": None,
        },
    )

    assert isinstance(first, Verification)
    assert second is first
    assert second.report_id == report_id
    assert second.result == VerificationResult.rejected
    assert second.credibility_score == 0.6
    assert second.timestamp_mismatch_flag is True
    assert second.geolocation_mismatch_flag is False
    assert second.image_reuse_flag is None
    assert db.row is first
