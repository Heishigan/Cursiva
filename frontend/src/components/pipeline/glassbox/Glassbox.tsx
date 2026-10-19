"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./glassbox.module.css";

/* Live view of the agents at work ("Glassbox", layout C: document assembly).
 *
 * Driven by the backend's structured events (see backend/progress.py):
 *   {type: "stage", agent, state, summary, facts}
 *   {type: "draft", doc: "cv" | "letter", content, partial?}
 * Left: one card per agent with what it is doing right now.
 * Right: the CV and cover letter, written live as the model produces them
 * (partial drafts). If the stream isn't available the finished draft is
 * revealed piece by piece instead. Lines that differ from the user's original
 * CV are highlighted. Nothing is simulated.
 */

export type AgentId = "reader" | "strategist" | "cv" | "checker" | "letter";
export type StageState = "working" | "done" | "retry" | "failed";
export interface StageEvent {
  agent: AgentId;
  state: StageState;
  summary: string;
  facts?: Record<string, unknown>;
}
export type Stages = Partial<Record<AgentId, StageEvent>>;
export type LiveDocs = { cv?: "streaming" | "done"; letter?: "streaming" | "done" };

interface CvItem { title?: string; subtitle?: string; date?: string; context?: string; bullets?: string[] }
interface CvSection { title?: string; type?: string; items?: CvItem[] }
export interface CvDoc { professional_summary?: string; sections?: CvSection[]; personal_info?: { name?: string } }
export interface LetterDoc { salutation?: string; hook?: string; match?: string; curiosity?: string; fit?: string; sign_off?: string }

const ORDER: AgentId[] = ["reader", "strategist", "cv", "checker", "letter"];

const LABELS: Record<AgentId, string> = {
  reader: "Reader",
  strategist: "Strategist",
  cv: "CV writer",
  checker: "Checker",
  letter: "Letter writer",
};

const WAITING: Record<AgentId, string> = {
  reader: "Getting ready to read the job ad",
  strategist: "Waiting for the job ad",
  cv: "Waiting for a handover",
  checker: "Waiting for the CV draft",
  letter: "Waiting for the checked CV",
};

const norm = (s?: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

type Block =
  | { kind: "summary"; text: string; changed: boolean }
  | { kind: "section"; text: string }
  | { kind: "item"; text: string; sub: string }
  | { kind: "bullet"; text: string; changed: boolean };

function cvBlocks(cv: CvDoc | undefined, generic: CvDoc | null, streaming: boolean): Block[] {
  if (!cv) return [];
  const originals = (generic?.sections || []).flatMap((s) => (s.items || []).flatMap((i) => (i.bullets || []).map(norm)));
  const original = new Set(originals);
  const blocks: Block[] = [];
  if (cv.professional_summary) {
    blocks.push({ kind: "summary", text: cv.professional_summary, changed: norm(cv.professional_summary) !== norm(generic?.professional_summary) });
  }
  for (const sec of cv.sections || []) {
    blocks.push({ kind: "section", text: sec.title || "" });
    for (const it of sec.items || []) {
      blocks.push({ kind: "item", text: it.title || "", sub: [it.subtitle, it.date].filter(Boolean).join(" · ") });
      for (const b of it.bullets || []) blocks.push({ kind: "bullet", text: b, changed: !original.has(norm(b)) });
    }
  }
  // While a bullet is still being written it is only a prefix: don't flag it
  // as changed until it stops matching the start of an original bullet.
  const last = blocks[blocks.length - 1];
  if (streaming && last?.kind === "bullet" && last.changed) {
    const t = norm(last.text);
    last.changed = !originals.some((o) => o.startsWith(t));
  }
  if (streaming && last?.kind === "summary" && last.changed) {
    last.changed = !norm(generic?.professional_summary).startsWith(norm(last.text));
  }
  return blocks;
}

const LETTER_KEYS: (keyof LetterDoc)[] = ["salutation", "hook", "match", "curiosity", "fit", "sign_off"];

/** Reveal `total` items one at a time; restarts whenever `resetKey` changes. */
function useReveal(total: number, resetKey: string, stepMs: number, instant: boolean) {
  const [st, setSt] = useState({ key: resetKey, shown: 0 });
  const shown = st.key === resetKey ? st.shown : 0; // a new key restarts the reveal
  useEffect(() => {
    if (instant || shown >= total) return;
    const t = setTimeout(() => setSt({ key: resetKey, shown: shown + 1 }), stepMs);
    return () => clearTimeout(t);
  }, [shown, total, stepMs, resetKey, instant]);
  return instant ? total : Math.min(shown, total);
}

function Skeleton({ lines, live }: { lines: number[]; live: boolean }) {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      {lines.map((w, i) => (
        <div key={i} className={`${styles.skLine} ${live ? styles.skLive : ""}`} style={{ width: `${w}%`, animationDelay: `${(i % 6) * 0.12}s` }} />
      ))}
    </div>
  );
}

