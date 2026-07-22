"use client";
import styles from './pipeline.module.css';
import { useState, useRef, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import AgentWorkflow from "@/components/pipeline/AgentWorkflow";
import PasteJdStep from "@/components/pipeline/PasteJdStep";
import StrategyStep from "@/components/pipeline/StrategyStep";
import WorkbenchStep from "@/components/pipeline/WorkbenchStep";
import DoneStep from "@/components/pipeline/DoneStep";

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
  
  const [logs, setLogs] = useState<string[]>([]);
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
          headers: { Authorization: `Bearer ${token}` }
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

  useEffect(() => {
    if (step === 1 && jdText.trim() === "") {
      sessionStorage.setItem("safeToLeave", "true");
    } else if (step === 4) {
      sessionStorage.setItem("safeToLeave", "true");
    } else {
      sessionStorage.removeItem("safeToLeave");
    }
  }, [step, jdText]);

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
    setIsProcessing(true);
    setLogs([]);
    setEligibilityWarning(null);
    
    try {
      const token = await getToken();
      const genericCv = localStorage.getItem(`generic_cv_json_${user?.id}`) || "{}";
      
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
              if (data.type === 'status') {
                setLogs(prev => [...prev, data.message]);
              } else if (data.type === 'result') {
                if (data.status === 'success') {
                  setJobMetadata(data.metadata);
                  setStrategyResult(data.strategy);
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
    } catch (error) {
      console.error(error);
      alert("Pipeline failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitStrategy = async (userAnswers: string, feedback: string = "") => {
    setIsProcessing(true);
    setLogs([]);
    
    try {
      const token = await getToken();
      const genericCv = localStorage.getItem(`generic_cv_json_${user?.id}`) || "{}";
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
              if (data.type === 'status') {
                setLogs(prev => [...prev, data.message]);
              } else if (data.type === 'result') {
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
                    localStorage.setItem(`diff_cl_${user.id}`, JSON.stringify(data.cover_letter_parts));
                    localStorage.setItem(`diff_jd_${user.id}`, jdText);
                    localStorage.setItem(`diff_strategy_${user.id}`, strategyResult?.strategy_plan || "");
                    localStorage.setItem(`diff_user_answers_${user.id}`, userAnswers);
                  }
                  
                  setTailoredData({
                    cv: completeTailoredCv,
                    cl: data.cover_letter_parts,
                    company: jobMetadata?.company_name || "Company",
                    role: jobMetadata?.role_name || "Role"
                  });
                  setStep(3);
                } else if (data.status === 'error') {
                  throw new Error(data.message);
                }
              }
            } catch (e) {
              console.error("JSON parse error on line:", line, e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      alert("Tailoring failed.");
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
      {/* Top Navigation Stepper */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <div className={`${styles.stepItem} ${step >= 1 ? styles.stepItemActive : ''}`}>
            <span className={styles.stepNumber} style={step === 1 ? { backgroundColor: 'var(--accent-1)', borderColor: 'var(--accent-1)', color: 'white' } : {}}>1</span>
            Paste JD
          </div>
          <div className={styles.stepDivider} />
          <div className={`${styles.stepItem} ${step >= 2 ? styles.stepItemActive : ''}`}>
            <span className={styles.stepNumber} style={step === 2 ? { backgroundColor: 'var(--accent-1)', borderColor: 'var(--accent-1)', color: 'white' } : {}}>2</span>
            Strategy
          </div>
          <div className={styles.stepDivider} />
          <div className={`${styles.stepItem} ${step >= 3 ? styles.stepItemActive : ''}`}>
            <span className={styles.stepNumber} style={step === 3 ? { backgroundColor: 'var(--accent-1)', borderColor: 'var(--accent-1)', color: 'white' } : {}}>3</span>
            Workbench
          </div>
          <div className={styles.stepDivider} />
          <div className={`${styles.stepItem} ${step >= 4 ? styles.stepItemActive : ''}`}>
            <span className={styles.stepNumber} style={step === 4 ? { backgroundColor: 'var(--accent-1)', borderColor: 'var(--accent-1)', color: 'white' } : {}}>4</span>
            Done
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={styles.mainArea} style={{ overflowY: (step >= 3 || isProcessing) ? 'hidden' : 'auto' }}>
        {isProcessing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '64px', height: '100%' }}>
            <h2 className={`${styles.strategyTitle} ${styles.agentsTitle}`} style={{ marginBottom: '16px' }}>
              Agents at Work
            </h2>
            <AgentWorkflow logs={logs} activePipelinePhase={step === 1 ? 'intake' : 'tailor'} />
          </div>
        ) : (
          <>
            {step === 1 && <PasteJdStep onSubmit={submitJd} />}
            {step === 2 && <StrategyStep result={strategyResult} jobMetadata={jobMetadata} onSubmit={submitStrategy} />}
            {step === 3 && <WorkbenchStep data={tailoredData} jdText={jdText} onApproveAndSave={handleApproveAndSave} onSubmitFeedback={(feedback) => submitStrategy(localStorage.getItem(`diff_user_answers_${user?.id}`) || "", feedback)} />}
            {step === 4 && <DoneStep cvPdfUrl={finalPdfs.cvUrl} clPdfUrl={finalPdfs.clUrl} jobMetadata={jobMetadata} userName={tailoredData?.cv?.personal_info?.name} onReset={() => { setStep(1); setJdText(""); setStrategyResult(null); setJobMetadata(null); setTailoredData(null); setFinalPdfs({cvUrl:"",clUrl:""}); }} />}
          </>
        )}
      </main>

      {/* Eligibility Warning Modal */}
      {eligibilityWarning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div style={{ backgroundColor: '#422006', border: '1px solid #f59e0b', padding: '32px', borderRadius: '16px', maxWidth: '500px', width: '90%', boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#fbbf24' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
              <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Eligibility Warning</h2>
            </div>
            <p style={{ color: '#fcd34d', fontSize: '15px', lineHeight: '1.5', marginBottom: '24px' }}>
              {eligibilityWarning}
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEligibilityWarning(null)} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor='rgba(255,255,255,0.2)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor='rgba(255,255,255,0.1)'}>
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
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#1f2937', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <button onClick={() => setShowTopUpModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '24px', lineHeight: '1', padding: '4px' }}>&times;</button>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>Out of Credits</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px', lineHeight: '1.5' }}>
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
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#1f2937', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '90%', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <button onClick={() => setShowBaselineModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '24px', lineHeight: '1', padding: '4px' }}>&times;</button>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>No Baseline CV</h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px', lineHeight: '1.5' }}>
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
