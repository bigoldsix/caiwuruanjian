from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.jwt_refresh_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str, is_refresh: bool = False) -> Optional[dict]:
    key = settings.jwt_refresh_secret_key if is_refresh else settings.jwt_secret_key
    try:
        payload = jwt.decode(token, key, algorithms=[settings.jwt_algorithm])
        expected_type = "refresh" if is_refresh else "access"
        if payload.get("type") != expected_type:
            return None
        return payload
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    from .database import AsyncSessionLocal
    from .models import User
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="无效或过期的 token")
    user_id = int(payload["sub"])
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=403, detail="用户不存在或已禁用")
        return user


async def admin_required(user=Depends(get_current_user)):
    if user.role not in ("admin",):
        raise HTTPException(403, "需要管理员权限")
    return user


async def finance_required(user=Depends(get_current_user)):
    if user.role not in ("finance", "admin"):
        raise HTTPException(403, "需要财务或管理员权限")
    return user


async def manager_or_finance_required(user=Depends(get_current_user)):
    if user.role not in ("manager", "finance", "admin"):
        raise HTTPException(403, "需要审批权限")
    return user


async def admin_or_executive_required(user=Depends(get_current_user)):
    if user.role not in ("admin", "executive"):
        raise HTTPException(403, "需要管理员或高管权限")
    return user
