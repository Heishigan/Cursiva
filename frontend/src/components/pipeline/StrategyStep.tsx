import styles from './flow.module.css';
import { useState } from "react";
import type { JobMetadata, StrategyResult } from "@/types/cv";

export default function StrategyStep({ result, jobMetadata, onSubmit }: { result: StrategyResult | null, jobMetadata?: JobMetadata | null, onSubmit: (answers: string) => void }) {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState("");

  const handleSubmit = () => {
    const finalAnswers = `Selected Strategy: ${selectedOption}\n\nCustom Instructions:\n${customInstructions}`;
    onSubmit(finalAnswers.trim());
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

  const fitLevel = (() => {
    if (!fitAssessmentRaw) return null;
    const cleaned = cleanStrategyText(fitAssessmentRaw);
    const match = cleaned.match(/^(High Fit|Moderate Fit|Low Fit)\.?/i);
    return match ? match[1] : null;
  })();

  const fitText = (() => {
    if (!fitAssessmentRaw) return "";
    const cleaned = cleanStrategyText(fitAssessmentRaw);
    return cleaned.replace(/^(High Fit|Moderate Fit|Low Fit)\.?\s*/i, '');
  })();

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
          <ul className={styles.reqs}>
            {requirements.length > 0 ? requirements.map((req, idx) => <li key={idx}>{req}</li>) : <li>No specific requirements found.</li>}
          </ul>
          <div className={`${styles.eligible} ${jobMetadata?.eligibility_passed ? '' : styles.ineligible}`}>
            {jobMetadata?.eligibility_passed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
            )}
            {jobMetadata?.eligibility_passed ? 'Eligible to apply' : 'May not meet the eligibility requirements'}
          </div>
          {fitLevel && <div className={`${styles.stamp} ${styles.fitStamp}`}>{fitLevel}</div>}
        </article>

        <section className={styles.strategyMain}>
          <div className={styles.block}>
            <h2 className={styles.label}>Fit check</h2>
            <p className={styles.read}>{fitText || plan}</p>
          </div>

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
