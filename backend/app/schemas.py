"""Pydantic request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# --- Sessions / Messages ---------------------------------------------------


class MessageOut(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    extra: dict[str, Any] | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionWithMessages(SessionOut):
    messages: list[MessageOut] = []


class SessionCreate(BaseModel):
    title: str | None = None


class SessionUpdate(BaseModel):
    title: str | None = None


class ChatRequest(BaseModel):
    session_id: str
    content: str


# --- LLM settings ---------------------------------------------------------


class LLMSettings(BaseModel):
    base_url: str = Field(default="https://api.openai.com/v1")
    api_key: str = ""
    model: str = "gpt-4o-mini"
    temperature: float = 0.2

    @property
    def safe_dict(self) -> dict[str, Any]:
        d = self.model_dump()
        if d.get("api_key"):
            d["api_key"] = "***"
        return d


# --- MCP servers ---------------------------------------------------------

McpTransport = Literal["stdio", "streamable_http", "sse"]


class McpServerConfig(BaseModel):
    """Single MCP server entry, mirrors langchain-mcp-adapters connection schema."""

    name: str
    enabled: bool = True
    transport: McpTransport = "stdio"

    # stdio
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)

    # streamable_http / sse
    url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)

    def to_connection(self) -> dict[str, Any]:
        """Build the connection dict expected by `MultiServerMCPClient`."""
        if self.transport == "stdio":
            conn: dict[str, Any] = {
                "transport": "stdio",
                "command": self.command or "",
                "args": list(self.args),
            }
            if self.env:
                conn["env"] = dict(self.env)
            return conn
        conn = {"transport": self.transport, "url": self.url or ""}
        if self.headers:
            conn["headers"] = dict(self.headers)
        return conn


class McpToolInfo(BaseModel):
    name: str
    description: str | None = None
    server: str
