import { useState } from "react";

function ToolEvent({ ev }) {
  const [open, setOpen] = useState(false);
  const isEnd = ev.status === "end";
  return (
    <div className="text-xs border border-ink-600 rounded mt-2 bg-ink-900/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-2 py-1.5 flex items-center gap-2"
      >
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isEnd ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
          }`}
        />
        <span className="font-mono truncate">{ev.name}</span>
        <span className="ml-auto text-ink-400">
          {isEnd ? "done" : "running"} {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <pre className="px-2 pb-2 text-[11px] text-ink-300 whitespace-pre-wrap break-words">
{JSON.stringify(ev.input ?? ev.output ?? {}, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function MessageBubble({ msg, streaming }) {
  const isUser = msg.role === "user";
  const tools = msg.extra?.tool_events || [];
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-emerald-600/90 text-white rounded-br-sm"
            : "bg-ink-700 text-ink-50 rounded-bl-sm"
        }`}
      >
        <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
          {isUser ? "You" : "Assistant"}
          {streaming && " · streaming…"}
        </div>
        <div className="prose-chat whitespace-pre-wrap break-words text-sm leading-relaxed">
          {msg.content || (streaming ? "…" : "")}
        </div>
        {tools.length > 0 && (
          <div className="mt-1">
            {tools.map((ev, i) => (
              <ToolEvent key={i} ev={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
