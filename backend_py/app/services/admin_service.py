"""Admin service: stats, health, AI quality metrics, user CRUD, document list."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.core.errors import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.announcement import Announcement
from app.models.chat_log import ChatLog
from app.models.document import DocumentRecord
from app.models.user import User
from app.schemas.admin import AdminUserCreateIn, AdminUserUpdateIn


async def stats(college_name: str) -> dict:
    """Dashboard stats scoped to a single tenant."""
    tenant_q = {"college_name": college_name}
    total_users = await User.find(tenant_q).count()
    total_students = await User.find({**tenant_q, "role": "student"}).count()
    total_faculty = await User.find({**tenant_q, "role": "faculty"}).count()
    total_admins = await User.find({**tenant_q, "role": "admin"}).count()
    total_documents = await DocumentRecord.find(tenant_q).count()
    completed = await DocumentRecord.find({**tenant_q, "status": "completed"}).count()
    failed = await DocumentRecord.find({**tenant_q, "status": "failed"}).count()
    pending = await DocumentRecord.find({**tenant_q, "status": "pending"}).count()
    processing = await DocumentRecord.find({**tenant_q, "status": "processing"}).count()
    total_announcements = await Announcement.find(tenant_q).count()
    total_chats = await ChatLog.find(tenant_q).count()
    return {
        "totalUsers": total_users,
        "totalStudents": total_students,
        "totalFaculty": total_faculty,
        "totalAdmins": total_admins,
        "totalDocuments": total_documents,
        "documentsCompleted": completed,
        "documentsFailed": failed,
        "documentsPending": pending,
        "documentsProcessing": processing,
        "totalAnnouncements": total_announcements,
        "totalChats": total_chats,
    }


async def quality_summary(college_name: str) -> dict:
    """Aggregate low-confidence / failed retrievals / missing-doc signals."""
    since = datetime.now(UTC) - timedelta(days=7)
    base_q = {"college_name": college_name, "created_at": {"$gte": since}}
    total = await ChatLog.find(base_q).count()
    low_conf = await ChatLog.find(
        {**base_q, "confidence": "low"}
    ).count()
    high_conf = await ChatLog.find(
        {**base_q, "confidence": "high"}
    ).count()
    failed_docs = await DocumentRecord.find(
        {"college_name": college_name, "status": "failed", "created_at": {"$gte": since}}
    ).count()
    # Most searched topics proxy: top question tokens (rough)
    recent_chats = await ChatLog.find(base_q).to_list(500)
    return {
        "window_days": 7,
        "total_chats": total,
        "low_confidence_chats": low_conf,
        "high_confidence_chats": high_conf,
        "failed_ingestions_7d": failed_docs,
        "recent_chat_sample_size": len(recent_chats),
    }


# ---- User CRUD ----


async def list_users(
    college_name: str,
    page: int = 1, limit: int = 20, role: str | None = None, query: str | None = None
) -> dict:
    # ReDoS / full-enumeration guard: cap query length and escape regex
    # metacharacters so a crafted `?q=.*` or `?q=(a+)+$` cannot blow up Mongo.
    if query and len(query) > 64:
        query = query[:64]
    filter_q: dict = {"college_name": college_name}
    if role:
        filter_q["role"] = role
    q = User.find(filter_q)
    if query:
        import re as _re

        from beanie.operators import Or, RegEx

        safe = _re.escape(query)
        q = User.find(
            {"college_name": college_name},
            Or(
                RegEx(User.name, safe, "i"),
                RegEx(User.college_id, safe, "i"),
            ),
        )
    total = await q.count()
    users = await q.skip((page - 1) * limit).limit(limit).to_list(limit)
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "users": [
            {
                "id": str(u.id),
                "name": u.name,
                "college_id": u.college_id,
                "college_name": u.college_name,
                "department": u.department,
                "role": u.role,
                "is_active": u.is_active,
                "email": u.email,
            }
            for u in users
        ],
    }


async def create_user(college_name: str, payload: AdminUserCreateIn) -> dict:
    if payload.college_name != college_name:
        from app.core.errors import AppError

        raise AppError(
            "Cannot create users for a different college", status_code=403
        )
    if await User.find_one({"college_id": payload.college_id}) is not None:
        raise ConflictError("User with this College ID already exists")
    user = User(
        name=payload.name,
        college_id=payload.college_id,
        username=payload.college_id,
        email=payload.email or f"{payload.college_id.lower()}@chatwave.edu",
        password=hash_password(payload.password),
        role=payload.role,
        college_name=payload.college_name,
        department=payload.department,
        is_active=True,
    )
    await user.insert()
    return {"message": "User created", "id": str(user.id)}


async def update_user(college_name: str, user_id: str, payload: AdminUserUpdateIn) -> dict:
    user = await User.get(user_id)
    if user is None or user.college_name != college_name:
        raise NotFoundError("User not found")
    if payload.role is not None:
        user.role = payload.role  # type: ignore[assignment]
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.department is not None:
        user.department = payload.department
    if payload.name is not None:
        user.name = payload.name
    await user.save()
    return {"message": "User updated"}


async def delete_user(college_name: str, user_id: str) -> dict:
    user = await User.get(user_id)
    if user is None or user.college_name != college_name:
        raise NotFoundError("User not found")
    # Soft delete: deactivate + invalidate refresh tokens
    user.is_active = False
    user.refresh_token_hash = None
    await user.save()
    return {"message": "User deactivated"}


# ---- Document listing ----


async def list_documents(
    college_name: str,
    page: int = 1, limit: int = 50, status: str | None = None
) -> dict:
    filter_q: dict = {"college_name": college_name}
    if status:
        filter_q["status"] = status
    total = await DocumentRecord.find(filter_q).count()
    docs = (
        await DocumentRecord.find(filter_q)
        .sort("-updated_at")
        .skip((page - 1) * limit)
        .limit(limit)
        .to_list(limit)
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "documents": [
            {
                "id": str(d.id),
                "filename": d.filename,
                "status": d.status,
                "chunk_count": d.chunk_count,
                "uploader": d.uploader,
                "college_name": d.college_name,
                "department": d.department,
                "error_message": d.error_message,
                "updated_at": d.updated_at,
            }
            for d in docs
        ],
    }