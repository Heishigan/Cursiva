import styles from './flow.module.css';
import { useState } from "react";
import type { JobMetadata, JobRequirement, StrategyResult } from "@/types/cv";

const STATUS: Record<JobRequirement["status"], { icon: string; label: string }> = {
  met: { icon: "✓", label: "In your CV" },
  partial: { icon: "~", label: "Partly in your CV" },
  missing: { icon: "✗", label: "Not in your CV" },
};
// The fit label's colour carries the verdict, so no extra text is needed.
const FIT_TONE: Record<string, string> = { strong: "fitGood", good: "fitGood", stretch: "fitStretch", unlikely: "fitUnlikely" };

export default function StrategyStep({ result, jobMetadata, onSubmit }: { result: StrategyResult | null, jobMetadata?: JobMetadata | null, onSubmit: (answers: string, writeLetter?: boolean) => void }) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState("");
  // Pipeline v2: the analysis of the ad, and whether to write a letter (off when the ad says not to send one).
  const analysis = result?.analysis;
  const [writeLetter, setWriteLetter] = useState<boolean>(analysis ? analysis.write_letter_default : true);

  const handleSubmit = () => {
    const finalAnswers = `Selected Strategy: ${selectedOption}\n\nCustom Instructions:\n${customInstructions}`;
    onSubmit(finalAnswers.trim(), analysis ? writeLetter : undefined);
  };

  // The LLM sometimes includes markdown headings like "**Fit Assessment:**" in the text itself.
  // We'll strip them out for a cleaner UI since we already have headers.
  const cleanStrategyText = (text: string) => {
    if (!text) return "";
    return text.replace(/\*\*[^*]+\*\*/g, '').trim();
  };

  const fitAssessmentRaw = (() => {
    if (result?.fit_assessment) return result.fit_assessment;
    const match = result?.strategy_plan?.match(/\*\*Fit Assessment:\*\*\n([\s\S]*?)\n\n\*\*Strategy Plan:\*\*/);
    return match ? match[1] : "";
  })();

  const strategyPlanRaw = (() => {
    const match = result?.strategy_plan?.match(/\*\*Strategy Plan:\*\*\n([\s\S]*)/);
    return match ? match[1] : (result?.strategy_plan || "");
  })();

  const strategicOptions = result?.strategic_options ?? [];

  const FIT_RE = /^(High Fit|Moderate Fit|Low Fit|Strong Fit|Good Fit|Stretch Fit|Unlikely Fit)\.?\s*/i;
  const fitLevel = (() => {
    if (result?.fit_label) return result.fit_label;
    if (!fitAssessmentRaw) return null;
    const cleaned = cleanStrategyText(fitAssessmentRaw);
    const match = cleaned.match(FIT_RE);
    return match ? match[1] : null;
  })();

  const fitText = (() => {
    if (!fitAssessmentRaw) return "";
    const cleaned = cleanStrategyText(fitAssessmentRaw);
    return cleaned.replace(FIT_RE, '');
  })();

  const mustHaves = (analysis?.requirements || []).filter(r => r.kind === "must");
  const fitTone = analysis ? FIT_TONE[(fitLevel || "").split(" ")[0].toLowerCase()] : undefined;
  const role = jobMetadata?.role_name || 'Unknown role';
  const company = jobMetadata?.company_name || 'Unknown company';
  const eyebrow = [jobMetadata?.role_name, jobMetadata?.company_name, jobMetadata?.company_location].filter(Boolean).join(' · ');
  const requirements: string[] = jobMetadata?.key_requirements || [];
  const plan = cleanStrategyText(strategyPlanRaw);

  return (
    <div className={`${styles.page} ${styles.wide}`} style={{ paddingTop: 44 }}>
      <header className={styles.head}>
        <h1 className={styles.title}>Pick your angle</h1>
        {eyebrow && <p className={styles.subtitle}>{eyebrow}</p>}
      </header>

      <div className={styles.strategy}>
        <article className={`${styles.paper} ${styles.adCard}`} aria-label="Job ad summary">
          <div>
            <div className={styles.adRole}>{role}</div>
            <div className={styles.adMeta}>{[company, jobMetadata?.company_location].filter(Boolean).join(' · ')}</div>
          </div>
          {jobMetadata?.job_summary && <p className={styles.adSummary}>{jobMetadata.job_summary}</p>}
          {analysis ? (
            <ul className={styles.checklist} aria-label="Must-haves, checked against your CV">
              {mustHaves.map((r, idx) => (
                <li key={idx} className={styles.checkRow}>
                  <span className={`${styles.checkIcon} ${styles[`status_${r.status}`]}`} role="img" aria-label={STATUS[r.status].label} title={STATUS[r.status].label}>{STATUS[r.status].icon}</span>
                  <span>{r.text}</span>
                </li>
              ))}
              {mustHaves.length === 0 && <li>No specific requirements found.</li>}
            </ul>
          ) : (
            <ul className={styles.reqs}>
              {requirements.length > 0 ? requirements.map((req, idx) => <li key={idx}>{req}</li>) : <li>No specific requirements found.</li>}
            </ul>
          )}
          <div className={`${styles.eligible} ${jobMetadata?.eligibility_passed ? '' : styles.ineligible}`}>
            {jobMetadata?.eligibility_passed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            )}
            {jobMetadata?.eligibility_passed ? 'Eligible to apply' : 'May not meet the eligibility requirements'}
          </div>
          {fitLevel && <div className={`${styles.stamp} ${styles.fitStamp} ${fitTone ? styles[fitTone] : ''}`}>{fitLevel}</div>}
        </article>

        <section className={styles.strategyMain}>
          {analysis && (analysis.application.cover_letter === "not_wanted" || analysis.application.questions.length > 0) && (
            <div className={styles.banner} role="note">
              <h2 className={styles.label}>This ad asks you to</h2>
              {analysis.application.cover_letter === "not_wanted" && (
                <p>Skip the cover letter.{analysis.application.cover_letter_quote ? <> The ad says: &ldquo;{analysis.application.cover_letter_quote}&rdquo;</> : null}</p>
              )}
              {analysis.application.questions.length > 0 && (
                <>
                  <p>Answer these questions in your application:</p>
                  <ul>{analysis.application.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
                </>
              )}
            </div>
          )}

          {!analysis && (
            <div className={styles.block}>
              <h2 className={styles.label}>Fit check</h2>
              <p className={styles.read}>{fitText || plan}</p>
            </div>
          )}

          {strategicOptions.length > 0 && (
            <fieldset className={styles.options}>
              <legend className={styles.label}>Choose an angle</legend>
              {strategicOptions.map((option: string, idx: number) => (
                <label key={idx} className={`${styles.option} ${selectedOption === option ? styles.optionOn : ''}`}>
                  <input
                    type="radio"
                    name="strategy-angle"
                    checked={selectedOption === option}
                    onChange={() => setSelectedOption(option)}
                    onClick={() => { if (selectedOption === option) setSelectedOption(""); }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          )}

          <div className={styles.block}>
            <label htmlFor="strategy-extra" className={styles.label}>Anything to add or avoid? (optional)</label>
            <textarea
              id="strategy-extra"
              className={styles.field}
              style={{ height: 96, resize: 'vertical' }}
              placeholder="Anything the writers should include or avoid"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />
          </div>

          {analysis && (
            <label className={styles.switchRow}>
              <input type="checkbox" checked={writeLetter} onChange={(e) => setWriteLetter(e.target.checked)} />
              <span>Write a cover letter{analysis.application.cover_letter === "not_wanted" ? " (this ad asks you not to send one)" : ""}</span>
            </label>
          )}

          <div className={styles.actions}>
            <button className={styles.btn} onClick={handleSubmit} disabled={!selectedOption && !customInstructions}>
              Write my drafts
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
