"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import styles from '@/app/dashboard/pipeline/pipeline.module.css';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  
  const [appData, setAppData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [cvPdfUrl, setCvPdfUrl] = useState<string | null>(null);
  const [clPdfUrl, setClPdfUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          const result = await res.json();
          setAppData(result.data);
          compilePdfs(result.data, token);
        } else {
          router.push('/dashboard');
        }
      } catch (e) {
        console.error("Failed to fetch application", e);
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchApplication();
  }, [id]);

  const compilePdfs = async (data: any, token: string | null) => {
    setIsCompiling(true);
    try {
      // Compile CV
      const cvPayload = JSON.parse(data.cv_data_json);
      const cvRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/compile_cv`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(cvPayload)
      });
      if (cvRes.ok) {
        const cvData = await cvRes.json();
        setCvPdfUrl(`data:application/pdf;base64,${cvData.pdf_base64}`);
      }

      // Compile CL
      const clPayload = JSON.parse(data.cl_data_json);
      const paragraphs = [
        clPayload.salutation,
        clPayload.hook,
        clPayload.match,
        clPayload.curiosity,
        clPayload.fit,
        clPayload.sign_off
      ].filter(Boolean);

      const clRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/compile_cl`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          personal_info: cvPayload.personal_info,
          company_name: data.company_name,
          cover_letter_paragraphs: paragraphs
        })
      });
      if (clRes.ok) {
        const clData = await clRes.json();
        setClPdfUrl(`data:application/pdf;base64,${clData.pdf_base64}`);
      }
      
    } catch (e) {
      console.error("Failed to compile PDFs", e);
    } finally {
      setIsCompiling(false);
    }
  };

  if (isLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Loading application details...</div>;
  }

  if (!appData) return null;

  const cvDataJson = JSON.parse(appData.cv_data_json || "{}");
  const cleanStr = (s?: string) => (s || "").replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const namePart = cleanStr(cvDataJson?.personal_info?.name) || "User";
  const rolePart = cleanStr(appData.role_name) || "Role";
  const companyPart = cleanStr(appData.company_name) || "Company";
  const cvFilename = `${namePart}_CV_${companyPart}_${rolePart}.pdf`;
  const clFilename = `${namePart}_CoverLetter_${companyPart}_${rolePart}.pdf`;

  return (
    <div className={styles.container} style={{ height: '100vh', overflowY: 'auto' }}>
      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        
        <button 
          onClick={() => router.push('/dashboard')} 
          style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          &larr; Back to Dashboard
        </button>

        <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {appData.role_name} at {appData.company_name}
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Applied on {format(new Date(appData.created_at), "MMMM d, yyyy")}
            </p>
          </div>
          {isCompiling && (
            <div style={{ padding: '8px 16px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              Re-compiling application materials...
            </div>
          )}
        </header>

        {/* Top Data Row */}
        <div style={{ marginBottom: '32px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Job Description</h2>
          <div style={{ maxHeight: '200px', overflowY: 'auto', color: 'var(--text-secondary)', fontSize: '14px', whiteSpace: 'pre-wrap', paddingRight: '16px' }}>
            {appData.job_description}
          </div>
        </div>

        {/* Side-by-side PDFs */}
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Application Materials</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', height: '800px' }}>
          
          {/* CV Pane */}
          <div style={{ background: '#525659', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', padding: '8px 12px', fontWeight: 600 }}>
              Tailored CV
            </div>
            {cvPdfUrl ? (
              <>
                <iframe src={`${cvPdfUrl}#toolbar=1&view=FitH`} style={{ width: '100%', flex: 1, border: 'none', borderRadius: '8px' }} />
                <a href={cvPdfUrl} download={cvFilename} style={{ marginTop: '12px', padding: '10px 16px', background: 'var(--accent-1)', color: 'white', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>Download CV</a>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                {isCompiling ? "Compiling..." : "Failed to load"}
              </div>
            )}
          </div>

          {/* CL Pane */}
          <div style={{ background: '#525659', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', padding: '8px 12px', fontWeight: 600 }}>
              Cover Letter
            </div>
            {clPdfUrl ? (
              <>
                <iframe src={`${clPdfUrl}#toolbar=1&view=FitH`} style={{ width: '100%', flex: 1, border: 'none', borderRadius: '8px' }} />
                <a href={clPdfUrl} download={clFilename} style={{ marginTop: '12px', padding: '10px 16px', background: 'var(--accent-1)', color: 'white', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>Download Cover Letter</a>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                 {isCompiling ? "Compiling..." : "Failed to load"}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
