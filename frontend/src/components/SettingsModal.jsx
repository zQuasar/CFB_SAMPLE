import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../lib/api.js";

export default function SettingsModal({ onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({
    base_url: "",
    model: "",
    temperature: 0.2,
    api_key: "",
    has_api_key: false,
  });
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState(null);

  useEffect(() => {
    api.getLLM().then((d) => {
      setForm((f) => ({ ...f, ...d, api_key: "" }));
      setLoaded(true);
    });
  }, []);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const patch = {
        base_url: form.base_url,
        model: form.model,
        temperature: Number(form.temperature),
      };
      if (form.api_key !== "") patch.api_key = form.api_key;
      const next = await api.updateLLM(patch);
      setForm((f) => ({ ...f, ...next, api_key: "" }));
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTest({ pending: true });
    try {
      const r = await api.testLLM();
      setTest(r);
    } catch (e) {
      setTest({ ok: false, error: e.message });
    }
  }

  return (
    <Modal
      title="LLM settings"
      onClose={onClose}
      footer={
        <>
          <button
            onClick={runTest}
            className="px-3 py-1.5 rounded bg-ink-700 hover:bg-ink-600 text-sm"
          >
            Test connection
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-ink-900 font-medium text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {!loaded ? (
        <div className="text-ink-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-ink-400">
            ConfBot uses any OpenAI-compatible endpoint. Works with OpenAI,
            Azure, vLLM, LM Studio, Ollama (OpenAI-compat), OpenRouter, etc.
          </p>
          <Field
            label="Base URL"
            value={form.base_url}
            onChange={(v) => update("base_url", v)}
            placeholder="https://api.openai.com/v1"
          />
          <Field
            label="Model"
            value={form.model}
            onChange={(v) => update("model", v)}
            placeholder="gpt-4o-mini"
          />
          <Field
            label="Temperature"
            type="number"
            value={form.temperature}
            onChange={(v) => update("temperature", v)}
            placeholder="0.2"
          />
          <Field
            label={`API key${form.has_api_key ? " (set — leave blank to keep)" : ""}`}
            value={form.api_key}
            onChange={(v) => update("api_key", v)}
            type="password"
            placeholder={
              form.has_api_key ? "•••••• stored" : "sk-…  (or 'not-needed')"
            }
          />
          {test && (
            <div
              className={`mt-3 text-xs rounded p-2 border ${
                test.pending
                  ? "border-ink-600 text-ink-300"
                  : test.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200"
              }`}
            >
              {test.pending
                ? "Testing…"
                : test.ok
                ? `OK · ${test.model}: ${String(test.reply).slice(0, 200)}`
                : `Failed: ${test.error}`}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="text-xs text-ink-300 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-ink-900 border border-ink-600 focus:border-emerald-500 outline-none rounded px-3 py-1.5 text-sm font-mono"
      />
    </label>
  );
}
