"use client";
import { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import styles from './page.module.css';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const [apiStatus, setApiStatus] = useState<string>("Checking...");

  const [applications, setApplications] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ company_name: '', role_name: '', status: '', created_at: '' });
  const [appToDelete, setAppToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const fetchStatus = async () => {
      try {
        const token = await getToken();
        const res = await fetch("http://localhost:8000/api/user/profile", {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === "success") {
          setApiStatus(data.data.has_api_key ? "Active" : "Not Configured");
        } else {
          setApiStatus("Backend Offline");
        }
      } catch (e) {
        setApiStatus("Backend Offline");
      }
    };
    
    const fetchApplications = async () => {
      try {
        const token = await getToken();
        const res = await fetch("http://localhost:8000/api/applications", {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === "success") {
          setApplications(data.data);
        }
      } catch (e) {
        console.error("Failed to fetch applications", e);
      }
    };
    
    fetchStatus();
    fetchApplications();
  }, [isLoaded, user]);

  const handleEditClick = (app: any) => {
    setEditingId(app.id);
    setEditForm({ 
      company_name: app.company_name, 
      role_name: app.role_name,
      status: app.status || "Applied",
      created_at: format(new Date(app.created_at), "yyyy-MM-dd")
    });
  };

  const handleSaveEdit = async (appId: string) => {
    try {
      const token = await getToken();
      // Combine date with current time to make a valid ISO string
      const isoDate = new Date(editForm.created_at).toISOString();
      const res = await fetch(`http://localhost:8000/api/applications/${appId}`, {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...editForm,
          created_at: isoDate
        })
      });
      if (res.ok) {
        setApplications(prev => prev.map(a => a.id === appId ? { ...a, ...editForm, created_at: isoDate } : a));
        setEditingId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const executeDelete = async () => {
    if (!appToDelete) return;
    try {
      const token = await getToken();
      const res = await fetch(`http://localhost:8000/api/applications/${appToDelete}`, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setApplications(prev => prev.filter(a => a.id !== appToDelete));
        setAppToDelete(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const stats = {
    applied: applications.filter(a => (a.status || 'Applied') === 'Applied').length,
    interviewing: applications.filter(a => a.status === 'Interviewing').length,
    rejected: applications.filter(a => a.status === 'Rejected').length
  };

  return (
    <div className={styles.container} style={{ position: 'relative' }}>
      
      {/* Delete Confirmation Modal */}
      {appToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#1f2937', padding: '32px', borderRadius: '12px', width: '400px', border: '1px solid #ef4444', boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.1), 0 10px 10px -5px rgba(239, 68, 68, 0.04)' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#f87171', marginBottom: '12px' }}>Delete Application?</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you absolutely sure you want to delete this job application? This action cannot be undone and you will lose the tailored CV and Cover Letter associated with it.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setAppToDelete(null)} 
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete} 
                style={{ padding: '8px 16px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Yes, delete it
              </button>
            </div>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.date}>{today}</div>
        <h1 className={styles.greeting}>
          {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}, {isLoaded && user ? user.firstName || "Heishigan" : "..."}
        </h1>
        <p className={styles.subtitle}>Streamlining your technical applications.</p>
      </header>

      <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricTitle}>Applied</div>
          <div className={styles.metricValue}>{stats.applied}</div>
        </div>
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricTitle}>Interviewing</div>
          <div className={styles.metricValue} style={{ color: '#60a5fa' }}>{stats.interviewing}</div>
        </div>
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricTitle}>Rejected</div>
          <div className={styles.metricValue} style={{ color: '#f87171' }}>{stats.rejected}</div>
        </div>
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricTitle}>OpenAI API Key</div>
          <div className={`${styles.metricValue} ${apiStatus === 'Active' ? styles.statusActive : styles.statusError}`}>
            {apiStatus}
          </div>
        </div>
      </div>

      <section className={styles.recentSection}>
        <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.sectionTitle}>Recent Applications</h2>
          <a href="/dashboard/pipeline" className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', borderRadius: '8px' }}>+ New Application</a>
        </div>
        <div className={`glass-panel`} style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Date</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Company</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Role</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '16px', color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No applications tracked yet.
                  </td>
                </tr>
              ) : (
                applications.map(app => (
                  <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '16px', color: 'rgba(255,255,255,0.8)' }}>
                      {editingId === app.id ? (
                        <input 
                          type="date" 
                          value={editForm.created_at} 
                          onChange={(e) => setEditForm({...editForm, created_at: e.target.value})}
                          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--accent-1)', color: 'white', padding: '4px 8px', borderRadius: '4px' }}
                        />
                      ) : (
                        format(new Date(app.created_at), "MMM d, yyyy")
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {editingId === app.id ? (
                        <input 
                          type="text" 
                          value={editForm.company_name} 
                          onChange={(e) => setEditForm({...editForm, company_name: e.target.value})}
                          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--accent-1)', color: 'white', padding: '4px 8px', borderRadius: '4px' }}
                        />
                      ) : (
                        <span style={{ color: 'white', fontWeight: 500 }}>{app.company_name}</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {editingId === app.id ? (
                        <input 
                          type="text" 
                          value={editForm.role_name} 
                          onChange={(e) => setEditForm({...editForm, role_name: e.target.value})}
                          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--accent-1)', color: 'white', padding: '4px 8px', borderRadius: '4px' }}
                        />
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.8)' }}>{app.role_name}</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {editingId === app.id ? (
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                          style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--accent-1)', color: 'white', padding: '4px 8px', borderRadius: '4px' }}
                        >
                          <option value="Applied">Applied</option>
                          <option value="Interviewing">Interviewing</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      ) : (
                        <span style={{ 
                          padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                          backgroundColor: (app.status || 'Applied') === 'Interviewing' ? 'rgba(96, 165, 250, 0.1)' : (app.status || 'Applied') === 'Rejected' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                          color: (app.status || 'Applied') === 'Interviewing' ? '#60a5fa' : (app.status || 'Applied') === 'Rejected' ? '#f87171' : 'var(--text-secondary)'
                        }}>
                          {app.status || "Applied"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {editingId === app.id ? (
                          <>
                            <button onClick={() => handleSaveEdit(app.id)} style={{ background: 'var(--accent-1)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditingId(null)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                          </>
                        ) : (
                          <>
                            <a href={`/dashboard/applications/${app.id}`} style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '6px 12px', borderRadius: '4px', fontSize: '14px' }}>View</a>
                            <button onClick={() => handleEditClick(app)} style={{ background: 'transparent', color: 'var(--accent-1)', border: '1px solid var(--accent-1)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Edit</button>
                            <button onClick={() => setAppToDelete(app.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>Delete</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
