# ConfBot

A self-hosted LangGraph chat agent with first-class MCP support.

- **Backend** — FastAPI + LangGraph (`create_react_agent`) + `langchain-mcp-adapters`, talking to any OpenAI-compatible LLM endpoint. Sessions and messages live in SQLite; agent state is checkpointed to a separate SQLite file.
- **Frontend** — Vite + React + Tailwind. Sidebar of chat sessions, streaming token + tool events, in-app modals for LLM and MCP configuration.
- **MCP** — `data/mcp.json` is the source of truth; the UI and REST API both edit it and hot-reload the agent's toolset.

## Project layout

```
ConfBot/
├── backend/                FastAPI + LangGraph service
│   ├── app/
│   │   ├── main.py         App factory + lifespan (DB, agent runtime, MCP warmup)
│   │   ├── config.py       Env settings (pydantic-settings)
│   │   ├── schemas.py      Pydantic request/response models
│   │   ├── db/             SQLAlchemy async engine + ORM models
│   │   ├── agent/
│   │   │   ├── graph.py    LangGraph ReAct agent + AsyncSqliteSaver lifecycle
│   │   │   ├── llm.py      OpenAI-compatible model factory + DB-backed settings
│   │   │   └── mcp_manager.py   Loads mcp.json + owns MultiServerMCPClient
│   │   └── routers/        chat (SSE), sessions, mcp, settings_routes
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               Vite + React + Tailwind UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/     Sidebar, ChatView, MessageBubble, modals
│   │   └── lib/api.js      Tiny API client + SSE streaming helper
│   ├── package.json
│   ├── nginx.conf          Production reverse-proxy to backend
│   └── Dockerfile
├── data/                   Persistent volume (SQLite + mcp.json)
│   └── mcp.json
├── docker-compose.yml
└── .env.example
```

## Quick start (Docker)

```bash
cp .env.example .env       # set LLM_API_KEY (or any OpenAI-compatible creds)
docker compose up --build
```

- UI: <http://localhost:8080>
- API: <http://localhost:8000/docs>

The first time you start, an empty session is created automatically. Open
**LLM settings** from the bottom of the sidebar to point at any
OpenAI-compatible endpoint (OpenAI, Azure, vLLM, LM Studio, Ollama
OpenAI-compat, OpenRouter, …).

### Local LLMs without an API key

For Ollama in OpenAI-compat mode:

```
Base URL: http://host.docker.internal:11434/v1
Model:    llama3.1:8b
API key:  not-needed
```

For LM Studio: `Base URL: http://host.docker.internal:1234/v1`.

## Local development

Two terminals:

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # edit as needed
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 — frontend (Vite dev server, proxies /api → :8000)
cd frontend
npm install
npm run dev                # → http://localhost:5173
```

## Configuring MCP servers

Two ways, both equivalent — they read/write the same file:

### 1. Via the UI

Click **MCP servers** in the sidebar. Add stdio (e.g. `npx`/`uvx` commands)
or remote (`streamable_http`/`sse`) servers. The agent reloads tools after
every save.

### 2. Edit `data/mcp.json`

```json
{
  "servers": [
    {
      "name": "filesystem",
      "enabled": true,
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
    },
    {
      "name": "fetch",
      "enabled": true,
      "transport": "stdio",
      "command": "uvx",
      "args": ["mcp-server-fetch"]
    },
    {
      "name": "remote-tools",
      "enabled": true,
      "transport": "streamable_http",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer …" }
    }
  ]
}
```

Then `POST /api/mcp/reload` (or click **Reload** in the MCP modal) to pick
up the changes without restarting the backend.

> The backend Docker image ships with Node + npm and `uv`/`uvx`, so the
> common `npx @modelcontextprotocol/...` and `uvx mcp-server-...` recipes
> work out of the box.

## REST API summary

| Method | Path                         | Purpose                                     |
| ------ | ---------------------------- | ------------------------------------------- |
| GET    | `/api/health`                | Liveness                                    |
| GET    | `/api/sessions`              | List chat sessions                          |
| POST   | `/api/sessions`              | Create session                              |
| GET    | `/api/sessions/{id}`         | Session + full message history              |
| PATCH  | `/api/sessions/{id}`         | Rename                                      |
| DELETE | `/api/sessions/{id}`         | Delete (cascades messages)                  |
| POST   | `/api/chat`                  | Stream a turn over SSE (events: `token`, `tool`, `assistant_message`, `done`, `error`) |
| GET    | `/api/mcp/servers`           | List MCP server configs                     |
| POST   | `/api/mcp/servers`           | Add                                         |
| PUT    | `/api/mcp/servers/{name}`    | Update                                      |
| DELETE | `/api/mcp/servers/{name}`    | Remove                                      |
| POST   | `/api/mcp/reload`            | Re-read mcp.json + reconnect                |
| GET    | `/api/mcp/tools`             | Currently-loaded tools                      |
| GET    | `/api/mcp/status`            | Tool list + load errors                     |
| GET    | `/api/settings/llm`          | LLM settings (api key redacted)             |
| PUT    | `/api/settings/llm`          | Update LLM settings (persisted to SQLite)   |
| POST   | `/api/settings/llm/test`     | Round-trip "ping" against the LLM           |

## How the agent works

1. The chat router persists the user message and opens an SSE stream.
2. `build_agent(...)` constructs `create_react_agent(model, tools, checkpointer=AsyncSqliteSaver, state_modifier=SYSTEM_PROMPT)` using the current LLM settings and the live MCP toolset.
3. `agent.astream_events(..., version="v2")` fans token + tool events into the SSE stream.
4. After the stream finishes, the assistant message + tool trace is persisted to the `messages` table for replay in the UI; the LangGraph checkpointer keeps the canonical agent state per `thread_id == session_id`.

## Persisted data

Everything in `./data/`:

- `confbot.db` — sessions, messages, runtime LLM settings (`settings_kv`)
- `checkpoints.db` — LangGraph agent checkpoints (per session)
- `mcp.json` — MCP server registry

## License

MIT
