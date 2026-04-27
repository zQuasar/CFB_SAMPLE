"""CRUD endpoints for chat sessions + their message history."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import Message, Session, get_session
from app.schemas import (
    MessageOut,
    SessionCreate,
    SessionOut,
    SessionUpdate,
    SessionWithMessages,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _msg_to_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        session_id=m.session_id,
        role=m.role,
        content=m.content,
        extra=json.loads(m.extra) if m.extra else None,
        created_at=m.created_at,
    )


@router.get("", response_model=list[SessionOut])
async def list_sessions(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(Session).order_by(Session.updated_at.desc()))
    return list(result.scalars().all())


@router.post("", response_model=SessionOut)
async def create_session(
    body: SessionCreate, db: AsyncSession = Depends(get_session)
):
    s = Session(title=(body.title or "New chat").strip() or "New chat")
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


@router.get("/{session_id}", response_model=SessionWithMessages)
async def get_session_detail(
    session_id: str, db: AsyncSession = Depends(get_session)
):
    result = await db.execute(
        select(Session)
        .options(selectinload(Session.messages))
        .where(Session.id == session_id)
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(404, "Session not found")
    return SessionWithMessages(
        id=s.id,
        title=s.title,
        created_at=s.created_at,
        updated_at=s.updated_at,
        messages=[_msg_to_out(m) for m in s.messages],
    )


@router.patch("/{session_id}", response_model=SessionOut)
async def update_session(
    session_id: str,
    body: SessionUpdate,
    db: AsyncSession = Depends(get_session),
):
    s = await db.get(Session, session_id)
    if s is None:
        raise HTTPException(404, "Session not found")
    if body.title is not None:
        s.title = body.title.strip() or s.title
    await db.commit()
    await db.refresh(s)
    return s


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str, db: AsyncSession = Depends(get_session)
):
    s = await db.get(Session, session_id)
    if s is None:
        raise HTTPException(404, "Session not found")
    await db.delete(s)
    await db.commit()
    return None
