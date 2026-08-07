from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import Notification, User, UserRole


async def notify_user(db: AsyncSession, recipient_id: int, content: str):
    n = Notification(recipient_id=recipient_id, content=content)
    db.add(n)


async def notify_by_role(db: AsyncSession, role: str, content: str):
    result = await db.execute(select(User.id).where(User.role == role, User.is_active == True))
    user_ids = result.scalars().all()
    for uid in user_ids:
        await notify_user(db, uid, content)
