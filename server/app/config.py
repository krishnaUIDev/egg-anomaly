"""Enterprise Application Configuration and Environment Settings."""

import os

from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "EggScan Enterprise"
    app_version: str = "2.0.0"
    app_env: str = os.getenv("APP_ENV", "production")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    cors_origins: list[str] = [
        origin.strip() for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,*"
        ).split(",") if origin.strip()
    ]
    max_batch_size: int = int(os.getenv("MAX_BATCH_SIZE", "50"))
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "15"))


settings = Settings()

