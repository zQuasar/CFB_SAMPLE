"""MCP manager: loads `mcp.json`, owns the live MCP client, exposes tools."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

from app.config import settings
from app.schemas import McpServerConfig, McpToolInfo

logger = logging.getLogger(__name__)


DEFAULT_MCP_FILE: dict[str, Any] = {
    "servers": [
        # Example: an in-process "fetch" server. Disabled by default. Edit the
        # mcp.json file or use the UI to enable / add servers.
        {
            "name": "fetch",
            "enabled": False,
            "transport": "stdio",
            "command": "uvx",
            "args": ["mcp-server-fetch"],
        }
    ]
}


class McpManager:
    """Owns mcp.json + the live MultiServerMCPClient.

    The manager is intentionally simple: it reloads the client whenever the
    config changes. Tool reload happens lazily on first request after a
    config change.
    """

    def __init__(self, config_path: str) -> None:
        self._config_path = Path(config_path)
        self._lock = asyncio.Lock()
        self._client: MultiServerMCPClient | None = None
        self._tools: list[BaseTool] = []
        self._tools_loaded = False
        self._load_errors: dict[str, str] = {}

    # ------- file I/O -------

    def _ensure_file(self) -> None:
        if not self._config_path.exists():
            self._config_path.parent.mkdir(parents=True, exist_ok=True)
            self._config_path.write_text(
                json.dumps(DEFAULT_MCP_FILE, indent=2), encoding="utf-8"
            )

    def read_config(self) -> list[McpServerConfig]:
        self._ensure_file()
        raw = json.loads(self._config_path.read_text(encoding="utf-8") or "{}")
        return [McpServerConfig(**s) for s in raw.get("servers", [])]

    def write_config(self, servers: list[McpServerConfig]) -> None:
        self._config_path.write_text(
            json.dumps(
                {"servers": [s.model_dump() for s in servers]},
                indent=2,
            ),
            encoding="utf-8",
        )
        self._tools_loaded = False  # invalidate cache

    # ------- public API -------

    @property
    def load_errors(self) -> dict[str, str]:
        return dict(self._load_errors)

    async def get_tools(self) -> list[BaseTool]:
        async with self._lock:
            if not self._tools_loaded:
                await self._reload_locked()
            return list(self._tools)

    async def list_tool_info(self) -> list[McpToolInfo]:
        tools = await self.get_tools()
        info: list[McpToolInfo] = []
        for t in tools:
            server = getattr(t, "metadata", {}) or {}
            server_name = (
                server.get("server")
                if isinstance(server, dict)
                else None
            ) or "mcp"
            info.append(
                McpToolInfo(
                    name=t.name,
                    description=(t.description or "").strip() or None,
                    server=server_name,
                )
            )
        return info

    async def reload(self) -> None:
        async with self._lock:
            await self._reload_locked()

    # ------- internals -------

    async def _reload_locked(self) -> None:
        self._load_errors = {}
        configs = [s for s in self.read_config() if s.enabled]
        connections: dict[str, dict[str, Any]] = {}
        for s in configs:
            try:
                connections[s.name] = s.to_connection()
            except Exception as exc:  # pragma: no cover - defensive
                self._load_errors[s.name] = f"invalid config: {exc}"

        if not connections:
            self._client = None
            self._tools = []
            self._tools_loaded = True
            return

        try:
            client = MultiServerMCPClient(connections)
            tools = await client.get_tools()
            # tag each tool with its server (best-effort)
            for t in tools:
                meta = dict(getattr(t, "metadata", {}) or {})
                if "server" not in meta:
                    # Names are typically prefixed by server; preserve as-is.
                    meta["server"] = self._guess_server(t.name, connections)
                    try:
                        t.metadata = meta  # type: ignore[attr-defined]
                    except Exception:
                        pass
            self._client = client
            self._tools = tools
        except Exception as exc:
            logger.exception("Failed to load MCP tools: %s", exc)
            self._client = None
            self._tools = []
            self._load_errors["__global__"] = str(exc)
        self._tools_loaded = True

    @staticmethod
    def _guess_server(tool_name: str, connections: dict[str, Any]) -> str:
        for name in connections:
            if tool_name.startswith(f"{name}_") or tool_name.startswith(
                f"{name}."
            ):
                return name
        return next(iter(connections), "mcp")


mcp_manager = McpManager(settings.mcp_config_path)
