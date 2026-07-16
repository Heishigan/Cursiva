"use client";
import styles from './pipeline.module.css';
import { useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import AgentWorkflow from "@/components/pipeline/AgentWorkflow";
import PasteJdStep from "@/components/pipeline/PasteJdStep";
import StrategyStep from "@/components/pipeline/StrategyStep";
import WorkbenchStep from "@/components/pipeline/WorkbenchStep";
import DoneStep from "@/components/pipeline/DoneStep";

export default function PipelinePage() {
  const { getToken } = useAuth();
  
  // Overall Pipeline State
  const [step, setStep] = useState(1); // 1: Paste JD, 2: Strategy, 3: Workbench, 4: Done
  
  // Data State
  const [jdText, setJdText] = useState("");
  const [strategyResult, setStrategyResult] = useState<any>(null);
  const [jobMetadata, setJobMetadata] = useState<any>(null);
  const [tailoredData, setTailoredData] = useState<any>(null);
  const [finalPdfs, setFinalPdfs] = useState({ cvUrl: "", clUrl: "" });
  
  // Agent logs
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const submitJd = async (text: string) => {
    setJdText(text);
    setIsProcessing(true);
    setLogs([]);
    
    try {
      const token = await getToken();
      const genericCv = localStorage.getItem("generic_cv_json") || "{}";
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          job_description: text,
          generic_cv_raw: genericCv
        })
      });

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
                  alert(`Ineligible: ${data.reason}`);
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

  const submitStrategy = async (userAnswers: string) => {
    setIsProcessing(true);
    setLogs([]);
    
    try {
      const token = await getToken();
      const genericCv = localStorage.getItem("generic_cv_json") || "{}";
      const threadId = "thread_" + Math.random().toString(36).substring(7);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/tailor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          job_description: jdText,
          generic_cv_raw: genericCv,
          company_name: jobMetadata?.company_name || "",
          role_name: jobMetadata?.role_name || "",
          strategy_plan: strategyResult?.strategy_plan || "",
          user_strategy_answers: userAnswers,
          thread_id: threadId
        })
      });

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
                  
                  setTailoredData({
                    cv: completeTailoredCv,
                    cl: data.cover_letter_parts,
                    company: jobMetadata?.company_name || "Company",
                    role: jobMetadata?.role_name || "Role"
                  });
                  setStep(3);
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
            <h2 className={styles.strategyTitle} style={{ marginBottom: '16px' }}>
              Agents at Work
            </h2>
            <AgentWorkflow logs={logs} activePipelinePhase={step === 1 ? 'intake' : 'tailor'} />
          </div>
        ) : (
          <>
            {step === 1 && <PasteJdStep onSubmit={submitJd} />}
            {step === 2 && <StrategyStep result={strategyResult} jobMetadata={jobMetadata} onSubmit={submitStrategy} />}
            {step === 3 && <WorkbenchStep data={tailoredData} jdText={jdText} onApproveAndSave={handleApproveAndSave} />}
            {step === 4 && <DoneStep cvPdfUrl={finalPdfs.cvUrl} clPdfUrl={finalPdfs.clUrl} onReset={() => { setStep(1); setJdText(""); setStrategyResult(null); setJobMetadata(null); setTailoredData(null); setFinalPdfs({cvUrl:"",clUrl:""}); }} />}
          </>
        )}
      </main>
    </div>
  );
}
