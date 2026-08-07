from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # 数据库 — Supabase PostgreSQL（在 Supabase Settings > Database > Connection string 获取）
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/expense"

    # JWT
    jwt_secret_key: str = "change_me_to_random_string"
    jwt_refresh_secret_key: str = "change_me_to_another_random_string"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # Supabase（用于存储发票图片）
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_storage_bucket: str = "invoices"

    # OCR（占用内存大，默认关闭）
    ocr_enabled: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
