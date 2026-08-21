"""Admin routes - users, documents, activity, stats, health, AI quality."""
from __future__ import annotations

from datetime import UTC
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import CSRFDep, TenantContextDep, require_admin
from app.models.user import User
from app.schemas.admin import AdminUserCreateIn, AdminUserUpdateIn

router = APIRouter()

Admin = Annotated[User, Depends(require_admin)]


@router.get("/stats")
async def admin_stats(user: Admin, ctx: TenantContextDep):
    from app.services.admin_service import stats

    return await stats(ctx.college_name)


@router.get("/health")
async def admin_health(user: Admin):
    from app.api.routes.health import health

    return await health()


@router.get("/activity")
async def admin_activity(
    user: Admin, ctx: TenantContextDep, limit: int = Query(50, le=200),
) -> dict:
    """Recent admin-relevant events. Backed by ChatLog + DocumentRecord."""
    from datetime import datetime

    from app.models.chat_log import ChatLog
    from app.models.document import DocumentRecord

    activity: list[dict] = []
    # Recent chat turns
    chats = (
        await ChatLog.find({"college_name": ctx.college_name})
        .sort("-created_at")
        .limit(limit)
        .to_list(limit)
    )
    for c in chats:
        activity.append(
            {
                "type": "chat",
                "user": c.user,
                "college_name": c.college_name,
                "trace_id": c.trace_id,
                "confidence": c.confidence,
                "at": c.created_at or datetime.now(UTC),
            }
        )
    # Recent document uploads
    docs = (
        await DocumentRecord.find({"college_name": ctx.college_name})
        .sort("-updated_at")
        .limit(limit)
        .to_list(limit)
    )
    for d in docs:
        activity.append(
            {
                "type": "document",
                "document_id": str(d.id),
                "filename": d.filename,
                "status": d.status,
                "uploader": d.uploader,
                "college_name": d.college_name,
                "at": d.updated_at or d.created_at,
            }
        )
    activity.sort(key=lambda a: a["at"], reverse=True)
    return {"activities": activity[:limit]}


@router.get("/quality")
async def admin_quality(user: Admin, ctx: TenantContextDep) -> dict:
    from app.services.admin_service import quality_summary

    return await quality_summary(ctx.college_name)


@router.get("/users")
async def admin_list_users(
    user: Admin,
    ctx: TenantContextDep,
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=200),
    role: str | None = Query(None),
    q: str | None = Query(None),
) -> dict:
    """List users with optional filtering. Admin only."""
    from app.services.admin_service import list_users

    return await list_users(
        college_name=ctx.college_name,
        page=page, limit=limit, role=role, query=q,
    )


@router.post("/users", status_code=201)
async def admin_create_user(
    user: Admin, _: CSRFDep, ctx: TenantContextDep,
    payload: AdminUserCreateIn,
) -> dict:
    """Create a user on behalf of a college (admin operation)."""
    from app.services.admin_service import create_user

    return await create_user(college_name=ctx.college_name, payload=payload)


@router.put("/users/{user_id}")
async def admin_update_user(
    user: Admin, _: CSRFDep, ctx: TenantContextDep, user_id: str, payload: AdminUserUpdateIn
) -> dict:
    from app.services.admin_service import update_user

    return await update_user(college_name=ctx.college_name, user_id=user_id, payload=payload)


@router.delete("/users/{user_id}")
async def admin_delete_user(user: Admin, _: CSRFDep, ctx: TenantContextDep, user_id: str) -> dict:
    from app.services.admin_service import delete_user

    return await delete_user(college_name=ctx.college_name, user_id=user_id)


@router.get("/documents")
async def admin_list_documents(
    user: Admin,
    ctx: TenantContextDep,
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    status: str | None = Query(None),
) -> dict:
    from app.services.admin_service import list_documents

    return await list_documents(
        college_name=ctx.college_name,
        page=page, limit=limit, status=status,
    )


@router.delete("/documents/{document_id}")
async def admin_delete_document(
    user: Admin, _: CSRFDep, ctx: TenantContextDep, document_id: str
) -> dict:
    """Admin-scoped document delete: removes the document + its Qdrant vectors."""
    from app.services.upload_service import remove_document

    return await remove_document(
        college_name=ctx.college_name, document_id=document_id, user_id=str(user.id)
    )


@router.post("/documents/{document_id}/retry")
async def admin_retry_document(
    user: Admin, _: CSRFDep, ctx: TenantContextDep, document_id: str
) -> dict:
    """Re-enqueue a failed document for ingestion."""
    from app.models.document import DocumentRecord
    from app.core.errors import NotFoundError, ForbiddenError
    from app.services.upload_service import retry_document

    doc = await DocumentRecord.get(document_id)
    if doc is None or doc.college_name != ctx.college_name:
        raise NotFoundError("Document not found")
    if doc.status not in ("failed", "pending"):
        raise ForbiddenError("Only failed or pending documents can be retried")
    return await retry_document(doc)


# ---- Model management ------------------------------------------------------


@router.get("/model")
async def admin_get_model(user: Admin) -> dict:
    """Return the active chat model + available catalog."""
    from app.services.model_registry import get_model_status

    return get_model_status()


@router.post("/model")
async def admin_set_model(user: Admin, _: CSRFDep, payload: dict) -> dict:
    """Set the active chat model override (admin only)."""
    from app.core.errors import ValidationAppError
    from app.services.model_registry import set_model_override

    model = payload.get("model")
    if not model or not isinstance(model, str):
        raise ValidationAppError("Body must include a 'model' string")
    try:
        return set_model_override(model)
    except ValueError as exc:
        raise ValidationAppError(str(exc)) from exc


@router.delete("/model")
async def admin_clear_model(user: Admin, _: CSRFDep) -> dict:
    """Clear the active chat model override and revert to default."""
    from app.services.model_registry import clear_model_override

    return clear_model_override()