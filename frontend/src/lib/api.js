import { fetchEventSource } from "@microsoft/fetch-event-source";

const BASE = "/api";

async function jfetch(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Sessions
  listSessions: () => jfetch("/sessions"),
  createSession: (title) =>
    jfetch("/sessions", { method: "POST", body: JSON.stringify({ title }) }),
  getSession: (id) => jfetch(`/sessions/${id}`),
  updateSession: (id, patch) =>
    jfetch(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteSession: (id) =>
    jfetch(`/sessions/${id}`, { method: "DELETE" }),

  // MCP
  listMcp: () => jfetch("/mcp/servers"),
  addMcp: (server) =>
    jfetch("/mcp/servers", { method: "POST", body: JSON.stringify(server) }),
  updateMcp: (name, server) =>
    jfetch(`/mcp/servers/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify(server),
    }),
  deleteMcp: (name) =>
    jfetch(`/mcp/servers/${encodeURIComponent(name)}`, { method: "DELETE" }),
  reloadMcp: () => jfetch("/mcp/reload", { method: "POST" }),
  mcpStatus: () => jfetch("/mcp/status"),

  // Settings
  getLLM: () => jfetch("/settings/llm"),
  updateLLM: (patch) =>
    jfetch("/settings/llm", { method: "PUT", body: JSON.stringify(patch) }),
  testLLM: () => jfetch("/settings/llm/test", { method: "POST" }),
};

export function streamChat(sessionId, content, handlers) {
  const ctrl = new AbortController();
  fetchEventSource(BASE + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ session_id: sessionId, content }),
    signal: ctrl.signal,
    openWhenHidden: true,
    onmessage(ev) {
      if (!ev.event) return;
      let data = {};
      try {
        data = ev.data ? JSON.parse(ev.data) : {};
      } catch (_) {
        data = { raw: ev.data };
      }
      handlers[ev.event]?.(data);
    },
    onerror(err) {
      handlers.error?.({ message: err?.message || "stream error" });
      throw err; // stop retrying
    },
    onclose() {
      handlers.close?.();
    },
  });
  return () => ctrl.abort();
}
