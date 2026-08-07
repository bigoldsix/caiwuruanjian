from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from contextlib import asynccontextmanager
from .routers import router, init_db
from .config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时：创建表 + 初始化基础数据
    await init_db()
    # 基础数据初始化在 ensure_seed_data 中
    from .database import AsyncSessionLocal, engine
    async with engine.begin() as conn:
        await conn.run_sync(ensure_seed_data)
    yield


def ensure_seed_data(sync_conn):
    """同步初始化部门、类别、管理员"""
    from sqlalchemy import text

    # 部门
    result = sync_conn.execute(text("SELECT COUNT(*) FROM departments"))
    if result.scalar() == 0:
        sync_conn.execute(text("""
            INSERT INTO departments (name) VALUES
            ('技术部'), ('市场部'), ('销售部'), ('财务部'), ('人事部'), ('运营部')
        """))

    # 费用类别
    result = sync_conn.execute(text("SELECT COUNT(*) FROM expense_categories"))
    if result.scalar() == 0:
        sync_conn.execute(text("""
            INSERT INTO expense_categories (name, is_active) VALUES
            ('差旅费', true), ('交通费', true), ('餐饮招待费', true),
            ('办公用品', true), ('培训费', true)
        """))

    # 管理员
    from .auth import hash_password
    result = sync_conn.execute(text("SELECT COUNT(*) FROM users WHERE email = 'admin@company.com'"))
    if result.scalar() == 0:
        sync_conn.execute(text(
            "INSERT INTO users (name, email, hashed_password, role, must_change_password) "
            "VALUES ('管理员', 'admin@company.com', :pw, 'admin', false)"
        ), {"pw": hash_password("admin123")})


app = FastAPI(
    title="费用报销系统",
    version="2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

# Vercel Serverless 入口
handler = Mangum(app)
