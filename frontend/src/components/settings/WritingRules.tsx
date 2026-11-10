"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

/* Saved writing rules: applied to every future application. The user sees,
 * adds and deletes them here; nothing is saved without their say-so. */

interface Rule { id: number; lesson: string; scope: string[] }

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function WritingRules() {
  const { getToken } = useAuth();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API}/api/lessons`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setRules(res.ok ? data.data : []);
      } catch {
        if (!cancelled) { setRules([]); setError("Couldn't load your rules."); }
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const add = async () => {
    const lesson = draft.trim();
    if (!lesson) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/lessons`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ lesson }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Rules must be 3 to 500 characters.");
      setRules(prev => [...(prev || []), data.data]);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/lessons/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok && res.status !== 404) throw new Error("Couldn't delete the rule.");
      setRules(prev => (prev || []).filter(r => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
        Rules apply to every new CV and cover letter, as preferences for tone and emphasis. They never add facts about you.
      </p>
      {rules === null ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Loading…</p>
      ) : rules.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>No saved rules yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {rules.map(r => (
            <li key={r.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", padding: "10px 12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
              <span style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{r.lesson}</span>
              <button onClick={() => remove(r.id)} aria-label={`Delete rule: ${r.lesson}`}
                style={{ flexShrink: 0, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "var(--text-secondary)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="e.g. Keep the summary to three sentences"
          aria-label="New rule"
          style={{ flex: "1 1 260px", minHeight: 40, padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "var(--text-primary)", fontSize: 14 }} />
        <button type="submit" disabled={busy || draft.trim().length < 3}
          style={{ minHeight: 40, padding: "0 16px", borderRadius: 8, border: 0, background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 600, cursor: "pointer", opacity: busy || draft.trim().length < 3 ? 0.5 : 1 }}>
          Add rule
        </button>
      </form>
      {error && <p role="alert" style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{error}</p>}
    </div>
  );
}
