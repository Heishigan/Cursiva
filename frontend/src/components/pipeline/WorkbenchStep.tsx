import styles from '@/app/dashboard/pipeline/pipeline.module.css';
import profileStyles from '@/app/dashboard/profile/profile.module.css';
import { useState, useEffect, useRef } from "react";
import { Pencil, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

export default function WorkbenchStep({ data, jdText, onApproveAndSave, onSubmitFeedback }: { data: any, jdText: string, onApproveAndSave: (cvPdfUrl: string, clPdfUrl: string, cvData: any, clData: any) => void, onSubmitFeedback?: (feedback: string) => void }) {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("CV");
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
          company_name: data.company_name || "Company",
          cover_letter_paragraphs: paragraphs
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

  const [editingItem, setEditingItem] = useState<{sIdx: number, iIdx: number} | null>(null);

  const updateItem = (sectionIdx: number, itemIdx: number, field: string, value: any) => {
    const newCv = { ...cvData };
    newCv.sections[sectionIdx].items[itemIdx][field] = value;
    setCvData(newCv);
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCv(newCv), 1000);
  };

  const updateBulletsText = (sectionIdx: number, itemIdx: number, text: string) => {
    const bullets = text.split('\n');
    updateItem(sectionIdx, itemIdx, 'bullets', bullets);
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
                <div key={sIdx} className={profileStyles.sectionGroup} style={{ marginBottom: '32px' }}>
                  <div className={profileStyles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h2 className={profileStyles.sectionTitle} style={{ margin: 0 }}>{sec.title}</h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className={profileStyles.iconBtnSmall} onClick={() => moveSection(sIdx, 'up')} disabled={sIdx === 0} title="Move Section Up"><ArrowUp size={16} /></button>
                      <button className={profileStyles.iconBtnSmall} onClick={() => moveSection(sIdx, 'down')} disabled={sIdx === cvData.sections.length - 1} title="Move Section Down"><ArrowDown size={16} /></button>
                      <button className={profileStyles.iconBtnSmall} style={{ color: '#ef4444' }} onClick={() => deleteSection(sIdx)} title="Delete Section"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <div className={profileStyles.cardGroup} style={{ marginTop: '16px' }}>
                    {sec.items.map((item: any, iIdx: number) => {
                      const isEditing = editingItem?.sIdx === sIdx && editingItem?.iIdx === iIdx;
                      const isSkills = sec.type === 'skills';
                      
                      let skillsList: string[] = [];
                      if (isSkills) {
                        if (item.bullets && item.bullets.length > 0) {
                          skillsList = (item.bullets.length === 1 && item.bullets[0].includes(',')) 
                            ? item.bullets[0].split(',') 
                            : item.bullets;
                        } else if (item.context) {
                          skillsList = item.context.split(',');
                        }
                      }
                      
                      return isEditing ? (
                        <div key={iIdx} className={styles.card} style={{ padding: '24px', marginBottom: '16px' }}>
                          <div className={styles.itemHeader} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Editing {item.title || 'Item'}</h3>
                            <button className={styles.secondaryBtn} style={{ width: 'auto', padding: '4px 12px' }} onClick={() => setEditingItem(null)}>Done</button>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: isSkills ? '1 / -1' : 'auto' }}>
                              <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Title / Role</label>
                              <input className={styles.editorInput} value={item.title || ''} onChange={e => updateItem(sIdx, iIdx, 'title', e.target.value)} />
                            </div>
                            {!isSkills && (
                              <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Subtitle / Company</label>
                                  <input className={styles.editorInput} value={item.subtitle || ''} onChange={e => updateItem(sIdx, iIdx, 'subtitle', e.target.value)} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Date / Duration</label>
                                  <input className={styles.editorInput} value={item.date || ''} onChange={e => updateItem(sIdx, iIdx, 'date', e.target.value)} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>URL</label>
                                  <input className={styles.editorInput} value={item.url || ''} onChange={e => updateItem(sIdx, iIdx, 'url', e.target.value)} placeholder="https://..." />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: '1 / -1' }}>
                                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Context</label>
                                  <input className={styles.editorInput} value={item.context || ''} onChange={e => updateItem(sIdx, iIdx, 'context', e.target.value)} />
                                </div>
                              </>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                              {isSkills ? "Skills (Comma-separated or line-separated)" : "Bullets (One per line)"}
                            </label>
                            <textarea 
                              className={styles.editorInput} 
                              value={isSkills ? skillsList.join('\n') : (item.bullets ? item.bullets.join('\n') : '')} 
                              onChange={e => {
                                if (isSkills) {
                                  updateItem(sIdx, iIdx, 'context', '');
                                }
                                updateBulletsText(sIdx, iIdx, e.target.value);
                              }} 
                              rows={5} 
                            />
                          </div>
                        </div>
                      ) : (
                        <div key={iIdx} className={profileStyles.itemCard}>
                          <div className={profileStyles.itemLayout}>
                            <div className={profileStyles.itemContent}>
                              <div className={profileStyles.itemHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <h3 className={profileStyles.itemTitle}>
                                    {item.url ? <a href={item.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'inherit' }}>{item.title}</a> : item.title}
                                  </h3>
                                  {(item.subtitle || item.date) && (
                                    <div className={profileStyles.itemMeta}>
                                      {item.subtitle}{item.subtitle && item.date && " • "}{item.date}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button className={profileStyles.iconBtnSmall} onClick={() => setEditingItem({ sIdx, iIdx })} title="Edit Item"><Pencil size={14}/></button>
                                  <button className={profileStyles.iconBtnSmall} onClick={() => moveItem(sIdx, iIdx, 'up')} disabled={iIdx === 0} title="Move Up"><ArrowUp size={14}/></button>
                                  <button className={profileStyles.iconBtnSmall} onClick={() => moveItem(sIdx, iIdx, 'down')} disabled={iIdx === sec.items.length - 1} title="Move Down"><ArrowDown size={14}/></button>
                                  <button className={profileStyles.iconBtnSmall} onClick={() => deleteItem(sIdx, iIdx)} title="Delete Item"><Trash2 size={14} color="#ef4444"/></button>
                                </div>
                              </div>
                              
                              {item.context && !isSkills && <p className={profileStyles.itemContext}>{item.context}</p>}
                              
                              {!isSkills && item.bullets && item.bullets.length > 0 && (
                                <ul className={profileStyles.bullets}>
                                  {item.bullets.map((b: string, bIdx: number) => (
                                    <li key={bIdx}>{b}</li>
                                  ))}
                                </ul>
                              )}

                              {isSkills && skillsList.length > 0 && (
                                 <div className={profileStyles.badges}>
                                   {skillsList.map((b: string, bIdx: number) => {
                                     if (!b.trim()) return null;
                                     return <span key={bIdx} className={profileStyles.badge}>{b.trim()}</span>;
                                   })}
                                 </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <button 
                      onClick={() => {
                        const newCv = { ...cvData };
                        newCv.sections[sIdx].items.push({ title: 'New Item', bullets: [] });
                        setCvData(newCv);
                        setEditingItem({ sIdx, iIdx: newCv.sections[sIdx].items.length - 1 });
                      }}
                      className={styles.btnGhost} 
                      style={{ width: '100%', padding: '12px', marginTop: '8px', border: '1px dashed rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
                    >
                      + Add Item
                    </button>
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
          <div className={styles.pdfContainer} style={{ position: 'relative' }}>
            {activeTab === "CV" && cvPdfUrl && (
              <iframe src={`${cvPdfUrl}#toolbar=0&view=FitH`} style={{ width: '100%', height: '100%', border: 'none' }} />
            )}
            {activeTab === "CV" && cvCompileError && (
              <div style={{ padding: '24px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid #ef4444' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>CV Compilation Failed</h3>
                <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{cvCompileError}</p>
                <button onClick={() => compileCv(cvData)} style={{ marginTop: '16px', padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Retry Compile</button>
              </div>
            )}
            {activeTab === "Cover Letter" && clPdfUrl && (
              <iframe src={`${clPdfUrl}#toolbar=0&view=FitH`} style={{ width: '100%', height: '100%', border: 'none' }} />
            )}
            {activeTab === "Cover Letter" && clCompileError && (
              <div style={{ padding: '24px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid #ef4444' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '8px' }}>Cover Letter Compilation Failed</h3>
                <p style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{clCompileError}</p>
                <button onClick={() => compileCl(clData)} style={{ marginTop: '16px', padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Retry Compile</button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showDisclaimer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div style={{ backgroundColor: '#422006', border: '1px solid #f59e0b', padding: '32px', borderRadius: '16px', maxWidth: '500px', width: '90%', boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#fbbf24' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Review Your Documents</h2>
            </div>
            <p style={{ color: '#fcd34d', fontSize: '15px', lineHeight: '1.5', marginBottom: '24px' }}>
              AI can make mistakes or hallucinate. Please review your CV and Cover Letter carefully to ensure all information is accurate and factual before finalizing your application.
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDisclaimer(false)}
                style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s' }} 
                onMouseOver={(e) => e.currentTarget.style.backgroundColor='rgba(255,255,255,0.2)'} 
                onMouseOut={(e) => e.currentTarget.style.backgroundColor='rgba(255,255,255,0.1)'}
              >
                Cancel
              </button>
              <button
                onClick={proceedWithSave}
                style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }} 
                onMouseOver={(e) => e.currentTarget.style.backgroundColor='#fbbf24'} 
                onMouseOut={(e) => e.currentTarget.style.backgroundColor='#f59e0b'}
              >
                Looks Good, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
