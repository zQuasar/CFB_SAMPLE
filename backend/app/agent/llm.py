"""OpenAI-compatible chat model factory.

Resolves runtime LLM settings (DB key/value overrides falling back to env
defaults) and constructs a `ChatOpenAI` pointing at the configured base URL.
"""

from __future__ import annotations

import json

from langchain_openai import ChatOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as env_settings
from app.db.models import SettingKV
from app.schemas import LLMSettings

LLM_SETTINGS_KEY = "llm"


async def load_llm_settings(session: AsyncSession) -> LLMSettings:
    row = await session.get(SettingKV, LLM_SETTINGS_KEY)
    if row and row.value:
        try:
            data = json.loads(row.value)
            return LLMSettings(**data)
        except Exception:
            pass
    return LLMSettings(
        base_url=env_settings.llm_base_url,
        api_key=env_settings.llm_api_key,
        model=env_settings.llm_model,
        temperature=env_settings.llm_temperature,
    )


async def save_llm_settings(
    session: AsyncSession, cfg: LLMSettings
) -> LLMSettings:
    row = await session.get(SettingKV, LLM_SETTINGS_KEY)
    payload = json.dumps(cfg.model_dump())
    if row:
        row.value = payload
    else:
        session.add(SettingKV(key=LLM_SETTINGS_KEY, value=payload))
    await session.commit()
    return cfg


def build_chat_model(cfg: LLMSettings) -> ChatOpenAI:
    return ChatOpenAI(
        model=cfg.model,
        temperature=cfg.temperature,
        base_url=cfg.base_url or None,
        api_key=cfg.api_key or "not-needed",
        streaming=True,
    )
