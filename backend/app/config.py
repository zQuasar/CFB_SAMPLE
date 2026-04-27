"""Runtime configuration.

Defaults are environment-driven; the `settings` table in SQLite can override
LLM values at runtime so the user can change them from the UI.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM defaults (overridable via UI -> settings table)
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.2

    # Storage
    data_dir: str = "./data"
    sqlite_path: str = "./data/confbot.db"
    checkpoint_path: str = "./data/checkpoints.db"
    mcp_config_path: str = "./data/mcp.json"

    # Server
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def ensure_dirs(self) -> None:
        Path(self.data_dir).mkdir(parents=True, exist_ok=True)
        Path(self.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        Path(self.checkpoint_path).parent.mkdir(parents=True, exist_ok=True)
        Path(self.mcp_config_path).parent.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
