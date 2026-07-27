"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import { Target, ExternalLink, Play, Trash2, Plus, Download, X } from "lucide-react";
import styles from '../page.module.css';

export default function MatchesPage() {
  const { getToken } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [manualJd, setManualJd] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/jobs/matches`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === "success") {
          setMatches(data.data);
        }
      } catch (e) {
        console.error("Failed to fetch matches", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMatches();
  }, []);

  const handleDraftApplication = (job: any) => {
    localStorage.setItem("cursiva_draft_jd", job.job_description);
    localStorage.setItem("cursiva_draft_company", job.company_name);
    localStorage.setItem("cursiva_draft_role", job.role_name);
    window.location.href = "/dashboard/pipeline";
  };

  const handleDelete = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to delete this job match?")) return;
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMatches(matches.filter(j => j.id !== jobId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddManualSubmit = async () => {
    if (!manualJd.trim()) return;
    setIsSubmittingManual(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/jobs/save`, {
        method: "POST",
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: manualUrl.trim(),
          job_description: manualJd.trim()
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setIsManualModalOpen(false);
        setManualUrl("");
        setManualJd("");
        // Reload matches to show the new one
        const reloadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/jobs/matches`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const reloadData = await reloadRes.json();
        if (reloadData.status === "success") {
          setMatches(reloadData.data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const totalPages = Math.ceil(matches.length / itemsPerPage);
  const paginatedMatches = matches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      {isManualModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0f111a', padding: '32px', borderRadius: '24px', width: '600px', maxWidth: '90%', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Add Job Manually</h3>
              <button onClick={() => setIsManualModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Job URL (Optional)</label>
                <input 
                  type="url" 
                  value={manualUrl} 
                  onChange={(e) => setManualUrl(e.target.value)} 
                  placeholder="https://company.com/jobs/..." 
                  style={{ width: '100%', background: '#1f2937', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Full Job Description *</label>
                <textarea 
                  value={manualJd} 
                  onChange={(e) => setManualJd(e.target.value)} 
                  placeholder="Paste the full job description text here..." 
                  style={{ width: '100%', height: '200px', background: '#1f2937', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsManualModalOpen(false)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleAddManualSubmit} disabled={!manualJd.trim() || isSubmittingManual} style={{ padding: '10px 20px', background: 'var(--accent-1)', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 600, cursor: !manualJd.trim() || isSubmittingManual ? 'not-allowed' : 'pointer', opacity: !manualJd.trim() || isSubmittingManual ? 0.5 : 1 }}>
                {isSubmittingManual ? "Analyzing & Saving..." : "Save Job Match"}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className={styles.greeting}>Job Matches</h1>
          <p className={styles.subtitle}>Your saved jobs, ranked by semantic fit against your generic CV.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setIsManualModalOpen(true)} style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <Plus size={16} /> Add Manually
          </button>
          <a href="#" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 16px', background: 'white', color: 'black', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', textDecoration: 'none' }}>
            <Download size={16} /> Get Extension
          </a>
        </div>
      </header>

      <div className={styles.recentSection}>
        {loading ? (
          <div className={styles.emptyState}>
            <p>Loading your top matches...</p>
          </div>
        ) : matches.length === 0 ? (
          <div className={styles.emptyState}>
            <Target size={48} color="rgba(255,255,255,0.2)" />
            <p style={{ maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 }}>You haven't saved any jobs yet. Use the Chrome Extension to bookmark jobs you like across the web, or add them manually.</p>
            <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <a href="#" target="_blank" rel="noopener noreferrer" style={{ padding: '12px 24px', background: 'white', color: 'black', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                <Download size={18} /> Install Chrome Extension
              </a>
              <button onClick={() => setIsManualModalOpen(true)} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} /> Add Manually
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <div className={styles.tableHeader}>
              <div>Date Saved</div>
              <div>Company</div>
              <div>Role</div>
              <div>Fit Score</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>
            
            <div className={styles.appList}>
              {paginatedMatches.map((job, index) => (
                <div key={job.id} className={styles.appCard} style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className={styles.colDate}>
                    {job.created_at ? format(new Date(job.created_at), "MMM d, yyyy") : "N/A"}
                  </div>
                  <div className={styles.colCompany}>{job.company_name}</div>
                  <div className={styles.colRole}>{job.role_name}</div>
                  <div className={styles.colStatus}>
                    <span className={styles.statusBadge} style={{ background: job.match_score >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)', color: job.match_score >= 80 ? '#10b981' : 'white' }}>
                      {job.match_score}%
                    </span>
                  </div>
                  <div className={styles.colActions} style={{ justifyContent: 'flex-end', display: 'flex', gap: '8px' }}>
                    {job.url && (
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className={styles.actionBtn} title="View original listing">
                        <ExternalLink size={18} />
                      </a>
                    )}
                    <button onClick={() => handleDraftApplication(job)} style={{ padding: '6px 12px', background: 'var(--accent-1)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Play size={14} /> Draft
                    </button>
                    <button onClick={() => handleDelete(job.id)} className={styles.actionBtn} style={{ color: '#ef4444' }} title="Delete match">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px', alignItems: 'center' }}>
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: currentPage === 1 ? 'rgba(255,255,255,0.3)' : 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >Previous</button>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Page {currentPage} of {totalPages}</span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: currentPage === totalPages ? 'rgba(255,255,255,0.3)' : 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
