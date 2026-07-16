import styles from '@/app/dashboard/pipeline/pipeline.module.css';
import { useState, useEffect, useRef } from "react";

export default function WorkbenchStep({ data, jdText, onApproveAndSave }: { data: any, jdText: string, onApproveAndSave: (cvPdfUrl: string, clPdfUrl: string, cvData: any, clData: any) => void }) {
  const [activeTab, setActiveTab] = useState("CV");
  const [cvData, setCvData] = useState(data.cv);
  const [clData, setClData] = useState(data.cl);
  const [isSaving, setIsSaving] = useState(false);
  
  const [cvPdfUrl, setCvPdfUrl] = useState<string | null>(null);
  const [clPdfUrl, setClPdfUrl] = useState<string | null>(null);
  const [isCompilingCv, setIsCompilingCv] = useState(false);
  const [isCompilingCl, setIsCompilingCl] = useState(false);

  const [globalFeedback, setGlobalFeedback] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Debounced compilation
  const compileTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initial compile
    compileCv(cvData);
    compileCl(clData);
  }, []);

  const compileCv = async (cvPayload: any) => {
    setIsCompilingCv(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/compile_cv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cvPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error("CV compilation failed");
      setCvPdfUrl(`data:application/pdf;base64,${data.pdf_base64}`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCompilingCv(false);
    }
  };

  const compileCl = async (clPayload: any) => {
    setIsCompilingCl(true);
    try {
      const paragraphs = [
        clPayload.salutation,
        clPayload.hook,
        clPayload.match,
        clPayload.curiosity,
        clPayload.fit,
        clPayload.sign_off
      ].filter(Boolean);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/compile_cl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personal_info: data.cv.personal_info,
          company_name: data.company,
          cover_letter_paragraphs: paragraphs
        })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error("CL compilation failed");
      setClPdfUrl(`data:application/pdf;base64,${resData.pdf_base64}`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCompilingCl(false);
    }
  };

  const handleCvSummaryChange = (value: string) => {
    const newCv = { ...cvData, professional_summary: value };
    setCvData(newCv);
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCv(newCv), 1000);
  };

  const handleCvChange = (sectionIdx: number, itemIdx: number, bullets: string[]) => {
    const newCv = { ...cvData };
    newCv.sections[sectionIdx].items[itemIdx].bullets = bullets;
    setCvData(newCv);

    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCv(newCv), 1000);
  };

  const handleClChange = (field: string, value: string) => {
    const newCl = { ...clData, [field]: value };
    setClData(newCl);

    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCl(newCl), 1000);
  };

  const submitFeedback = async () => {
    if (!globalFeedback.trim()) return;
    setIsSubmittingFeedback(true);
    try {
      alert("Lesson Extracted! Continuing to next iteration...");
      setGlobalFeedback("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleSaveClick = async () => {
    if (!cvPdfUrl || !clPdfUrl) {
       alert("Please wait for PDFs to compile before saving.");
       return;
    }
    setIsSaving(true);
    try {
      await onApproveAndSave(cvPdfUrl, clPdfUrl, cvData, clData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.animateFadeIn} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className={styles.tabs} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          {["CV", "Cover Letter", "Reference & Feedback"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button 
          onClick={handleSaveClick}
          disabled={isSaving || isCompilingCv || isCompilingCl}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--accent-1)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: (isSaving || isCompilingCv || isCompilingCl) ? 'not-allowed' : 'pointer',
            opacity: (isSaving || isCompilingCv || isCompilingCl) ? 0.6 : 1,
            marginBottom: '12px'
          }}
        >
          {isSaving ? "Saving..." : "Approve & Compile \u2713"}
        </button>
      </div>

      <div className={styles.workbenchLayout} style={{ flex: 1, minHeight: 0 }}>
        {/* LEFT PANE - Editor */}
        <div className={`${styles.pane} ${styles.editorPane}`}>
          
          {activeTab === "CV" && (
            <div>
              <div style={{ marginBottom: '32px' }}>
                <h3 className={styles.sectionLabel}>Professional Summary</h3>
                <textarea
                  className={styles.editorInput}
                  value={cvData.professional_summary || ""}
                  onChange={(e) => handleCvSummaryChange(e.target.value)}
                />
              </div>
              {cvData.sections.map((sec: any, sIdx: number) => (
                <div key={sIdx} style={{ marginBottom: '32px' }}>
                  <h3 className={styles.sectionLabel}>{sec.title}</h3>
                  <div>
                    {sec.items.map((item: any, iIdx: number) => (
                      <div key={iIdx} className={styles.editorSection}>
                        <div style={{ fontWeight: 500, color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>{item.title}</div>
                        {(item.subtitle || item.date) && (
                          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
                            {item.subtitle}{item.subtitle && item.date ? ' | ' : ''}{item.date}
                          </div>
                        )}
                        <textarea
                          className={styles.editorInput}
                          value={item.bullets.join("\n")}
                          onChange={(e) => handleCvChange(sIdx, iIdx, e.target.value.split('\n'))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "Cover Letter" && (
            <div>
              {["salutation", "hook", "match", "curiosity", "fit", "sign_off"].map((field) => (
                <div key={field} style={{ marginBottom: '24px' }}>
                  <h3 className={styles.sectionLabel}>{field.replace('_', ' ')}</h3>
                  <textarea
                    className={styles.editorInput}
                    value={clData[field] || ""}
                    onChange={(e) => handleClChange(field, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === "Reference & Feedback" && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '32px' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', color: 'rgba(255,255,255,0.7)', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                {jdText}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Global Feedback</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    style={{ flex: 1, background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 16px', fontSize: '14px' }}
                    placeholder="Require a structural rewrite? Tell the agent what to fix..."
                    value={globalFeedback}
                    onChange={(e) => setGlobalFeedback(e.target.value)}
                  />
                  <button
                    onClick={submitFeedback}
                    disabled={isSubmittingFeedback || !globalFeedback.trim()}
                    className={styles.secondaryBtn}
                    style={{ padding: '8px 16px' }}
                  >
                    {isSubmittingFeedback ? "Applying..." : "Apply Feedback"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE - Live Preview */}
        <div className={`${styles.pane} ${styles.previewPane}`} style={{ display: activeTab === "Reference & Feedback" ? 'none' : 'flex' }}>
          <div className={styles.badge}>
            <span className={styles.badgeItem}>
              Live Preview
            </span>
            {(isCompilingCv || isCompilingCl) && (
              <span className={`${styles.badgeItem} ${styles.badgeItemPulse}`}>
                Compiling...
              </span>
            )}
          </div>
          <div className={styles.pdfContainer}>
            {activeTab === "CV" && cvPdfUrl && (
              <iframe src={`${cvPdfUrl}#toolbar=0&view=FitH`} style={{ width: '100%', height: '100%', border: 'none' }} />
            )}
            {activeTab === "Cover Letter" && clPdfUrl && (
              <iframe src={`${clPdfUrl}#toolbar=0&view=FitH`} style={{ width: '100%', height: '100%', border: 'none' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