const CV_SKELETON = [55, 0, 96, 90, 62, 0, 40, 92, 86, 94, 70, 0, 40, 88, 96, 64, 0, 36, 80, 58];
const LETTER_SKELETON = [34, 0, 96, 92, 88, 60, 0, 94, 90, 96, 72, 0, 92, 88, 54, 0, 30, 24];

function sentence(ev: StageEvent | undefined, agent: AgentId) {
  if (!ev) return WAITING[agent];
  if (ev.state === "done") return `Done · ${ev.summary}`;
  if (ev.state === "failed") return ev.summary;
  return `“${ev.summary}”`;
}

function AgentCards({ stages, phase }: { stages: Stages; phase: "intake" | "tailor" }) {
  return (
    <ol className={styles.agents} aria-label="Agents">
      {ORDER.map((a) => {
        const ev = stages[a];
        // In the tailor phase the reader and strategist have already finished.
        const st = ev?.state ?? (phase === "tailor" && (a === "reader" || a === "strategist") ? "done" : undefined);
        const cls = !st ? styles.agentIdle
          : st === "done" ? styles.agentDone
          : st === "failed" ? styles.agentFailed
          : styles.agentWorking;
        const say = !ev && st === "done" ? "Done" : sentence(ev, a);
        return (
          <li key={a} className={`${styles.agent} ${cls}`}>
            <span className={styles.avatar} aria-hidden="true">{LABELS[a].charAt(0)}</span>
            <span className={styles.agentText}>
              <span className={styles.agentName}>{LABELS[a]}</span>
              <span className={styles.agentSay}>{say}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Glassbox({
  phase,
  stages,
  drafts,
  live = {},
  genericCv,
  company,
  role,
}: {
  phase: "intake" | "tailor";
  stages: Stages;
  drafts: { cv?: CvDoc; letter?: LetterDoc };
  live?: LiveDocs;
  genericCv: CvDoc | null;
  company?: string;
  role?: string;
}) {
  const readerFacts = (stages.reader?.facts || {}) as { company?: string; role?: string; requirements?: string[] };
  const title = [role || readerFacts.role, company || readerFacts.company].filter(Boolean).join(" · ");

  // One plain sentence for screen readers and the mobile view.
  const statusLine = useMemo(() => {
    const working = [...ORDER].reverse().find((a) => stages[a]?.state === "working" || stages[a]?.state === "retry");
    if (working) return `${LABELS[working]}: ${stages[working]!.summary}`;
    const last = [...ORDER].reverse().find((a) => stages[a]);
    if (last) return `${LABELS[last]}: ${stages[last]!.summary}`;
    return phase === "intake" ? "Starting up" : "Starting the writers";
  }, [stages, phase]);

  const cvState = stages.cv?.state;
  const checker = stages.checker?.state;
  const letterState = stages.letter?.state;
  const cvStreaming = live.cv === "streaming";
  const letterStreaming = live.letter === "streaming";

  // ---- CV paper ----
  const blocks = useMemo(() => cvBlocks(drafts.cv, genericCv, cvStreaming), [drafts.cv, genericCv, cvStreaming]);
  const cvRevision = String((stages.cv?.facts as { revision?: number } | undefined)?.revision ?? 1);
  const shownCv = useReveal(blocks.length, `cv-${cvRevision}-${blocks.length > 0}`, 70, !!live.cv);
  const cvTextLen = blocks.slice(0, shownCv).reduce((n, b) => n + b.text.length, 0);
  const cvPaperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cvPaperRef.current?.querySelector("[data-last='true']");
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cvTextLen]);

  // ---- Letter paper ----
  const letterParts = LETTER_KEYS.map((k) => (drafts.letter?.[k] || "").trim()).filter(Boolean);
  const shownLetter = useReveal(letterParts.length, `letter-${letterParts.length > 0}`, 380, !!live.letter);
  const letterTextLen = letterParts.reduce((n, p) => n + p.length, 0);
  const letterPaperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = letterPaperRef.current?.querySelector("[data-last='true']");
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [letterTextLen]);

  // A revision is under way but its new text hasn't started arriving yet.
  const cvWaitingForRewrite = cvState === "working" && !!drafts.cv && !cvStreaming && cvRevision !== "1";
  const checking = checker === "working";

  // Mobile: one paper at a time; follow whichever is active.
  const [tabChoice, setTab] = useState<"cv" | "letter" | null>(null);
  const tab = tabChoice ?? (letterState ? "letter" : "cv");

  const caret = <span className={styles.caret} aria-hidden="true" />;

  return (
    <section className={styles.wrap} aria-label="Agents at work">
      <header className={styles.header}>
        {title && <div className={styles.eyebrow}>{title}</div>}
        <h2 className={styles.title}>{phase === "intake" ? "Reading the job" : "Watch your documents take shape"}</h2>
      </header>

      <div className={styles.stage}>
        <aside className={styles.side}>
          <AgentCards stages={stages} phase={phase} />
          <p className={styles.status} aria-live="polite">{statusLine}</p>
        </aside>

        <div className={styles.board}>
          {phase === "intake" ? (
            <div className={styles.papers}>
              <article className={`${styles.paper} ${styles.paperSingle}`} aria-label="Job ad">
                <div className={styles.paperLabel}>Job ad</div>
                {stages.reader?.state === "done" && (readerFacts.requirements || []).length > 0 ? (
                  <ul className={styles.reqList}>
                    {(readerFacts.requirements || []).map((r, i) => (
                      <li key={i} className={styles.reveal} style={{ animationDelay: `${i * 0.12}s` }}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.paperBody}><Skeleton lines={LETTER_SKELETON} live={stages.reader?.state === "working"} /></div>
                )}
                {stages.strategist?.state === "working" && <div className={styles.scan} aria-hidden="true" />}
                {stages.strategist?.state === "done" && (
                  <div className={`${styles.stamp} ${styles.stampOn}`}>{String((stages.strategist.facts as { fit?: string })?.fit || "Analysed")}</div>
                )}
              </article>
            </div>
          ) : (
            <>
              <div className={styles.tabs} role="tablist" aria-label="Documents">
                <button role="tab" aria-selected={tab === "cv"} className={`${styles.tab} ${tab === "cv" ? styles.tabOn : ""}`} onClick={() => setTab("cv")}>CV</button>
                <button role="tab" aria-selected={tab === "letter"} className={`${styles.tab} ${tab === "letter" ? styles.tabOn : ""}`} onClick={() => setTab("letter")}>Cover letter</button>
              </div>
              <div className={styles.papers}>
                <article className={`${styles.paper} ${tab === "cv" ? "" : styles.paperHiddenMobile} ${cvWaitingForRewrite ? styles.paperDim : ""}`} aria-label="Tailored CV">
                  <div className={styles.paperLabel}>Tailored CV{cvRevision !== "1" ? ` · revision ${cvRevision}` : ""}</div>
                  <div className={styles.paperBody} ref={cvPaperRef}>
                    {drafts.cv && blocks.length > 0 ? (
                      <>
                        {genericCv?.personal_info?.name && <div className={styles.cvName}>{genericCv.personal_info.name}</div>}
                        {blocks.slice(0, shownCv).map((b, i) => {
                          const isLast = i === shownCv - 1;
                          const last = isLast ? "true" : undefined;
                          const anim = live.cv ? "" : styles.reveal;
                          const c = isLast && cvStreaming ? caret : null;
                          if (b.kind === "section") return <div key={i} data-last={last} className={`${styles.cvSection} ${anim}`}>{b.text}{c}</div>;
                          if (b.kind === "item") return <div key={i} data-last={last} className={`${styles.cvItem} ${anim}`}><span>{b.text}{c}</span>{b.sub && <span className={styles.cvSub}>{b.sub}</span>}</div>;
                          const changed = b.changed ? styles.changed : "";
                          if (b.kind === "summary") return <p key={i} data-last={last} className={`${styles.cvSummary} ${changed} ${anim}`}>{b.text}{c}</p>;
                          return <p key={i} data-last={last} className={`${styles.cvBullet} ${changed} ${anim}`}>{b.text}{c}</p>;
                        })}
                      </>
                    ) : (
                      <Skeleton lines={CV_SKELETON} live={cvState === "working"} />
                    )}
                  </div>
                  {checking && <div className={styles.scan} aria-hidden="true" />}
                  {checker === "retry" && <div className={styles.note}>{stages.checker!.summary}</div>}
                  <div className={`${styles.stamp} ${checker === "done" ? styles.stampOn : ""}`} aria-hidden={checker !== "done"}>Checked</div>
                </article>

                <article className={`${styles.paper} ${tab === "letter" ? "" : styles.paperHiddenMobile} ${!letterState ? styles.paperIdle : ""}`} aria-label="Cover letter">
                  <div className={styles.paperLabel}>Cover letter</div>
                  <div className={styles.paperBody} ref={letterPaperRef}>
                    {letterParts.length > 0 ? (
                      letterParts.slice(0, shownLetter).map((p, i) => {
                        const isLast = i === shownLetter - 1;
                        return (
                          <p key={i} data-last={isLast ? "true" : undefined} className={`${styles.letterPara} ${live.letter ? "" : styles.reveal}`}>
                            {p}{isLast && letterStreaming ? caret : null}
                          </p>
                        );
                      })
                    ) : (
                      <>
                        <Skeleton lines={LETTER_SKELETON} live={letterState === "working"} />
                        {!letterState && <div className={styles.waiting}>{WAITING.letter}</div>}
                      </>
                    )}
                  </div>
                </article>
              </div>
            </>
          )}
        </div>
      </div>

      {phase === "tailor" && (
        <p className={styles.footnote}>Highlighted lines are where your CV was tailored. Everything shown is the real draft as it is written.</p>
      )}
    </section>
  );
}
