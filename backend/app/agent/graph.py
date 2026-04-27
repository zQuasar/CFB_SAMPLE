"""LangGraph ReAct agent factory + global async checkpointer lifecycle."""

from __future__ import annotations

import logging
from contextlib import AsyncExitStack
from typing import Any

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.prebuilt import create_react_agent

from app.agent.llm import build_chat_model
from app.agent.mcp_manager import mcp_manager
from app.config import settings
from app.schemas import LLMSettings

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You are ConfBot, a helpful AI assistant. "
    "When tools provided by MCP servers are available, prefer using them for "
    "tasks that require fresh data, file access, or external systems. "
    "Always cite tool results when relevant and answer concisely."
)


class AgentRuntime:
    """Owns the long-lived async checkpointer.

    `AsyncSqliteSaver.from_conn_string` is an async context manager. We hold
    it open for the lifetime of the FastAPI process via an AsyncExitStack
    managed by the app lifespan handler.
    """

    def __init__(self) -> None:
        self._stack: AsyncExitStack | None = None
        self.checkpointer: AsyncSqliteSaver | None = None

    async def startup(self) -> None:
        self._stack = AsyncExitStack()
        cm = AsyncSqliteSaver.from_conn_string(settings.checkpoint_path)
        self.checkpointer = await self._stack.enter_async_context(cm)
        try:
            await self.checkpointer.setup()
        except Exception:  # pragma: no cover
            logger.exception("checkpointer setup failed")

    async def shutdown(self) -> None:
        if self._stack is not None:
            await self._stack.aclose()
        self._stack = None
        self.checkpointer = None


agent_runtime = AgentRuntime()


async def build_agent(llm_cfg: LLMSettings) -> Any:
    """Build a fresh ReAct agent bound to the current MCP toolset.

    Cheap to call per-turn: `create_react_agent` just compiles a graph that
    references the (shared) checkpointer + the (shared) MCP tools.
    """
    if agent_runtime.checkpointer is None:
        raise RuntimeError("Agent runtime not started")

    model = build_chat_model(llm_cfg)
    tools = await mcp_manager.get_tools()
    return create_react_agent(
        model,
        tools,
        checkpointer=agent_runtime.checkpointer,
        prompt=SYSTEM_PROMPT,
    )
