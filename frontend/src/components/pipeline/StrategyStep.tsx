import styles from '@/app/dashboard/pipeline/pipeline.module.css';
import { useState } from "react";

export default function StrategyStep({ result, jobMetadata, onSubmit }: { result: any, jobMetadata?: any, onSubmit: (answers: string) => void }) {
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

  const fitLevel = (() => {
    if (!fitAssessmentRaw) return null;
    const cleaned = cleanStrategyText(fitAssessmentRaw);
    const match = cleaned.match(/^(High Fit|Moderate Fit|Low Fit)\.?/i);
    return match ? match[1] : null;
  })();

  const fitText = (() => {
    if (!fitAssessmentRaw) return "";
    let cleaned = cleanStrategyText(fitAssessmentRaw);
    return cleaned.replace(/^(High Fit|Moderate Fit|Low Fit)\.?\s*/i, '');
  })();

  return (
    <div className={`${styles.stepContainer} ${styles.animateFadeIn} ${styles.strategyLayout}`} style={{ maxWidth: '1200px', marginBottom: '48px' }}>
      
      {/* Left Column: Assessment and Strategy */}
      <div style={{ flex: '2' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 className={styles.strategyTitle}>Strategist's Assessment</h2>
        </div>

        <div className={styles.glassPanel} style={{ marginBottom: '32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className={styles.sectionLabel} style={{ marginBottom: 0 }}>Fit Assessment</h3>
              {fitLevel && (
                <span style={{ 
                  backgroundColor: fitLevel.toLowerCase().includes('high') ? 'rgba(74,222,128,0.2)' : fitLevel.toLowerCase().includes('moderate') ? 'rgba(250,204,21,0.2)' : 'rgba(239,68,68,0.2)',
                  color: fitLevel.toLowerCase().includes('high') ? '#4ade80' : fitLevel.toLowerCase().includes('moderate') ? '#facc15' : '#ef4444',
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600
                }}>
                  {fitLevel}
                </span>
              )}
            </div>
            <p className={styles.strategyText} style={{ marginBottom: 0 }}>
              {fitText}
            </p>
          </div>
          <div>
            <h3 className={styles.sectionLabel}>Strategy Plan</h3>
            <p className={styles.strategyText} style={{ marginBottom: 0 }}>
              {cleanStrategyText(strategyPlanRaw)}
            </p>
          </div>
        </div>

        <div className={styles.glassPanel} style={{ background: 'var(--surface)' }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '16px' }}>Strategic Approach</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Select one of the proposed agent strategies to emphasize in your application, or provide your own.
            </p>
            
            <div className={styles.optionsContainer}>
              {result?.strategic_options?.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOption(option === selectedOption ? "" : option)}
                  className={`${styles.optionBtn} ${selectedOption === option ? styles.optionBtnActive : ''}`}
                >
                  <div className={`${styles.radioCircle} ${selectedOption === option ? styles.radioCircleActive : ''}`}>
                    {selectedOption === option && <div className={styles.radioDot} />}
                  </div>
                  <span>{option}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ paddingTop: '24px', marginTop: '24px', borderTop: '1px solid var(--surface-border)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Custom Instructions & Overrides
            </h3>
            <textarea
              className={styles.textarea}
              style={{ height: '128px', minHeight: 'auto', padding: '16px' }}
              placeholder="Anything else to emphasize or avoid..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={handleSubmit} disabled={!selectedOption && !customInstructions}>
            Generate Drafts &rarr;
          </button>
        </div>
      </div>

      {/* Right Column: Role at a Glance */}
      <div style={{ flex: '1' }}>
        <div className={styles.glassPanel} style={{ position: 'sticky', top: '100px', background: 'var(--surface)' }}>
          <h3 className={styles.sectionLabel} style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '12px', marginBottom: '16px' }}>
            ROLE AT A GLANCE
          </h3>
          
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Company</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {jobMetadata?.company_name || 'Unknown Company'}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Role</div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {jobMetadata?.role_name || 'Unknown Role'}
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Key Details</div>
            {jobMetadata?.job_summary && (
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '12px', opacity: 0.9 }}>
                {jobMetadata.job_summary}
              </p>
            )}
            <ul style={{ listStyleType: 'disc', paddingLeft: '16px', color: 'var(--text-primary)', fontSize: '14px', marginTop: '8px', opacity: 0.9 }}>
              {jobMetadata?.key_requirements?.map((req: string, idx: number) => (
                <li key={idx} style={{ marginBottom: '6px' }}>{req}</li>
              )) || <li>No specific requirements found.</li>}
            </ul>
          </div>

          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--surface-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Eligibility</div>
            {jobMetadata?.eligibility_passed ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
                ✓ Eligible
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
                ✕ Ineligible
              </span>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
