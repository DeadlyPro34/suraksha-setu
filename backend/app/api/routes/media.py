"""Authenticated image and video attachments for incident reports."""

from functools import lru_cache
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from supabase import create_client

from app.core.config import settings
from app.core.dependencies import get_current_user, require_role
from app.db.session import get_db
from app.models.report import Report
from app.models.dispatch import Dispatch, DispatchUpdate
from app.models.user import User, UserRole


router = APIRouter(prefix="/api/media", tags=["report media"])
_MAX_IMAGE_BYTES = 12 * 1024 * 1024
_MAX_VIDEO_BYTES = 50_000_000
_ALLOWED_MEDIA = {
    "image/jpeg": ("jpg", _MAX_IMAGE_BYTES),
    "image/png": ("png", _MAX_IMAGE_BYTES),
    "image/webp": ("webp", _MAX_IMAGE_BYTES),
    "image/gif": ("gif", _MAX_IMAGE_BYTES),
    "image/heic": ("heic", _MAX_IMAGE_BYTES),
    "image/heif": ("heif", _MAX_IMAGE_BYTES),
    "video/mp4": ("mp4", _MAX_VIDEO_BYTES),
    "video/quicktime": ("mov", _MAX_VIDEO_BYTES),
    "video/webm": ("webm", _MAX_VIDEO_BYTES),
}
_MEDIA_TYPES_BY_EXTENSION = {extension: mime for mime, (extension, _) in _ALLOWED_MEDIA.items()}


class MediaUploadRequest(BaseModel):
    content_type: str
    size_bytes: int = Field(gt=0, le=_MAX_VIDEO_BYTES)


@lru_cache(maxsize=1)
def _storage_client():
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Photo storage is not configured. Set the Supabase storage environment variables.",
        )
    try:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not initialize photo storage.") from exc


def _valid_signature(data: bytes, mime_type: str) -> bool:
    if mime_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP"
    if mime_type == "image/gif":
        return data.startswith((b"GIF87a", b"GIF89a"))
    if mime_type in {"image/heic", "image/heif"}:
        return len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] in {
            b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1",
        }
    if mime_type in {"video/mp4", "video/quicktime"}:
        return len(data) >= 12 and data[4:8] == b"ftyp"
    if mime_type == "video/webm":
        return data.startswith(b"\x1a\x45\xdf\xa3")
    return False


def _media_path(media_id: UUID, extension: str) -> Path:
    return settings.MEDIA_STORAGE_DIR / f"{media_id}.{extension}"


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def create_media_upload_url(
    data: MediaUploadRequest,
    _current_user: User = Depends(
        require_role("citizen", "official", "field_officer", "volunteer")
    ),
):
    """Create a one-use upload URL so media bypasses Vercel's function body limit."""
    mime_type = data.content_type.split(";", 1)[0].strip().lower()
    media_spec = _ALLOWED_MEDIA.get(mime_type)
    if media_spec is None:
        raise HTTPException(status_code=415, detail="Choose a supported image or video file")

    _, max_bytes = media_spec
    if data.size_bytes > max_bytes:
        raise HTTPException(
            status_code=413,
            detail="Images must be 12 MB or smaller; videos must be 50 MB or smaller",
        )

    media_id = uuid4()
    try:
        signed_upload = (
            _storage_client()
            .storage.from_(settings.SUPABASE_MEDIA_BUCKET)
            .create_signed_upload_url(str(media_id))
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not prepare the photo upload.") from exc

    return {
        "media_id": str(media_id),
        "url": f"/api/media/{media_id}",
        "upload_url": signed_upload["signed_url"],
        "content_type": mime_type,
        "size_bytes": data.size_bytes,
    }


@router.get("/{media_id}")
def get_report_media(
    media_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve media only to the report owner or authorized response staff."""
    role = current_user.role.value if isinstance(current_user.role, UserRole) else str(current_user.role)
    report_query = db.query(Report).filter(Report.image_url == f"/api/media/{media_id}")
    if role not in {UserRole.official.value, UserRole.field_officer.value}:
        report_query = report_query.filter(Report.reporter_id == current_user.id)
    report_exists = report_query.first() is not None
    update_query = db.query(DispatchUpdate).join(Dispatch).filter(
        DispatchUpdate.media_id == media_id,
    )
    if role not in {UserRole.official.value, UserRole.field_officer.value}:
        update_query = update_query.filter(
            (DispatchUpdate.author_id == current_user.id) | (Dispatch.assigned_to == current_user.id)
        )
    if not report_exists and update_query.first() is None:
        raise HTTPException(status_code=404, detail="Report media not found")

    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            signed_download = (
                _storage_client()
                .storage.from_(settings.SUPABASE_MEDIA_BUCKET)
                .create_signed_url(str(media_id), 600)
            )
            return RedirectResponse(signed_download["signedURL"], status_code=307)
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Could not retrieve the attached media.") from exc

    for extension, mime_type in _MEDIA_TYPES_BY_EXTENSION.items():
        path = _media_path(media_id, extension)
        if path.is_file():
            return FileResponse(
                path,
                media_type=mime_type,
                filename=f"report-media.{extension}",
                content_disposition_type="inline",
                headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
            )
    raise HTTPException(status_code=404, detail="Report media not found")
