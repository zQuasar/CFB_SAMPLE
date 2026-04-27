import { useEffect, useRef, useState } from "react";
import { api, streamChat } from "../lib/api.js";
import MessageBubble from "./MessageBubble.jsx";

export default function ChatView({ sessionId, onTitleChanged }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamTools, setStreamTools] = useState([]);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");
  const scrollRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await api.getSession(sessionId);
      if (!alive) return;
      setTitle(s.title);
      setMessages(s.messages || []);
      setError(null);
    })();
    return () => {
      alive = false;
      cancelRef.current?.();
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streamText, streamTools]);

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setStreaming(true);
    setStreamText("");
    setStreamTools([]);
    setError(null);

    cancelRef.current = streamChat(sessionId, text, {
      user_message: (msg) => {
        setMessages((m) => [...m, msg]);
      },
      token: ({ text }) => {
        setStreamText((t) => t + text);
      },
      tool: (info) => {
        setStreamTools((arr) => [...arr, info]);
      },
      assistant_message: (msg) => {
        setMessages((m) => [...m, msg]);
        setStreamText("");
        setStreamTools([]);
      },
      error: ({ message }) => {
        setError(message);
      },
      done: () => {
        setStreaming(false);
        onTitleChanged?.();
      },
      close: () => {
        setStreaming(false);
      },
    });
  }

  function handleStop() {
    cancelRef.current?.();
    setStreaming(false);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 py-3 border-b border-ink-700 flex items-center gap-3">
        <div className="font-medium truncate">{title}</div>
        <div className="ml-auto text-[11px] text-ink-400 font-mono">
          {sessionId.slice(0, 8)}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin px-5 py-6 space-y-4"
      >
        {messages.length === 0 && !streaming && (
          <div className="text-ink-400 text-center py-12">
            Start the conversation by typing a message below.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
        {streaming && (streamText || streamTools.length > 0) && (
          <MessageBubble
            msg={{
              id: "stream",
              role: "assistant",
              content: streamText,
              extra:
                streamTools.length > 0
                  ? { tool_events: streamTools }
                  : null,
            }}
            streaming
          />
        )}
        {error && (
          <div className="text-rose-400 text-sm border border-rose-500/30 bg-rose-500/10 rounded p-3">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="p-4 border-t border-ink-700 bg-ink-800"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Send a message…  (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 resize-none rounded-md bg-ink-900 border border-ink-600 focus:border-emerald-500 outline-none px-3 py-2 text-sm"
          />
          {streaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="px-4 py-2 rounded-md bg-rose-500 hover:bg-rose-400 text-ink-900 font-medium"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-ink-900 font-medium"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
