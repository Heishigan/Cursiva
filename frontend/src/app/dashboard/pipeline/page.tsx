"use client";
import styles from './pipeline.module.css';
import { useState, useRef, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import Glassbox, { type Stages, type StageEvent, type CvDoc, type LetterDoc, type LiveDocs } from "@/components/pipeline/glassbox/Glassbox";
import PasteJdStep from "@/components/pipeline/PasteJdStep";
import StrategyStep from "@/components/pipeline/StrategyStep";
import WorkbenchStep from "@/components/pipeline/WorkbenchStep";
import DoneStep from "@/components/pipeline/DoneStep";
import FlowRail from "@/components/pipeline/FlowRail";

export default function PipelinePage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  
  // Overall Pipeline State
  const [step, setStep] = useState(1); // 1: Paste JD, 2: Strategy, 3: Workbench, 4: Done
  
  // Data State
  const [jdText, setJdText] = useState("");
  const [strategyResult, setStrategyResult] = useState<any>(null);
  const [jobMetadata, setJobMetadata] = useState<any>(null);
  const [tailoredData, setTailoredData] = useState<any>(null);
  const [finalPdfs, setFinalPdfs] = useState({ cvUrl: "", clUrl: "" });
  
  const [, setLogs] = useState<string[]>([]); // legacy status messages (kept for debugging)
  // Live progress for the Glassbox view (structured events from the backend).
  const [stages, setStages] = useState<Stages>({});
  const [drafts, setDrafts] = useState<{ cv?: CvDoc; letter?: LetterDoc }>({});
  // Documents that arrive as a live token stream: 'streaming' while text is
  // coming in, 'done' once the finished draft has landed.
  const [liveDocs, setLiveDocs] = useState<LiveDocs>({});
  const [genericForView, setGenericForView] = useState<CvDoc | null>(null);
  const handleProgress = (data: { type?: string; agent?: string; doc?: string; content?: unknown; partial?: boolean }) => {
    if (data.type === 'stage' && data.agent) {
      const ev = data as unknown as StageEvent;
      setStages(prev => ({ ...prev, [ev.agent]: ev }));
      return true;
    }
    if (data.type === 'draft' && (data.doc === 'cv' || data.doc === 'letter')) {
      const doc = data.doc;
      if (data.partial) {
        // Keep the previous draft on screen until the new one has real text.
        const c = (data.content || {}) as Record<string, unknown>;
        const hasText = Object.values(c).some(v => (typeof v === 'string' ? v.trim() !== '' : Array.isArray(v) && v.length > 0));
        if (!hasText) return true;
        setLiveDocs(prev => (prev[doc] === 'streaming' ? prev : { ...prev, [doc]: 'streaming' }));
      } else {
        setLiveDocs(prev => (prev[doc] === 'streaming' ? { ...prev, [doc]: 'done' } : prev));
      }
      setDrafts(prev => ({ ...prev, [doc]: data.content }));
      return true;
    }
    return false;
  };
  const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const [isProcessing, setIsProcessing] = useState(false);
  const [eligibilityWarning, setEligibilityWarning] = useState<string | null>(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [hasBaseline, setHasBaseline] = useState<boolean>(true);

  // Fetch credits at mount so we can gate the pipeline start
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` },
          cache: "no-store"
        });
        const data = await res.json();
        if (data.status === 'success') {
          setCredits(data.data.credits ?? 0);
          setHasBaseline(data.data.has_baseline);
        }
      } catch {}
    };
    fetchCredits();
  }, [getToken]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (step > 1 && step < 4) {
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? All pipeline progress will be lost.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step]);

  // Check for pre-filled JD from matches page or backup
  useEffect(() => {
    const draftJd = localStorage.getItem("cursiva_draft_jd");
    const backupJd = localStorage.getItem("cursiva_backup_jd");
    
    if (draftJd) {
      setJdText(draftJd);
      localStorage.removeItem("cursiva_draft_jd");
      localStorage.removeItem("cursiva_draft_company");
      localStorage.removeItem("cursiva_draft_role");
      localStorage.setItem("cursiva_backup_jd", draftJd);
    } else if (backupJd && !jdText) {
      // Intentionally removed backupJd pre-fill to ensure New Application is empty unless coming from Draft
      // setJdText(backupJd);
    }
  }, []);

  useEffect(() => {
    if (step === 1 && jdText.trim() === "") {
      sessionStorage.setItem("safeToLeave", "true");
    } else if (step === 4) {
      sessionStorage.setItem("safeToLeave", "true");
    } else {
      sessionStorage.removeItem("safeToLeave");
    }
  }, [step, jdText]);

  // The baseline CV normally lives in localStorage; on a new browser it may not be
  // there yet, so fall back to the server copy instead of sending an empty "{}"
  // (which made the tailor write a CV from nothing).
  const loadGenericCv = async (token: string | null): Promise<string> => {
    const cached = localStorage.getItem(`generic_cv_json_${user?.id}`);
    if (cached && cached !== "{}") return cached;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => null);
    const cv = data?.data?.cv_data;
    if (!cv) throw new Error("Your baseline CV is missing. Please set it up in Profile first.");
    const str = JSON.stringify(cv);
    if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, str);
    return str;
  };

  const submitJd = async (text: string, override = false) => {
    // Credit gate — block before calling the API
    if (credits !== null && credits < 1) {
      setShowTopUpModal(true);
      return;
    }
    // Baseline gate — block before calling the API
    if (!hasBaseline) {
      setShowBaselineModal(true);
      return;
    }
    setJdText(text);
    localStorage.setItem("cursiva_backup_jd", text);
    setIsProcessing(true);
    setLogs([]);
    setStages({});
    setDrafts({});
    setEligibilityWarning(null);
    
    try {
      const token = await getToken();
      const genericCv = await loadGenericCv(token);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        cache: "no-store",
        body: JSON.stringify({
          job_description: text,
          generic_cv_raw: genericCv,
          override_eligibility: override
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server Error: ${response.status} ${errText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let buffer = "";
      let streamCompleted = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (handleProgress(data)) {
                // handled by the Glassbox view
              } else if (data.type === 'status') {
                setLogs(prev => [...prev, data.message]);
              } else if (data.type === 'result') {
                streamCompleted = true;
                if (data.status === 'success') {
                  setJobMetadata(data.metadata);
                  setStrategyResult(data.strategy);
                  await pause(900); // let the last step land before moving on
                  setStep(2);
                } else {
                  setEligibilityWarning(data.reason);
                }
              }
            } catch (e) {
              console.error("JSON parse error on line:", line, e);
            }
          }
        }
      }
      
      if (!streamCompleted) {
        throw new Error("Connection lost or backend timed out before completing the process.");
      }
      
    } catch (error) {
      console.error(error);
      alert(error instanceof Error && error.message ? error.message : "Pipeline failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitStrategy = async (userAnswers: string, feedback: string = "") => {
    setIsProcessing(true);
    setLogs([]);
    // Keep the reader and strategist results so their cards stay "done".
    setStages(prev => ({ reader: prev.reader, strategist: prev.strategist }));
    setDrafts({});
    setLiveDocs({});
    
    try {
      const token = await getToken();
      const genericCv = await loadGenericCv(token);
      try { setGenericForView(JSON.parse(genericCv)); } catch { setGenericForView(null); }
      const threadId = "thread_" + Math.random().toString(36).substring(7);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/tailor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        cache: "no-store",
        body: JSON.stringify({
          job_description: jdText,
          generic_cv_raw: genericCv,
          company_name: jobMetadata?.company_name || "",
          role_name: jobMetadata?.role_name || "",
          strategy_plan: strategyResult?.strategy_plan || "",
          role_philosophy: strategyResult?.role_philosophy || "",
          sharpest_project_insight: strategyResult?.sharpest_project_insight || "",
          user_strategy_answers: userAnswers,
          user_feedback: feedback,
          thread_id: threadId
        })
      });

      if (response.status === 402) {
        setShowTopUpModal(true);
        setIsProcessing(false);
        return;
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server Error: ${response.status} ${errText}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let buffer = "";
      let finalResult: { status?: string; message?: string; issues?: string } | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (handleProgress(data)) {
                // handled by the Glassbox view
              } else if (data.type === 'status') {
                setLogs(prev => [...prev, data.message]);
              } else if (data.type === 'result') {
                finalResult = data;
                if (data.status === 'success') {
                  // Combine with generic personal info
                  const genericData = JSON.parse(genericCv);
                  const completeTailoredCv = {
                    ...data.tailored_cv,
                    personal_info: genericData.personal_info
                  };
                  
                  if (user?.id) {
                    localStorage.setItem(`diff_tailored_cv_${user.id}`, JSON.stringify(data.tailored_cv));
                    localStorage.setItem(`diff_job_role_${user.id}`, jobMetadata?.role_name || "");
                    localStorage.setItem(`diff_company_${user.id}`, jobMetadata?.company_name || "");
                    localStorage.setItem(`diff_company_location_${user.id}`, jobMetadata?.company_location || "Sweden");
                    localStorage.setItem(`diff_cl_${user.id}`, JSON.stringify(data.cover_letter_parts));
                    localStorage.setItem(`diff_jd_${user.id}`, jdText);
                    localStorage.setItem(`diff_strategy_${user.id}`, strategyResult?.strategy_plan || "");
                    localStorage.setItem(`diff_role_philosophy_${user.id}`, strategyResult?.role_philosophy || "");
                    localStorage.setItem(`diff_sharpest_insight_${user.id}`, strategyResult?.sharpest_project_insight || "");
                    localStorage.setItem(`diff_user_answers_${user.id}`, userAnswers);
                  }
                  
                  setTailoredData({
                    cv: completeTailoredCv,
                    cl: data.cover_letter_parts,
                    company: jobMetadata?.company_name || "Company",
                    role: jobMetadata?.role_name || "Role"
                  });
                  await pause(800); // let the CHECKED stamp land
                  setStep(3);
                }
              }
            } catch (e) {
              console.error("JSON parse error on line:", line, e);
            }
          }
        }
      }

      if (!finalResult) {
        throw new Error("The connection was lost before the run finished. If it did not complete, your credit is refunded automatically.");
      }
      if (finalResult.status !== 'success') {
        // failed_review or error: the backend has already refunded the credit.
        alert(finalResult.message || "Tailoring failed. Your credit has been refunded.");
        if (finalResult.issues) console.warn("Reviewer issues:", finalResult.issues);
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error && error.message ? error.message : "Tailoring failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAndSave = async (cvPdfUrl: string, clPdfUrl: string, cvData: any, clData: any) => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        cache: "no-store",
        body: JSON.stringify({
          company_name: jobMetadata?.company_name || "Unknown Company",
          role_name: jobMetadata?.role_name || "Unknown Role",
          job_description: jdText,
          cv_data_json: JSON.stringify(cvData),
          cl_data_json: JSON.stringify(clData)
        })
      });

      if (!res.ok) throw new Error("Failed to save application");
      
      setFinalPdfs({ cvUrl: cvPdfUrl, clUrl: clPdfUrl });
      setStep(4);
    } catch (error) {
      console.error(error);
      alert("Failed to save application.");
    }
  };

  return (
    <div className={styles.container}>
      {/* Progress rail */}
      <div className={styles.nav}>
        <FlowRail current={step === 4 ? 4 : step === 3 || (step === 2 && isProcessing) ? 3 : step} />
      </div>

      {/* Main Content Area */}
      <main className={`${styles.mainArea} ${(step === 3 || isProcessing) ? styles.mainAreaLocked : ''}`}>
        {isProcessing ? (
          <Glassbox
            phase={step === 1 ? 'intake' : 'tailor'}
            stages={stages}
            drafts={drafts}
            live={liveDocs}
            genericCv={genericForView}
            company={jobMetadata?.company_name}
            role={jobMetadata?.role_name}
          />
        ) : (
          <>
            {step === 1 && <PasteJdStep initialText={jdText} onSubmit={submitJd} />}
            {step === 2 && <StrategyStep result={strategyResult} jobMetadata={jobMetadata} onSubmit={submitStrategy} />}
            {step === 3 && <WorkbenchStep data={tailoredData} jdText={jdText} onApproveAndSave={handleApproveAndSave} onSubmitFeedback={(feedback) => submitStrategy(localStorage.getItem(`diff_user_answers_${user?.id}`) || "", feedback)} />}
            {step === 4 && <DoneStep cvPdfUrl={finalPdfs.cvUrl} clPdfUrl={finalPdfs.clUrl} jobMetadata={jobMetadata} userName={tailoredData?.cv?.personal_info?.name} onReset={() => { setStep(1); setJdText(""); setStrategyResult(null); setJobMetadata(null); setTailoredData(null); setFinalPdfs({cvUrl:"",clUrl:""}); }} />}
          </>
        )}
      </main>

      {/* Eligibility Warning Modal */}
      {eligibilityWarning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--line)', borderLeft: '4px solid #f59e0b', padding: '32px', borderRadius: '16px', maxWidth: '500px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: 'var(--text-primary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
                {eligibilityWarning.includes("Duplicate") || eligibilityWarning.includes("duplicate") ? "Duplicate Application Detected" : "Eligibility Warning"}
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.5', marginBottom: '24px' }}>
              {eligibilityWarning}
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEligibilityWarning(null)} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--line)', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor='var(--surface-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor='var(--surface)'}>
                Go Back
              </button>
              <button onClick={() => { setEligibilityWarning(null); submitJd(jdText, true); }} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#f59e0b', color: '#111827', border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor='#fbbf24'} onMouseOut={(e) => e.currentTarget.style.backgroundColor='#f59e0b'}>
                Override & Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {showTopUpModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTopUpModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ position: 'relative', background: 'var(--surface-2)', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid var(--line)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <button onClick={() => setShowTopUpModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '24px', lineHeight: '1', padding: '4px' }}>&times;</button>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>Out of Credits</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              You don't have enough credits to generate this application. Please top up your account to continue.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: 600, borderRadius: '8px' }} onClick={() => window.location.href = '/dashboard/settings'}>Go to Settings</button>
            </div>
          </div>
        </div>
      )}

      {showBaselineModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBaselineModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ position: 'relative', background: 'var(--surface-2)', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid var(--line)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <button onClick={() => setShowBaselineModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '24px', lineHeight: '1', padding: '4px' }}>&times;</button>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>No Baseline CV</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              You haven't set up a baseline CV yet. Please upload a baseline resume to continue.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '16px', fontWeight: 600, borderRadius: '8px' }} onClick={() => window.location.href = '/dashboard/profile'}>Go to Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
