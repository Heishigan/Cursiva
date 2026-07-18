"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { useAuth, useUser } from "@clerk/nextjs";

export default function DiffViewer() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [cvData, setCvData] = useState<any>(null);
  const [clData, setClData] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  
  const [cvPdfUrl, setCvPdfUrl] = useState<string | null>(null);
  const [clPdfUrl, setClPdfUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  
  const [feedback, setFeedback] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    
    const tailoredStr = localStorage.getItem(`diff_tailored_cv_${user.id}`);
    const clStr = localStorage.getItem(`diff_cover_letter_${user.id}`);
    const c = localStorage.getItem(`diff_company_${user.id}`) || 'Company';
    const r = localStorage.getItem(`diff_role_${user.id}`) || 'Role';

    if (tailoredStr) {
      const tailoredData = JSON.parse(tailoredStr);
      const genericStr = localStorage.getItem(`generic_cv_json_${user.id}`);
      if (genericStr) {
        const genericData = JSON.parse(genericStr);
        tailoredData.personal_info = genericData.personal_info;
      }
      setCvData(tailoredData);
    }
    if (clStr) setClData(JSON.parse(clStr));
    setCompany(c);
    setRole(r);
  }, [user?.id]);

  useEffect(() => {
    if (cvData && !cvPdfUrl) {
      compilePdfs();
    }
  }, [cvData, clData]);

  const compilePdfs = async () => {
    setIsCompiling(true);
    try {
      // 1. Compile CV
      const resCv = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/compile_cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cvData)
      });
      const dataCv = await resCv.json();
      if (dataCv.status === 'success') {
        const byteChars = atob(dataCv.pdf_base64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
        setCvPdfUrl(URL.createObjectURL(blob));
      }

      // 2. Compile CL
      if (clData && clData.length > 0) {
        const resCl = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/compile_cl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personal_info: cvData.personal_info,
            company_name: company,
            cover_letter_paragraphs: clData
          })
        });
        const dataCl = await resCl.json();
        if (dataCl.status === 'success') {
          const byteChars = atob(dataCl.pdf_base64);
          const byteNums = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
          const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
          setClPdfUrl(URL.createObjectURL(blob));
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to compile PDFs.");
    }
    setIsCompiling(false);
  };

  const handleDownload = (url: string | null, type: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    const cleanName = cvData?.personal_info?.name?.replace(/\s+/g, '_') || 'Candidate';
    const cleanCompany = company.replace(/\s+/g, '_') || 'Company';
    const cleanRole = role.replace(/\s+/g, '_') || 'Role';
    a.download = `${cleanName}_${type}_${cleanCompany}_${cleanRole}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    setIsSubmittingFeedback(true);
    try {
      const token = await getToken();
      // 1. Save lesson
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_feedback: feedback })
      });

      // 2. Regenerate CV
      const jdText = localStorage.getItem(`diff_jd_${user?.id}`);
      const strategyStr = localStorage.getItem(`diff_strategy_${user?.id}`);
      const genericStr = localStorage.getItem(`generic_cv_json_${user?.id}`);
      const userAnswers = localStorage.getItem(`diff_user_answers_${user?.id}`) || "";

      if (jdText && strategyStr && genericStr) {
        const threadId = "thread_" + Math.random().toString(36).substring(7);
        const resTailor = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/tailor`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({
            job_description: jdText,
            generic_cv_raw: genericStr,
            company_name: company,
            role_name: role,
            strategy_plan: strategyStr,
            user_strategy_answers: userAnswers,
            user_feedback: feedback,
            thread_id: threadId
          })
        });

        if (resTailor.body) {
          const reader = resTailor.body.getReader();
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
                  if (data.type === 'result' && data.status === 'success') {
                    const genericData = JSON.parse(genericStr);
                    const completeTailoredCv = {
                      ...data.tailored_cv,
                      personal_info: genericData.personal_info
                    };
                    setCvData(completeTailoredCv);
                    setClData(data.cover_letter_parts);
                    if (user?.id) {
                      localStorage.setItem(`diff_tailored_cv_${user.id}`, JSON.stringify(data.tailored_cv));
                      localStorage.setItem(`diff_cl_${user.id}`, JSON.stringify(data.cover_letter_parts));
                    }
                  }
                } catch (e) {
                  // ignore parse error
                }
              }
            }
          }
        }
      }

      alert("Feedback applied! The CV has been regenerated.");
      setFeedback("");
    } catch (e) {
      console.error(e);
      alert("Failed to submit feedback and regenerate.");
    }
    setIsSubmittingFeedback(false);
  };

  if (!cvData) return <div className={styles.container}>Loading Application Data...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Application Package</h1>
        <p className={styles.subtitle}>Tailored for {role} at {company}</p>
      </header>

      <div className={styles.contentGrid}>
        {/* Left: Previews */}
        <div className={styles.previews}>
          <div className={`glass-panel ${styles.pdfPanel}`}>
            <div className={styles.panelHeader}>
              <h3>Tailored CV</h3>
              <button className="btn-primary" onClick={() => handleDownload(cvPdfUrl, 'CV')} disabled={!cvPdfUrl}>
                Download CV
              </button>
            </div>
            <div className={styles.pdfViewer}>
              {cvPdfUrl ? <iframe src={cvPdfUrl} width="100%" height="500px" /> : "Compiling CV..."}
            </div>
          </div>

          {clData.length > 0 && (
            <div className={`glass-panel ${styles.pdfPanel}`} style={{marginTop: '24px'}}>
              <div className={styles.panelHeader}>
                <h3>Cover Letter</h3>
                <button className="btn-primary" onClick={() => handleDownload(clPdfUrl, 'Cover_Letter')} disabled={!clPdfUrl}>
                  Download Cover Letter
                </button>
              </div>
              <div className={styles.pdfViewer}>
                {clPdfUrl ? <iframe src={clPdfUrl} width="100%" height="500px" /> : "Compiling Cover Letter..."}
              </div>
            </div>
          )}
        </div>

        {/* Right: Feedback & Iteration */}
        <div className={styles.sidebar}>
          <div className={`glass-panel ${styles.feedbackPanel}`}>
            <h3>Continuous Learning</h3>
            <p className={styles.helpText}>Spot something wrong? Tell the Agent what to fix, and it will extract a universal rule to remember for all your future applications.</p>
            <textarea 
              className={styles.textarea}
              placeholder="E.g. 'Never mention Jira, I hate it' or 'Always make sure to highlight React Router in my projects.'"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={isSubmittingFeedback}
            />
            <button className="btn-primary" onClick={submitFeedback} disabled={isSubmittingFeedback || !feedback.trim()}>
              {isSubmittingFeedback ? "Extracting Lesson..." : "Submit Feedback"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
