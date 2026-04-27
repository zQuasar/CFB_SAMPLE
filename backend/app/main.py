"""FastAPI entrypoint for ConfBot.

Wires together: SQLite-backed sessions, LangGraph ReAct agent with the
shared async checkpointer, MCP manager, and the streaming chat endpoint.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agent.graph import agent_runtime
from app.agent.mcp_manager import mcp_manager
from app.config import settings
from app.db import init_db
from app.routers import chat, mcp, sessions, settings_routes

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ConfBot backend")
    await init_db()
    await agent_runtime.startup()
    try:
        # Best-effort warm-up of MCP servers; failures are surfaced via the
        # /api/mcp/status endpoint.
        await mcp_manager.reload()
    except Exception:
        logger.exception("MCP warmup failed")
    yield
    logger.info("Shutting down ConfBot backend")
    await agent_runtime.shutdown()


app = FastAPI(title="ConfBot", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(sessions.router)
app.include_router(chat.router)
app.include_router(mcp.router)
app.include_router(settings_routes.router)
