"""MCP server CRUD + tool listing.

The on-disk `mcp.json` is the source of truth; this router reads/writes it
and asks the manager to reload after every mutation.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent.mcp_manager import mcp_manager
from app.schemas import McpServerConfig, McpToolInfo

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


@router.get("/servers", response_model=list[McpServerConfig])
async def list_servers():
    return mcp_manager.read_config()


@router.post("/servers", response_model=McpServerConfig)
async def add_server(server: McpServerConfig):
    servers = mcp_manager.read_config()
    if any(s.name == server.name for s in servers):
        raise HTTPException(409, f"Server '{server.name}' already exists")
    _validate(server)
    servers.append(server)
    mcp_manager.write_config(servers)
    await mcp_manager.reload()
    return server


@router.put("/servers/{name}", response_model=McpServerConfig)
async def update_server(name: str, server: McpServerConfig):
    servers = mcp_manager.read_config()
    found = False
    for i, s in enumerate(servers):
        if s.name == name:
            _validate(server)
            servers[i] = server
            found = True
            break
    if not found:
        raise HTTPException(404, f"Server '{name}' not found")
    mcp_manager.write_config(servers)
    await mcp_manager.reload()
    return server


@router.delete("/servers/{name}", status_code=204)
async def delete_server(name: str):
    servers = mcp_manager.read_config()
    new = [s for s in servers if s.name != name]
    if len(new) == len(servers):
        raise HTTPException(404, f"Server '{name}' not found")
    mcp_manager.write_config(new)
    await mcp_manager.reload()
    return None


@router.post("/reload")
async def reload_mcp():
    await mcp_manager.reload()
    return {
        "ok": not mcp_manager.load_errors,
        "errors": mcp_manager.load_errors,
    }


@router.get("/tools", response_model=list[McpToolInfo])
async def list_tools():
    return await mcp_manager.list_tool_info()


@router.get("/status")
async def status():
    tools = await mcp_manager.list_tool_info()
    return {
        "tool_count": len(tools),
        "tools": [t.model_dump() for t in tools],
        "errors": mcp_manager.load_errors,
    }


def _validate(server: McpServerConfig) -> None:
    if server.transport == "stdio":
        if not server.command:
            raise HTTPException(400, "stdio servers require 'command'")
    else:
        if not server.url:
            raise HTTPException(
                400, f"{server.transport} servers require 'url'"
            )
