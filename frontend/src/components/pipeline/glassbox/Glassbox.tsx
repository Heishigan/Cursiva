"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./glassbox.module.css";

/* Live view of the agents at work ("Glassbox").
 *
 * Driven by the backend's structured events (see backend/progress.py):
 *   {type: "stage", agent, state, summary, facts}
 *   {type: "draft", doc: "cv" | "letter", content}
 * Everything shown is real output: the documents are revealed piece by piece
 * once their draft arrives, and lines that differ from the user's original CV
 * are highlighted. Nothing is simulated.
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

interface CvItem { title?: string; subtitle?: string; date?: string; context?: string; bullets?: string[] }
interface CvSection { title?: string; type?: string; items?: CvItem[] }
export interface CvDoc { professional_summary?: string; sections?: CvSection[]; personal_info?: { name?: string } }
export interface LetterDoc { salutation?: string; hook?: string; match?: string; curiosity?: string; fit?: string; sign_off?: string }

const LABELS: Record<AgentId, string> = {
  reader: "Reader",
  strategist: "Strategist",
  cv: "CV writer",
  checker: "Checker",
  letter: "Letter writer",
};

const PHASE_AGENTS: Record<"intake" | "tailor", AgentId[]> = {
  intake: ["reader", "strategist"],
  tailor: ["cv", "checker", "letter"],
};

const WAITING: Record<AgentId, string> = {
  reader: "Getting ready to read the job ad",
  strategist: "Waiting for the job ad",
  cv: "Getting ready",
  checker: "Waiting for the CV draft",
  letter: "Waiting for the checked CV",
};

const norm = (s?: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

type Block =
  | { kind: "summary"; text: string; changed: boolean }
  | { kind: "section"; text: string }
  | { kind: "item"; text: string; sub: string }
  | { kind: "bullet"; text: string; changed: boolean };

function cvBlocks(cv: CvDoc | undefined, generic: CvDoc | null): Block[] {
  if (!cv) return [];
  const original = new Set(
    (generic?.sections || []).flatMap((s) => (s.items || []).flatMap((i) => (i.bullets || []).map(norm)))
  );
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
  return blocks;
}

const LETTER_KEYS: (keyof LetterDoc)[] = ["salutation", "hook", "match", "curiosity", "fit", "sign_off"];

/** Reveal `total` items one at a time; restarts whenever `resetKey` changes. */
function useReveal(total: number, resetKey: string, stepMs: number) {
  const [st, setSt] = useState({ key: resetKey, shown: 0 });
  const shown = st.key === resetKey ? st.shown : 0; // a new key restarts the reveal
  useEffect(() => {
    if (shown >= total) return;
    const t = setTimeout(() => setSt({ key: resetKey, shown: shown + 1 }), stepMs);
    return () => clearTimeout(t);
  }, [shown, total, stepMs, resetKey]);
  return Math.min(shown, total);
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

export default function Glassbox({
  phase,
  stages,
  drafts,
  genericCv,
  company,
  role,
}: {
  phase: "intake" | "tailor";
  stages: Stages;
  drafts: { cv?: CvDoc; letter?: LetterDoc };
  genericCv: CvDoc | null;
  company?: string;
  role?: string;
}) {
  const agents = PHASE_AGENTS[phase];
  const readerFacts = (stages.reader?.facts || {}) as { company?: string; role?: string; requirements?: string[] };
  const title = [role || readerFacts.role, company || readerFacts.company].filter(Boolean).join(" · ");

  // One plain sentence: the newest working step, else the newest finished one.
  const statusLine = useMemo(() => {
    const working = [...agents].reverse().find((a) => stages[a]?.state === "working" || stages[a]?.state === "retry");
    if (working) return `${LABELS[working]}: ${stages[working]!.summary}`;
    const last = [...agents].reverse().find((a) => stages[a]);
    if (last) return `${LABELS[last]}: ${stages[last]!.summary}`;
    return phase === "intake" ? "Starting up" : "Starting the writers";
  }, [agents, stages, phase]);

  // ---- CV paper ----
  const blocks = useMemo(() => cvBlocks(drafts.cv, genericCv), [drafts.cv, genericCv]);
  const cvRevision = String((stages.cv?.facts as { revision?: number } | undefined)?.revision ?? 1);
  const shownCv = useReveal(blocks.length, `cv-${cvRevision}-${blocks.length > 0}`, 70);
  const cvPaperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cvPaperRef.current?.querySelector("[data-last='true']");
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [shownCv]);

  // ---- Letter paper ----
  const letterParts = LETTER_KEYS.map((k) => (drafts.letter?.[k] || "").trim()).filter(Boolean);
  const shownLetter = useReveal(letterParts.length, `letter-${letterParts.length > 0}`, 380);

  const cvState = stages.cv?.state;
  const checker = stages.checker?.state;
  const letterState = stages.letter?.state;
  const cvWriting = cvState === "working" && (!drafts.cv || cvRevision !== "1");
  const checking = checker === "working";

  // Mobile: one paper at a time; follow whichever is active.
  const [tabChoice, setTab] = useState<"cv" | "letter" | null>(null);
  const tab = tabChoice ?? (letterState ? "letter" : "cv");

  return (
    <section className={styles.wrap} aria-label="Agents at work">
      <header className={styles.header}>
        {title && <div className={styles.eyebrow}>{title}</div>}
        <h2 className={styles.title}>{phase === "intake" ? "Reading the job" : "Your application is taking shape"}</h2>
      </header>

      <div className={styles.statusRow}>
        <p className={styles.status} aria-live="polite">{statusLine}</p>
        <ol className={styles.steps}>
          {agents.map((a) => {
            const s = stages[a]?.state;
            const cls = s === "done" ? styles.stepDone : s === "failed" ? styles.stepFailed : s ? styles.stepActive : "";
            return (
              <li key={a} className={`${styles.step} ${cls}`}>
                <span className={styles.stepDot} aria-hidden="true" />
                <span>{LABELS[a]}</span>
                <span className={styles.srOnly}>{s ? `: ${s}` : ": waiting"}</span>
              </li>
            );
          })}
        </ol>
      </div>

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
              <Skeleton lines={LETTER_SKELETON} live={stages.reader?.state === "working"} />
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
            <article className={`${styles.paper} ${tab === "cv" ? "" : styles.paperHiddenMobile} ${cvWriting && drafts.cv ? styles.paperDim : ""}`} aria-label="Tailored CV">
              <div className={styles.paperLabel}>Tailored CV{cvRevision !== "1" ? ` · revision ${cvRevision}` : ""}</div>
              <div className={styles.paperBody} ref={cvPaperRef}>
                {drafts.cv && blocks.length > 0 ? (
                  <>
                    {genericCv?.personal_info?.name && <div className={styles.cvName}>{genericCv.personal_info.name}</div>}
                    {blocks.slice(0, shownCv).map((b, i) => {
                      const last = i === shownCv - 1 ? "true" : undefined;
                      if (b.kind === "section") return <div key={i} data-last={last} className={`${styles.cvSection} ${styles.reveal}`}>{b.text}</div>;
                      if (b.kind === "item") return <div key={i} data-last={last} className={`${styles.cvItem} ${styles.reveal}`}><span>{b.text}</span>{b.sub && <span className={styles.cvSub}>{b.sub}</span>}</div>;
                      const changed = b.changed ? styles.changed : "";
                      if (b.kind === "summary") return <p key={i} data-last={last} className={`${styles.cvSummary} ${changed} ${styles.reveal}`}>{b.text}</p>;
                      return <p key={i} data-last={last} className={`${styles.cvBullet} ${changed} ${styles.reveal}`}>{b.text}</p>;
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
              <div className={styles.paperBody}>
                {letterParts.length > 0 ? (
                  letterParts.slice(0, shownLetter).map((p, i) => (
                    <p key={i} className={`${styles.letterPara} ${styles.reveal}`}>{p}</p>
                  ))
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

      {phase === "tailor" && (
        <p className={styles.footnote}>Highlighted lines are where your CV was tailored. Everything shown is the real draft.</p>
      )}
    </section>
  );
}
