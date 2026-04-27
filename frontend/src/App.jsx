import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ChatView from "./components/ChatView.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import McpModal from "./components/McpModal.jsx";
import { api } from "./lib/api.js";

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMcp, setShowMcp] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refreshSessions(selectId) {
    const list = await api.listSessions();
    setSessions(list);
    if (selectId) setActiveId(selectId);
    else if (!activeId && list.length > 0) setActiveId(list[0].id);
    return list;
  }

  useEffect(() => {
    (async () => {
      try {
        const list = await refreshSessions();
        if (list.length === 0) {
          const s = await api.createSession("New chat");
          await refreshSessions(s.id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewChat() {
    const s = await api.createSession("New chat");
    await refreshSessions(s.id);
  }

  async function handleDelete(id) {
    await api.deleteSession(id);
    const list = await api.listSessions();
    setSessions(list);
    if (id === activeId) {
      setActiveId(list[0]?.id ?? null);
      if (list.length === 0) {
        const s = await api.createSession("New chat");
        await refreshSessions(s.id);
      }
    }
  }

  async function handleRename(id, title) {
    await api.updateSession(id, { title });
    await refreshSessions();
  }

  return (
    <div className="flex h-full text-sm">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNewChat}
        onDelete={handleDelete}
        onRename={handleRename}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMcp={() => setShowMcp(true)}
      />
      <main className="flex-1 flex flex-col bg-ink-800 min-w-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-ink-400">
            Loading…
          </div>
        ) : activeId ? (
          <ChatView
            key={activeId}
            sessionId={activeId}
            onTitleChanged={() => refreshSessions()}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-400">
            No session
          </div>
        )}
      </main>
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
      {showMcp && <McpModal onClose={() => setShowMcp(false)} />}
    </div>
  );
}
