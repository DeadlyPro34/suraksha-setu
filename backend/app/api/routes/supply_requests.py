"""Supply requests from field teams and official delivery tracking."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.elements import WKTElement
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import require_role
from app.db.session import get_db
from app.models.supply_request import SupplyRequest
from app.models.resource import Resource, ResourceStatus, ResourceType
from app.models.user import User, UserRole
from app.schemas.supply_request import (
    SupplyRequestCreate,
    SupplyRequestDispatch,
    SupplyRequestOfficialClose,
    SupplyRequestOut,
    SupplyRequestReceipt,
    SupplyRequestReview,
)

router = APIRouter(prefix="/api/supply-requests", tags=["supply requests"])


def _out(item: SupplyRequest) -> SupplyRequestOut:
    return SupplyRequestOut(
        id=item.id,
        requester_id=item.requester_id,
        requester_name=item.requester.name if item.requester else "Unknown user",
        requester_role=item.requester_role,
        resource_type=item.resource_type,
        requested_quantity=item.requested_quantity,
        approved_quantity=item.approved_quantity,
        stock_source_resource_id=item.stock_source_resource_id,
        stock_source_location=item.stock_source_resource.location_name if item.stock_source_resource else None,
        location_name=item.location_name,
        lat=item.lat,
        lon=item.lon,
        note=item.note,
        status=item.status,
        created_at=item.created_at,
        reviewed_by=item.reviewed_by,
        reviewer_name=item.reviewer.name if item.reviewer else None,
        reviewed_at=item.reviewed_at,
        review_note=item.review_note,
        delivery_handler=item.delivery_handler,
        dispatch_note=item.dispatch_note,
        dispatched_by=item.dispatched_by,
        dispatcher_name=item.dispatcher.name if item.dispatcher else None,
        dispatched_at=item.dispatched_at,
        received_quantity=item.received_quantity,
        receipt_note=item.receipt_note,
        receipt_status=item.receipt_status,
        received_by=item.received_by,
        receiver_name=item.receiver.name if item.receiver else None,
        received_at=item.received_at,
        official_close_note=item.official_close_note,
        closed_by=item.closed_by,
        closer_name=item.closer.name if item.closer else None,
        closed_at=item.closed_at,
    )


def _get_item(db: Session, request_id: UUID) -> SupplyRequest:
    item = db.query(SupplyRequest).filter(SupplyRequest.id == request_id).with_for_update().first()
    if item is None:
        raise HTTPException(status_code=404, detail="Supply request not found.")
    return item


@router.post("", response_model=SupplyRequestOut, status_code=201)
def create_supply_request(
    data: SupplyRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer", "field_officer")),
):
    if (data.lat is None) != (data.lon is None):
        raise HTTPException(status_code=422, detail="Provide both coordinates or leave both empty.")
    if not data.location_name.strip() or not data.note.strip():
        raise HTTPException(status_code=422, detail="Location and request details cannot be blank.")
    item = SupplyRequest(
        requester_id=current_user.id,
        requester_role=current_user.role.value,
        resource_type=data.resource_type.value,
        requested_quantity=data.requested_quantity,
        location_name=data.location_name.strip(),
        lat=data.lat,
        lon=data.lon,
        note=data.note.strip(),
        status="pending",
        receipt_status="awaiting_confirmation",
    )
    db.add(item)
    db.commit()
    return _out(_get_item(db, item.id))


@router.get("/mine", response_model=list[SupplyRequestOut])
def list_my_supply_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer", "field_officer")),
):
    items = db.query(SupplyRequest).options(
        joinedload(SupplyRequest.requester), joinedload(SupplyRequest.reviewer),
        joinedload(SupplyRequest.dispatcher), joinedload(SupplyRequest.receiver), joinedload(SupplyRequest.closer),
    ).filter(SupplyRequest.requester_id == current_user.id).order_by(SupplyRequest.created_at.desc()).limit(200).all()
    return [_out(item) for item in items]


@router.get("", response_model=list[SupplyRequestOut])
def list_supply_requests(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _official: User = Depends(require_role("official")),
):
    allowed = {"pending", "approved", "rejected", "dispatched", "receipt_submitted", "delivery_issue", "delivered"}
    if status is not None and status not in allowed:
        raise HTTPException(status_code=422, detail="Invalid supply request status.")
    query = db.query(SupplyRequest).options(
        joinedload(SupplyRequest.requester), joinedload(SupplyRequest.reviewer),
        joinedload(SupplyRequest.dispatcher), joinedload(SupplyRequest.receiver), joinedload(SupplyRequest.closer),
    )
    if status:
        query = query.filter(SupplyRequest.status == status)
    items = query.order_by(SupplyRequest.created_at.desc()).limit(500).all()
    return [_out(item) for item in items]


@router.patch("/{request_id}/review", response_model=SupplyRequestOut)
def review_supply_request(
    request_id: UUID,
    data: SupplyRequestReview,
    db: Session = Depends(get_db),
    official: User = Depends(require_role("official")),
):
    item = _get_item(db, request_id)
    if item.status != "pending":
        raise HTTPException(status_code=409, detail="Only a pending supply request can be reviewed.")
    if data.decision == "approved":
        quantity = data.approved_quantity if data.approved_quantity is not None else item.requested_quantity
        if quantity > item.requested_quantity:
            raise HTTPException(status_code=422, detail="Approved quantity cannot exceed requested quantity.")
        item.approved_quantity = quantity
        item.status = "approved"
    else:
        item.approved_quantity = None
        item.status = "rejected"
    item.review_note = data.review_note.strip() if data.review_note else None
    item.reviewed_by = official.id
    item.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return _out(_get_item(db, item.id))


@router.patch("/{request_id}/dispatch", response_model=SupplyRequestOut)
def dispatch_supply_request(
    request_id: UUID,
    data: SupplyRequestDispatch,
    db: Session = Depends(get_db),
    official: User = Depends(require_role("official")),
):
    item = _get_item(db, request_id)
    if item.status != "approved":
        raise HTTPException(status_code=409, detail="Approve the request before dispatching supplies.")
    if not data.delivery_handler.strip() or not data.dispatch_note.strip():
        raise HTTPException(status_code=422, detail="Record the delivery handler and dispatch details.")
    stock = (db.query(Resource).filter(
        Resource.id == data.stock_source_resource_id,
        Resource.incident_id.is_(None),
    ).with_for_update().first())
    if stock is None or stock.type != ResourceType(item.resource_type):
        raise HTTPException(status_code=422, detail="Choose a valid stock location for this supply type.")
    quantity = item.approved_quantity or 0
    if stock.status != ResourceStatus.available or stock.quantity < quantity:
        raise HTTPException(status_code=409, detail="This stock location does not have enough available units.")
    stock.quantity -= quantity
    if stock.quantity == 0:
        stock.status = ResourceStatus.depleted
    item.stock_source_resource_id = stock.id
    item.delivery_handler = data.delivery_handler.strip()
    item.dispatch_note = data.dispatch_note.strip()
    item.dispatched_by = official.id
    item.dispatched_at = datetime.now(timezone.utc)
    item.status = "dispatched"
    item.receipt_status = "awaiting_confirmation"
    db.commit()
    return _out(_get_item(db, item.id))


@router.patch("/{request_id}/receipt", response_model=SupplyRequestOut)
def confirm_supply_receipt(
    request_id: UUID,
    data: SupplyRequestReceipt,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("volunteer", "field_officer")),
):
    item = _get_item(db, request_id)
    if item.requester_id != current_user.id or item.requester_role != current_user.role.value:
        raise HTTPException(status_code=404, detail="Supply request not found.")
    if item.status not in {"dispatched", "delivery_issue"}:
        raise HTTPException(status_code=409, detail="This request is not awaiting delivery confirmation.")
    expected = item.approved_quantity or 0
    if data.received_quantity > expected:
        raise HTTPException(status_code=422, detail="Received quantity cannot exceed the approved quantity.")
    if data.received_quantity < expected and not (data.receipt_note or "").strip():
        raise HTTPException(status_code=422, detail="Describe the delivery shortfall so officials can follow up.")
    item.received_quantity = data.received_quantity
    item.receipt_note = data.receipt_note.strip() if data.receipt_note else None
    item.received_by = current_user.id
    item.received_at = datetime.now(timezone.utc)
    if data.received_quantity < expected:
        item.status = "receipt_submitted"
        item.receipt_status = "shortfall_reported"
    else:
        item.status = "receipt_submitted"
        item.receipt_status = "confirmed"
    db.commit()
    return _out(_get_item(db, item.id))


@router.patch("/{request_id}/close-delivery", response_model=SupplyRequestOut)
def close_delivery_without_requester_confirmation(
    request_id: UUID,
    data: SupplyRequestOfficialClose,
    db: Session = Depends(get_db),
    official: User = Depends(require_role("official")),
):
    item = _get_item(db, request_id)
    if item.status not in {"dispatched", "delivery_issue", "receipt_submitted"}:
        raise HTTPException(status_code=409, detail="Only a dispatched delivery or submitted receipt can be closed.")
    expected = item.approved_quantity or 0
    if data.received_quantity > expected:
        raise HTTPException(status_code=422, detail="Received quantity cannot exceed the approved quantity.")
    reason = (data.reason or "").strip()
    has_recipient_receipt = item.status == "receipt_submitted" and item.received_by is not None
    if not has_recipient_receipt and len(reason) < 5:
        raise HTTPException(status_code=422, detail="Record a reason for closing without requester confirmation.")
    if has_recipient_receipt and data.received_quantity != item.received_quantity and len(reason) < 5:
        raise HTTPException(status_code=422, detail="Explain any change to the recipient-confirmed quantity.")
    if data.received_quantity > 0:
        resource_type = ResourceType(item.resource_type)
        stock = (db.query(Resource).filter(
            Resource.type == resource_type,
            Resource.incident_id.is_(None),
            Resource.location_name == item.location_name,
        ).order_by(Resource.id.asc()).with_for_update().first())
        if stock is None:
            stock = Resource(type=resource_type, quantity=data.received_quantity, incident_id=None,
                             location_name=item.location_name,
                             status=ResourceStatus.available)
            db.add(stock)
        else:
            stock.quantity += data.received_quantity
            stock.status = ResourceStatus.available
        if item.lat is not None and item.lon is not None:
            stock.location = WKTElement(f"POINT({item.lon} {item.lat})", srid=4326)
    item.received_quantity = data.received_quantity
    item.official_close_note = reason or None
    item.closed_by = official.id
    item.closed_at = datetime.now(timezone.utc)
    item.status = "delivered"
    if not has_recipient_receipt:
        item.receipt_status = "official_override"
    db.commit()
    return _out(_get_item(db, item.id))
