import styles from './flow.module.css';
import { useState, useEffect, useRef } from "react";
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { cvTemplateName } from '@/config/cvTemplates';

const CL_FIELDS: [string, string][] = [
  ["salutation", "Greeting"], ["hook", "Opening"], ["match", "Why you"],
  ["curiosity", "Why them"], ["fit", "Fit"], ["sign_off", "Sign-off"],
];
/** Open a base64 PDF data URL in a new tab. Phone browsers refuse to open
 *  data: URLs as a page (they show the raw string), but blob: URLs work. */
function openPdf(dataUrl: string) {
  try {
    const b64 = dataUrl.split(",")[1] || "";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const w = window.open(url, "_blank");
    if (!w) window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    window.open(dataUrl, "_blank");
  }
}

const Up = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>;
const Down = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const Bin = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>;

export default function WorkbenchStep({ data, jdText, onApproveAndSave, onSubmitFeedback, freeRedo = false }: { data: any, jdText: string, onApproveAndSave: (cvPdfUrl: string, clPdfUrl: string, cvData: any, clData: any) => void, onSubmitFeedback?: (feedback: string) => void, freeRedo?: boolean }) {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<"CV" | "Cover Letter" | "Job ad">("CV");
  const [view, setView] = useState<"preview" | "edit">("preview"); // small screens only
  // The design comes from Settings: the server compiles with it and says which one it
  // used, and it is then kept in the CV data so the saved application keeps its look.
  const [cvData, setCvData] = useState(data.cv);
  const [clData, setClData] = useState(data.cl);
  const [isSaving, setIsSaving] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  
  const [cvPdfUrl, setCvPdfUrl] = useState<string | null>(null);
  const [clPdfUrl, setClPdfUrl] = useState<string | null>(null);
  const [isCompilingCv, setIsCompilingCv] = useState(false);
  const [isCompilingCl, setIsCompilingCl] = useState(false);
  const [cvCompileError, setCvCompileError] = useState<string | null>(null);
  const [clCompileError, setClCompileError] = useState<string | null>(null);

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
    setCvCompileError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/compile_cv`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(cvPayload)
      });
      const data = await res.json();
      if (!res.ok) {
         setCvCompileError(data.detail || "CV compilation failed (LaTeX error). Check for weird characters.");
         setCvPdfUrl(null);
         return;
      }
      setCvPdfUrl(`data:application/pdf;base64,${data.pdf_base64}`);
      if (data.template) setCvData((prev: typeof data.cv) => (prev.template === data.template ? prev : { ...prev, template: data.template }));
    } catch (e: any) {
      console.error(e);
      setCvCompileError(e.message || "Failed to contact backend.");
      setCvPdfUrl(null);
    } finally {
      setIsCompilingCv(false);
    }
  };

  const compileCl = async (clPayload: any) => {
    setIsCompilingCl(true);
    setClCompileError(null);
    try {
      const token = await getToken();
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
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          personal_info: cvData.personal_info,
          company_name: data.company || "",
          company_location: clPayload.company_location || "Sweden",
          cover_letter_paragraphs: paragraphs,
          template: cvData.template
        })
      });
      const resData = await res.json();
      if (!res.ok) {
         setClCompileError(resData.detail || "CL compilation failed (LaTeX error). Check for weird characters.");
         setClPdfUrl(null);
         return;
      }
      setClPdfUrl(`data:application/pdf;base64,${resData.pdf_base64}`);
    } catch (e: any) {
      console.error(e);
      setClCompileError(e.message || "Failed to contact backend.");
      setClPdfUrl(null);
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

  const handleContextChange = (sIdx: number, iIdx: number, value: string) => {
    const newCv = { ...cvData, sections: cvData.sections.map((sec: any, si: number) => si !== sIdx ? sec : {
      ...sec, items: sec.items.map((it: any, ii: number) => ii !== iIdx ? it : { ...it, context: value }) }) };
    setCvData(newCv);
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCv(newCv), 1000);
  };

  const handleBulletChange = (sIdx: number, iIdx: number, bIdx: number, value: string) => {
    const newCv = { ...cvData, sections: cvData.sections.map((sec: any, si: number) => si !== sIdx ? sec : {
      ...sec, items: sec.items.map((it: any, ii: number) => ii !== iIdx ? it : {
        ...it, bullets: it.bullets.map((b: string, bi: number) => bi === bIdx ? value : b) }) }) };
    setCvData(newCv);
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCv(newCv), 1000);
  };

  const moveSection = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === cvData.sections.length - 1) return;
    const newCv = { ...cvData };
    const sec = newCv.sections.splice(idx, 1)[0];
    newCv.sections.splice(direction === 'up' ? idx - 1 : idx + 1, 0, sec);
    setCvData(newCv);
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCv(newCv), 1000);
  };

  const deleteSection = (idx: number) => {
    const newCv = { ...cvData };
    newCv.sections.splice(idx, 1);
    setCvData(newCv);
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCv(newCv), 1000);
  };

  const moveItem = (sIdx: number, iIdx: number, direction: 'up' | 'down') => {
    const items = cvData.sections[sIdx].items;
    if (direction === 'up' && iIdx === 0) return;
    if (direction === 'down' && iIdx === items.length - 1) return;
    const newCv = { ...cvData };
    const item = newCv.sections[sIdx].items.splice(iIdx, 1)[0];
    newCv.sections[sIdx].items.splice(direction === 'up' ? iIdx - 1 : iIdx + 1, 0, item);
    setCvData(newCv);
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCv(newCv), 1000);
  };

  const deleteItem = (sIdx: number, iIdx: number) => {
    const newCv = { ...cvData };
    newCv.sections[sIdx].items.splice(iIdx, 1);
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
      if (onSubmitFeedback) {
        onSubmitFeedback(globalFeedback);
      } else {
        alert("Lesson Extracted! Continuing to next iteration...");
      }
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
    setShowDisclaimer(true);
  };

  const proceedWithSave = async () => {
    if (!cvPdfUrl || !clPdfUrl) return;
    setShowDisclaimer(false);
    setIsSaving(true);
    try {
      await onApproveAndSave(cvPdfUrl, clPdfUrl, cvData, clData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const compiling = isCompilingCv || isCompilingCl;
  const tabs: { id: "CV" | "Cover Letter" | "Job ad"; label: string }[] = [
    { id: "CV", label: "CV" }, { id: "Cover Letter", label: "Cover letter" }, { id: "Job ad", label: "Job ad" },
  ];
  const showPreview = activeTab !== "Job ad";
  const pdfUrl = activeTab === "CV" ? cvPdfUrl : clPdfUrl;
  const compileError = activeTab === "CV" ? cvCompileError : clCompileError;
  const activeCompiling = activeTab === "CV" ? isCompilingCv : isCompilingCl;
  const eyebrow = [data.role, data.company].filter(Boolean).join(" · ");


  return (
    <div className={`${styles.page} ${styles.wide}`} style={{ height: '100%' }}>
      <header className={styles.headRow}>
        <div className={styles.head}>
          <h1 className={styles.title}>Review your drafts</h1>
          {eyebrow && <p className={styles.subtitle}>{eyebrow}</p>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={styles.seg} role="tablist" aria-label="Document">
            {tabs.map(t => (
              <button key={t.id} role="tab" aria-selected={activeTab === t.id}
                className={`${styles.segBtn} ${activeTab === t.id ? styles.segOn : ''}`}
                onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <button className={`${styles.btn} ${styles.reviewApprove}`} style={{ minHeight: 44 }} onClick={handleSaveClick} disabled={isSaving || compiling}>
            {isSaving ? "Saving…" : "Approve & save"}
          </button>
        </div>
      </header>

      {showPreview && (
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'preview' ? styles.viewOn : ''}`} aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
          <button className={`${styles.viewBtn} ${view === 'edit' ? styles.viewOn : ''}`} aria-pressed={view === 'edit'} onClick={() => setView('edit')}>Edit</button>
        </div>
      )}

      <div className={styles.review}>
        <section aria-label={activeTab === "Job ad" ? "Job ad" : "Edit"} className={`${styles.editor} ${showPreview && view === 'preview' ? styles.hideSmall : ''}`}>
          {activeTab === "CV" && (
            <>
              <div className={styles.block}>
                <label htmlFor="cv-summary" className={styles.label}>Professional summary</label>
                <textarea id="cv-summary" className={styles.edit} value={cvData.professional_summary || ""} onChange={(e) => handleCvSummaryChange(e.target.value)} />
              </div>
              {cvData.sections.map((sec: any, sIdx: number) => {
                const isSkills = sec.type === 'skills';
                return (
                  <div key={sIdx} className={styles.block}>
                    <div className={styles.secHead}>
                      <h2 className={styles.label}>{sec.title}</h2>
                      <div className={styles.iconRow}>
                        <button className={styles.icon} onClick={() => moveSection(sIdx, 'up')} disabled={sIdx === 0} aria-label={`Move ${sec.title} up`}><Up /></button>
                        <button className={styles.icon} onClick={() => moveSection(sIdx, 'down')} disabled={sIdx === cvData.sections.length - 1} aria-label={`Move ${sec.title} down`}><Down /></button>
                        <button className={`${styles.icon} ${styles.iconDanger}`} onClick={() => deleteSection(sIdx)} aria-label={`Delete ${sec.title}`}><Bin /></button>
                      </div>
                    </div>
                    {sec.items.map((item: any, iIdx: number) => {
                      let skillsList: string[] = [];
                      if (isSkills) {
                        if (item.bullets && item.bullets.length > 0) {
                          skillsList = (item.bullets.length === 1 && item.bullets[0].includes(',')) ? item.bullets[0].split(',') : item.bullets;
                        } else if (item.context) {
                          skillsList = item.context.split(',');
                        }
                      }
                      return (
                        <div key={iIdx} className={styles.item}>
                          <div className={styles.itemHead}>
                            <div>
                              <div className={styles.itemTitle}>
                                {item.url ? <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{item.title}</a> : item.title}
                              </div>
                              {(item.subtitle || item.date) && <div className={styles.itemMeta}>{item.subtitle}{item.subtitle && item.date && " · "}{item.date}</div>}
                            </div>
                            <div className={styles.iconRow}>
                              <button className={styles.icon} onClick={() => moveItem(sIdx, iIdx, 'up')} disabled={iIdx === 0} aria-label="Move up"><Up /></button>
                              <button className={styles.icon} onClick={() => moveItem(sIdx, iIdx, 'down')} disabled={iIdx === sec.items.length - 1} aria-label="Move down"><Down /></button>
                              <button className={`${styles.icon} ${styles.iconDanger}`} onClick={() => deleteItem(sIdx, iIdx)} aria-label="Delete"><Bin /></button>
                            </div>
                          </div>
                          {item.context && !isSkills && (
                            <textarea className={styles.edit} aria-label={`${item.title}, description`} value={item.context}
                              onChange={(e) => handleContextChange(sIdx, iIdx, e.target.value)} />
                          )}
                          {!isSkills && (item.bullets || []).map((b: string, bIdx: number) => (
                            <textarea key={bIdx} className={styles.edit} aria-label={`${item.title}, bullet ${bIdx + 1}`} value={b}
                              onChange={(e) => handleBulletChange(sIdx, iIdx, bIdx, e.target.value)} />
                          ))}
                          {isSkills && skillsList.length > 0 && (
                            <div className={styles.chips}>
                              {skillsList.map((b: string, bIdx: number) => b.trim() ? <span key={bIdx} className={styles.chip}>{b.trim()}</span> : null)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {activeTab === "Cover Letter" && CL_FIELDS.map(([field, label]) => (
            <div key={field} className={styles.block}>
              <label htmlFor={`cl-${field}`} className={styles.label}>{label}</label>
              <textarea id={`cl-${field}`} className={styles.edit} value={clData[field] || ""} onChange={(e) => handleClChange(field, e.target.value)} />
            </div>
          ))}

          {activeTab === "Job ad" && <p className={styles.jdText}>{jdText}</p>}
        </section>

        {showPreview && (
          <section aria-label="Preview" className={`${styles.previewCol} ${view === 'edit' ? styles.hideSmall : ''}`}>
            <div className={`${styles.paper} ${styles.previewSheet}`} aria-busy={activeCompiling}>
              {pdfUrl ? (
                <>
                  <iframe src={`${pdfUrl}#toolbar=0&view=FitH`} title={`${activeTab === "CV" ? "CV" : "Cover letter"} preview`} className={styles.previewFrame} />
                  <div className={styles.previewFallback}>
                    <p>Phone browsers can&apos;t show the PDF inline.</p>
                    <button type="button" className={styles.btn} onClick={() => openPdf(pdfUrl)}>Open {activeTab === "CV" ? "CV" : "cover letter"} preview</button>
                  </div>
                </>
              ) : compileError ? (
                <div className={styles.compileError} role="alert">
                  <strong>{activeTab === "CV" ? "CV" : "Cover letter"} didn&apos;t compile</strong>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{compileError}</span>
                  <button className={styles.ghost} style={{ color: '#1a1a1c', borderColor: '#cfccc2' }} onClick={() => activeTab === "CV" ? compileCv(cvData) : compileCl(clData)}>Try again</button>
                </div>
              ) : null}
              {(activeCompiling || (!pdfUrl && !compileError)) && (
                <div className={`${styles.throbber} ${pdfUrl ? styles.throbberOver : ''}`} role="status">
                  <span className={styles.spinner} aria-hidden="true" />
                  <span className={styles.srOnly}>{pdfUrl ? "Updating the PDF" : "Building the PDF"}</span>
                </div>
              )}
            </div>
            <div className={styles.previewNote}>
              Design: {cvTemplateName(cvData.template)} · <Link href="/dashboard/settings#design" className={styles.previewLink}>Change in Settings</Link>
            </div>
          </section>
        )}
      </div>

      <form className={styles.feedback} onSubmit={(e) => { e.preventDefault(); submitFeedback(); }}>
        <label htmlFor="global-feedback" className={styles.label} style={{ whiteSpace: 'nowrap' }}>Feedback</label>
        <input id="global-feedback" className={styles.feedbackInput} placeholder="Describe what you would like changed"
          value={globalFeedback} onChange={(e) => setGlobalFeedback(e.target.value)} />
        <button type="submit" className={styles.ghost} disabled={isSubmittingFeedback || !globalFeedback.trim()}>
          {isSubmittingFeedback ? "Redoing…" : freeRedo ? "Redo drafts (free)" : "Redo drafts · 1 credit"}
        </button>
      </form>

      {showDisclaimer && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
          <div className={`${styles.modal} ${styles.modalWarn}`}>
            <h2 id="disclaimer-title" className={styles.modalTitle}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="m9 15 2 2 4-4" />
              </svg>
              Check before you send
            </h2>
            <p className={styles.modalText}>AI can make mistakes. Read your CV and cover letter once more and make sure every detail is accurate before you save.</p>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowDisclaimer(false)}>Cancel</button>
              <button className={styles.modalConfirmWarn} onClick={proceedWithSave}>Looks good, save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
