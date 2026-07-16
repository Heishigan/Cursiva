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
    const tailoredStr = localStorage.getItem('diff_tailored_cv');
    const clStr = localStorage.getItem('diff_cover_letter');
    const c = localStorage.getItem('diff_company') || 'Company';
    const r = localStorage.getItem('diff_role') || 'Role';

    if (tailoredStr) {
      const tailoredData = JSON.parse(tailoredStr);
      const genericStr = localStorage.getItem('generic_cv_json');
      if (genericStr) {
        const genericData = JSON.parse(genericStr);
        tailoredData.personal_info = genericData.personal_info;
      }
      setCvData(tailoredData);
    }
    if (clStr) setClData(JSON.parse(clStr));
    setCompany(c);
    setRole(r);
  }, []);

  useEffect(() => {
    if (cvData && !cvPdfUrl) {
      compilePdfs();
    }
  }, [cvData, clData]);

  const compilePdfs = async () => {
    setIsCompiling(true);
    try {
      // 1. Compile CV
      const resCv = await fetch('http://localhost:8000/api/compile_cv', {
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
        const resCl = await fetch('http://localhost:8000/api/compile_cl', {
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
    a.download = `${cvData?.personal_info?.name?.replace(/\s+/g, '_')}_${type}_${company}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) return;
    setIsSubmittingFeedback(true);
    try {
      const token = await getToken();
      await fetch('http://localhost:8000/api/feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ user_feedback: feedback })
      });
      alert("Feedback extracted as a persistent lesson! It will be applied to your future iterations.");
      setFeedback("");
    } catch (e) {
      console.error(e);
      alert("Failed to submit feedback.");
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
