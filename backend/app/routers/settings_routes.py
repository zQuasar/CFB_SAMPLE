"""Runtime LLM settings (overrides env defaults; persisted in SQLite)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.llm import build_chat_model, load_llm_settings, save_llm_settings
from app.db import get_session
from app.schemas import LLMSettings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class LLMSettingsOut(BaseModel):
    base_url: str
    model: str
    temperature: float
    has_api_key: bool


def _to_out(cfg: LLMSettings) -> LLMSettingsOut:
    return LLMSettingsOut(
        base_url=cfg.base_url,
        model=cfg.model,
        temperature=cfg.temperature,
        has_api_key=bool(cfg.api_key),
    )


@router.get("/llm", response_model=LLMSettingsOut)
async def get_llm(db: AsyncSession = Depends(get_session)):
    return _to_out(await load_llm_settings(db))


class LLMSettingsIn(BaseModel):
    base_url: str | None = None
    api_key: str | None = None  # empty string = clear
    model: str | None = None
    temperature: float | None = None


@router.put("/llm", response_model=LLMSettingsOut)
async def update_llm(
    body: LLMSettingsIn, db: AsyncSession = Depends(get_session)
):
    current = await load_llm_settings(db)
    data = current.model_dump()
    if body.base_url is not None:
        data["base_url"] = body.base_url
    if body.model is not None:
        data["model"] = body.model
    if body.temperature is not None:
        data["temperature"] = body.temperature
    if body.api_key is not None:
        data["api_key"] = body.api_key
    new = LLMSettings(**data)
    await save_llm_settings(db, new)
    return _to_out(new)


@router.post("/llm/test")
async def test_llm(db: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    cfg = await load_llm_settings(db)
    try:
        model = build_chat_model(cfg)
        resp = await model.ainvoke(
            [{"role": "user", "content": "Reply with the single word: pong"}]
        )
        text = getattr(resp, "content", str(resp))
        return {"ok": True, "model": cfg.model, "reply": text}
    except Exception as exc:
        return {"ok": False, "model": cfg.model, "error": str(exc)}
