"use client";
import { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { format } from "date-fns";
import { Briefcase, Clock, XCircle, Key, Eye, Edit2, Trash2, Plus } from "lucide-react";
import styles from './page.module.css';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const [credits, setCredits] = useState<number | null>(null);
  const [parsedName, setParsedName] = useState<string | null>(null);

  const [applications, setApplications] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ company_name: '', role_name: '', status: '', created_at: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!isLoaded || !user) return;
    const fetchStatus = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === "success") {
          setCredits(data.data.credits || 0);
          setParsedName(data.data.cv_data?.personal_info?.name || null);
        }
      } catch (e) {
        console.error("Failed to fetch status", e);
      }
    };
    
    const fetchApplications = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications`, {
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
      const isoDate = new Date(editForm.created_at).toISOString();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications/${appId}`, {
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

  const confirmDelete = (ids: string[]) => {
    setItemsToDelete(ids);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    const ids = itemsToDelete;
    if (ids.length === 0) return;
    
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications/batch-delete`, {
        method: "POST",
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        setApplications(prev => prev.filter(a => !ids.includes(a.id)));
        setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
        setShowDeleteModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedApplications.length) {
      setSelectedIds(prev => prev.filter(id => !paginatedApplications.map(a => a.id).includes(id)));
    } else {
      const newSelected = new Set([...selectedIds, ...paginatedApplications.map(a => a.id)]);
      setSelectedIds(Array.from(newSelected));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const stats = {
    applied: applications.filter(a => (a.status || 'Applied') === 'Applied').length,
    interviewing: applications.filter(a => a.status === 'Interviewing').length,
    rejected: applications.filter(a => a.status === 'Rejected').length
  };

  const totalPages = Math.ceil(applications.length / itemsPerPage);
  const paginatedApplications = applications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: '#0f111a', padding: '32px', borderRadius: '24px', width: '420px', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 24px 48px -12px rgba(239, 68, 68, 0.2)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trash2 size={24} /> {itemsToDelete.length > 1 ? `Delete ${itemsToDelete.length} Applications?` : 'Delete Application?'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.6 }}>
              {itemsToDelete.length > 1 
                ? `Are you absolutely sure you want to delete these ${itemsToDelete.length} job applications? This action cannot be undone.`
                : `Are you absolutely sure you want to delete this job application? This action cannot be undone and you will lose the tailored CV and Cover Letter associated with it.`}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowDeleteModal(false)} 
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete} 
                style={{ padding: '10px 20px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)' }}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.greeting}>
          {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}, {parsedName || (isLoaded && user ? user.firstName : null) || "Guest"}
        </h1>
        <p className={styles.date}>{today}</p>
        <p className={styles.subtitle}>Streamlining your technical applications.</p>
      </header>

      <div className={styles.grid}>
        <div className={styles.metricCard} style={{ animationDelay: '0.1s' }}>
          <div className={styles.metricTitle}>
            <Briefcase size={16} color="#818cf8" />
            Applied
          </div>
          <div className={styles.metricValue}>{stats.applied}</div>
        </div>
        
        <div className={styles.metricCard} style={{ animationDelay: '0.2s' }}>
          <div className={styles.metricTitle}>
            <Clock size={16} color="#c084fc" />
            Interviewing
          </div>
          <div className={styles.metricValue}>{stats.interviewing}</div>
        </div>
        
        <div className={styles.metricCard} style={{ animationDelay: '0.3s' }}>
          <div className={styles.metricTitle}>
            <XCircle size={16} color="#f87171" />
            Rejected
          </div>
          <div className={styles.metricValue}>{stats.rejected}</div>
        </div>
        
        <div className={styles.metricCard} style={{ animationDelay: '0.4s' }}>
          <div className={styles.metricTitle}>
            <Key size={16} color="#10b981" />
            Credits
          </div>
          <div className={`${styles.metricValue} ${credits !== null && credits > 0 ? styles.statusActive : styles.statusError}`} style={{ fontSize: credits !== null && credits > 0 ? undefined : '1.75rem', lineHeight: '1.2' }}>
            {credits !== null ? credits : "..."}
          </div>
        </div>
      </div>

      <div className={styles.recentSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Applications</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            {selectedIds.length > 0 && (
              <button onClick={() => confirmDelete(selectedIds)} style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                <Trash2 size={16} /> Delete Selected ({selectedIds.length})
              </button>
            )}
            <a href="/dashboard/pipeline" className={styles.actionBtn} style={{ background: 'var(--accent-1)', padding: '8px', color: 'white', borderRadius: '8px' }} title="New Application">
              <Plus size={20} />
            </a>
          </div>
        </div>

        {applications.length === 0 ? (
          <div className={styles.emptyState}>
            <Briefcase size={48} color="rgba(255,255,255,0.2)" />
            <p>You haven't added any applications yet. <br/>Start the pipeline to create your first tailored CV.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <div className={styles.tableHeader} style={{ gridTemplateColumns: '40px 1fr 1.5fr 1fr 1fr 100px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input type="checkbox" checked={paginatedApplications.length > 0 && paginatedApplications.every(a => selectedIds.includes(a.id))} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
              </div>
              <div>Date</div>
              <div>Company</div>
              <div>Role</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>
            
            <div className={styles.appList}>
              {paginatedApplications.map((app, index) => (
                <div key={app.id} className={styles.appCard} style={{ gridTemplateColumns: '40px 1fr 1.5fr 1fr 1fr 100px', animationDelay: `${0.5 + index * 0.1}s` }}>
                  {editingId === app.id ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}></div>
                      <input 
                        type="date" 
                        value={editForm.created_at} 
                        onChange={e => setEditForm({...editForm, created_at: e.target.value})}
                        style={{ background: '#1f2937', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px', borderRadius: '6px' }}
                      />
                      <input 
                        type="text" 
                        value={editForm.company_name} 
                        onChange={e => setEditForm({...editForm, company_name: e.target.value})}
                        style={{ background: '#1f2937', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px', borderRadius: '6px', width: '90%' }}
                      />
                      <input 
                        type="text" 
                        value={editForm.role_name} 
                        onChange={e => setEditForm({...editForm, role_name: e.target.value})}
                        style={{ background: '#1f2937', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px', borderRadius: '6px', width: '90%' }}
                      />
                      <select 
                        value={editForm.status} 
                        onChange={e => setEditForm({...editForm, status: e.target.value})}
                        style={{ background: '#1f2937', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px', borderRadius: '6px' }}
                      >
                        <option value="Applied">Applied</option>
                        <option value="Interviewing">Interviewing</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
                        <button onClick={() => handleSaveEdit(app.id)} style={{ padding: '8px 16px', background: 'var(--accent-1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', lineHeight: '1', display: 'flex', alignItems: 'center' }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '7px 15px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', lineHeight: '1', display: 'flex', alignItems: 'center' }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input type="checkbox" checked={selectedIds.includes(app.id)} onChange={() => toggleSelect(app.id)} style={{ cursor: 'pointer' }} />
                      </div>
                      <div className={styles.colDate}>
                        {format(new Date(app.created_at), "MMM d, yyyy")}
                      </div>
                      <div className={styles.colCompany}>{app.company_name}</div>
                      <div className={styles.colRole}>{app.role_name}</div>
                      <div className={styles.colStatus}>
                        <span className={`${styles.statusBadge} ${
                          app.status === 'Interviewing' ? styles.statusInterviewing : 
                          app.status === 'Rejected' ? styles.statusRejected : 
                          styles.statusApplied
                        }`}>
                          {app.status || "Applied"}
                        </span>
                      </div>
                      <div className={styles.colActions}>
                        <a href={`/dashboard/applications/${app.id}`} className={styles.actionBtn} title="View">
                          <Eye size={18} />
                        </a>
                        <button onClick={() => handleEditClick(app)} className={styles.actionBtn} title="Edit">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => confirmDelete([app.id])} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
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
