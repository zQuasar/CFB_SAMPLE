import { useState } from "react";

function fmt(date) {
  try {
    const d = new Date(date);
    const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onOpenSettings,
  onOpenMcp,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(s) {
    setEditingId(s.id);
    setEditValue(s.title);
  }
  async function commitEdit() {
    if (editingId && editValue.trim()) {
      await onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  }

  return (
    <aside className="w-72 shrink-0 bg-ink-900 border-r border-ink-700 flex flex-col">
      <div className="p-3 border-b border-ink-700 flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-emerald-500/90 flex items-center justify-center text-ink-900 font-bold">
          C
        </div>
        <div className="font-semibold tracking-tight">ConfBot</div>
        <button
          onClick={onNew}
          className="ml-auto px-2.5 py-1 text-xs rounded bg-ink-700 hover:bg-ink-600 transition"
          title="New chat"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-1">
        {sessions.length === 0 && (
          <div className="text-ink-400 text-xs px-2 py-3">No sessions yet.</div>
        )}
        {sessions.map((s) => {
          const active = s.id === activeId;
          return (
            <div
              key={s.id}
              className={`group rounded px-2 py-2 cursor-pointer flex items-center gap-2 ${
                active ? "bg-ink-700" : "hover:bg-ink-800"
              }`}
              onClick={() => onSelect(s.id)}
              onDoubleClick={() => startEdit(s)}
            >
              <div className="flex-1 min-w-0">
                {editingId === s.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-ink-900 border border-ink-600 rounded px-1.5 py-0.5 text-xs"
                  />
                ) : (
                  <div className="truncate font-medium">{s.title}</div>
                )}
                <div className="text-[10px] text-ink-400">
                  {fmt(s.updated_at)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${s.title}"?`)) onDelete(s.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-rose-400 text-xs px-1"
                title="Delete"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t border-ink-700 flex gap-2">
        <button
          onClick={onOpenMcp}
          className="flex-1 text-xs px-2 py-1.5 rounded bg-ink-800 hover:bg-ink-700"
        >
          MCP servers
        </button>
        <button
          onClick={onOpenSettings}
          className="flex-1 text-xs px-2 py-1.5 rounded bg-ink-800 hover:bg-ink-700"
        >
          LLM settings
        </button>
      </div>
    </aside>
  );
}
