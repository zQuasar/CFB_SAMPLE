"""Streaming chat endpoint.

Posts a user message, persists it, runs the LangGraph agent against the
session's thread, and streams assistant tokens + tool events back to the
client over Server-Sent Events.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agent.graph import build_agent
from app.agent.llm import load_llm_settings
from app.db import Message, Session as ChatSession, get_session
from app.schemas import ChatRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _sse(event: str, data: Any) -> dict[str, Any]:
    return {"event": event, "data": json.dumps(data, default=str)}


@router.post("")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_session)):
    chat_session = await db.get(ChatSession, req.session_id)
    if chat_session is None:
        raise HTTPException(404, "Session not found")

    user_text = (req.content or "").strip()
    if not user_text:
        raise HTTPException(400, "Empty message")

    user_msg = Message(
        session_id=chat_session.id, role="user", content=user_text
    )
    db.add(user_msg)
    if chat_session.title == "New chat":
        chat_session.title = user_text[:60]
    await db.commit()
    await db.refresh(user_msg)

    llm_cfg = await load_llm_settings(db)
    session_id = chat_session.id

    async def event_stream() -> AsyncIterator[dict[str, Any]]:
        yield _sse(
            "user_message",
            {
                "id": user_msg.id,
                "role": "user",
                "content": user_msg.content,
                "created_at": user_msg.created_at.isoformat(),
            },
        )

        assistant_buffer: list[str] = []
        tool_events: list[dict[str, Any]] = []

        try:
            agent = await build_agent(llm_cfg)
            config = {"configurable": {"thread_id": session_id}}
            inputs = {"messages": [{"role": "user", "content": user_text}]}

            async for event in agent.astream_events(
                inputs, config=config, version="v2"
            ):
                kind = event.get("event")
                name = event.get("name", "")
                data = event.get("data", {}) or {}

                if kind == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    text = getattr(chunk, "content", "") if chunk else ""
                    if isinstance(text, list):
                        # Some providers emit list-of-parts; flatten text parts.
                        text = "".join(
                            p.get("text", "")
                            for p in text
                            if isinstance(p, dict)
                        )
                    if text:
                        assistant_buffer.append(text)
                        yield _sse("token", {"text": text})

                elif kind == "on_tool_start":
                    info = {
                        "name": name,
                        "input": data.get("input"),
                        "status": "start",
                    }
                    tool_events.append(info)
                    yield _sse("tool", info)

                elif kind == "on_tool_end":
                    output = data.get("output")
                    info = {
                        "name": name,
                        "output": _coerce(output),
                        "status": "end",
                    }
                    tool_events.append(info)
                    yield _sse("tool", info)

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("agent error")
            yield _sse("error", {"message": str(exc)})

        full_text = "".join(assistant_buffer).strip()
        if not full_text and not tool_events:
            full_text = "(no response)"

        # Use a fresh session for the post-stream write — the request-scoped
        # session may already be closed by the time streaming finishes.
        from app.db.database import SessionLocal

        async with SessionLocal() as write_db:
            assistant_msg = Message(
                session_id=session_id,
                role="assistant",
                content=full_text,
                extra=json.dumps({"tool_events": tool_events})
                if tool_events
                else None,
            )
            write_db.add(assistant_msg)
            s = await write_db.get(ChatSession, session_id)
            if s is not None:
                s.updated_at = datetime.now(timezone.utc)
            await write_db.commit()
            await write_db.refresh(assistant_msg)

        yield _sse(
            "assistant_message",
            {
                "id": assistant_msg.id,
                "role": "assistant",
                "content": assistant_msg.content,
                "extra": {"tool_events": tool_events} if tool_events else None,
                "created_at": assistant_msg.created_at.isoformat(),
            },
        )
        yield _sse("done", {})

    return EventSourceResponse(event_stream())


def _coerce(value: Any) -> Any:
    """Best-effort JSON-serializable coercion for tool outputs."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [_coerce(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _coerce(v) for k, v in value.items()}
    text = getattr(value, "content", None)
    if text is not None:
        return _coerce(text)
    return str(value)
