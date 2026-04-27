import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../lib/api.js";

const EMPTY = {
  name: "",
  enabled: true,
  transport: "stdio",
  command: "",
  args: [],
  env: {},
  url: "",
  headers: {},
};

export default function McpModal({ onClose }) {
  const [servers, setServers] = useState([]);
  const [tools, setTools] = useState([]);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null); // {original, draft, isNew}
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);

  async function refresh() {
    const [list, status] = await Promise.all([
      api.listMcp(),
      api.mcpStatus(),
    ]);
    setServers(list);
    setTools(status.tools || []);
    setErrors(status.errors || {});
  }

  useEffect(() => {
    refresh();
  }, []);

  function startNew() {
    setEditing({ original: null, draft: { ...EMPTY }, isNew: true });
  }
  function startEdit(s) {
    setEditing({ original: s.name, draft: { ...s }, isNew: false });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = sanitize(editing.draft);
      if (editing.isNew) {
        await api.addMcp(payload);
      } else {
        await api.updateMcp(editing.original, payload);
      }
      setEditing(null);
      await refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(name) {
    if (!confirm(`Remove MCP server "${name}"?`)) return;
    await api.deleteMcp(name);
    await refresh();
  }

  async function reload() {
    setReloading(true);
    try {
      await api.reloadMcp();
      await refresh();
    } finally {
      setReloading(false);
    }
  }

  return (
    <Modal
      title="MCP servers"
      onClose={onClose}
      wide
      footer={
        <>
          <button
            onClick={reload}
            disabled={reloading}
            className="px-3 py-1.5 rounded bg-ink-700 hover:bg-ink-600 text-sm disabled:opacity-50"
          >
            {reloading ? "Reloading…" : "Reload"}
          </button>
          <button
            onClick={startNew}
            className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-ink-900 font-medium text-sm"
          >
            + Add server
          </button>
        </>
      }
    >
      {editing ? (
        <Editor
          editing={editing}
          setEditing={setEditing}
          onCancel={() => setEditing(null)}
          onSave={save}
          saving={saving}
        />
      ) : (
        <List
          servers={servers}
          tools={tools}
          errors={errors}
          onEdit={startEdit}
          onRemove={remove}
        />
      )}
    </Modal>
  );
}

function List({ servers, tools, errors, onEdit, onRemove }) {
  return (
    <div className="space-y-4">
      {Object.keys(errors).length > 0 && (
        <div className="text-xs border border-rose-500/40 bg-rose-500/10 text-rose-200 rounded p-2">
          <div className="font-semibold mb-1">Load errors</div>
          {Object.entries(errors).map(([k, v]) => (
            <div key={k} className="font-mono">
              {k}: {v}
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-ink-400">
        {tools.length} tool(s) currently available to the agent.
      </div>
      {servers.length === 0 && (
        <div className="text-ink-400 text-sm py-6 text-center border border-dashed border-ink-600 rounded">
          No MCP servers configured. Click <b>+ Add server</b> to add one.
        </div>
      )}
      <div className="space-y-2">
        {servers.map((s) => {
          const serverTools = tools.filter((t) => t.server === s.name);
          return (
            <div
              key={s.name}
              className="border border-ink-600 rounded p-3 bg-ink-900/40"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    s.enabled ? "bg-emerald-400" : "bg-ink-500"
                  }`}
                />
                <div className="font-medium">{s.name}</div>
                <span className="text-[10px] uppercase text-ink-400 px-1.5 py-0.5 border border-ink-600 rounded">
                  {s.transport}
                </span>
                <div className="ml-auto flex gap-1">
                  <button
                    onClick={() => onEdit(s)}
                    className="text-xs px-2 py-1 rounded bg-ink-700 hover:bg-ink-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onRemove(s.name)}
                    className="text-xs px-2 py-1 rounded bg-ink-700 hover:bg-rose-500/20 text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="mt-1 text-xs text-ink-300 font-mono break-all">
                {s.transport === "stdio"
                  ? `${s.command || "(no command)"} ${s.args?.join(" ") || ""}`
                  : s.url || "(no url)"}
              </div>
              {serverTools.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {serverTools.map((t) => (
                    <span
                      key={t.name}
                      title={t.description || ""}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-700 text-ink-200"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Editor({ editing, setEditing, onCancel, onSave, saving }) {
  const d = editing.draft;
  function set(patch) {
    setEditing({ ...editing, draft: { ...d, ...patch } });
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Name"
          value={d.name}
          onChange={(v) => set({ name: v })}
          disabled={!editing.isNew}
          placeholder="e.g. fetch"
        />
        <label className="block">
          <div className="text-xs text-ink-300 mb-1">Transport</div>
          <select
            value={d.transport}
            onChange={(e) => set({ transport: e.target.value })}
            className="w-full bg-ink-900 border border-ink-600 rounded px-3 py-1.5 text-sm"
          >
            <option value="stdio">stdio (local command)</option>
            <option value="streamable_http">streamable_http (remote)</option>
            <option value="sse">sse (remote)</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={d.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        Enabled
      </label>

      {d.transport === "stdio" ? (
        <>
          <Field
            label="Command"
            value={d.command || ""}
            onChange={(v) => set({ command: v })}
            placeholder="e.g. npx, uvx, python"
          />
          <Field
            label="Args (one per line)"
            multiline
            value={(d.args || []).join("\n")}
            onChange={(v) =>
              set({
                args: v.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder={"-y\n@modelcontextprotocol/server-filesystem\n/data"}
          />
          <Field
            label="Env (KEY=value, one per line)"
            multiline
            value={Object.entries(d.env || {})
              .map(([k, v]) => `${k}=${v}`)
              .join("\n")}
            onChange={(v) => {
              const env = {};
              for (const line of v.split("\n")) {
                const idx = line.indexOf("=");
                if (idx > 0)
                  env[line.slice(0, idx).trim()] = line.slice(idx + 1);
              }
              set({ env });
            }}
            placeholder="API_TOKEN=…"
          />
        </>
      ) : (
        <>
          <Field
            label="URL"
            value={d.url || ""}
            onChange={(v) => set({ url: v })}
            placeholder="https://example.com/mcp"
          />
          <Field
            label="Headers (KEY=value, one per line)"
            multiline
            value={Object.entries(d.headers || {})
              .map(([k, v]) => `${k}=${v}`)
              .join("\n")}
            onChange={(v) => {
              const headers = {};
              for (const line of v.split("\n")) {
                const idx = line.indexOf("=");
                if (idx > 0)
                  headers[line.slice(0, idx).trim()] = line.slice(idx + 1);
              }
              set({ headers });
            }}
            placeholder="Authorization=Bearer …"
          />
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded bg-ink-700 hover:bg-ink-600 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !d.name}
          className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-ink-900 font-medium text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : editing.isNew ? "Add" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline, disabled }) {
  return (
    <label className="block">
      <div className="text-xs text-ink-300 mb-1">{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-ink-900 border border-ink-600 rounded px-3 py-1.5 text-sm font-mono resize-y"
        />
      ) : (
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-ink-900 border border-ink-600 rounded px-3 py-1.5 text-sm font-mono disabled:opacity-60"
        />
      )}
    </label>
  );
}

function sanitize(s) {
  const out = { ...s };
  if (out.transport === "stdio") {
    delete out.url;
    delete out.headers;
  } else {
    delete out.command;
    delete out.args;
    delete out.env;
  }
  return out;
}
