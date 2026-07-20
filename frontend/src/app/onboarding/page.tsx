"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import confetti from 'canvas-confetti';
import styles from './page.module.css';
import profileStyles from '../dashboard/profile/profile.module.css';
import { Briefcase, GraduationCap, Code, Globe, User, Pencil, Plus, Trash2, ArrowDown } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa";

// Default Schema — matches gui_v2.py FullCVData exactly
const DEFAULT_CV = {
  personal_info: { name: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
  professional_summary: '',
  sections: [
    { title: 'Work Experience', type: 'work_experience', items: [] },
    { title: 'Education', type: 'education', items: [] },
    { title: 'Projects', type: 'projects', items: [] },
    { title: 'Technical Skills', type: 'skills', items: [] }
  ]
};

export default function Onboarding() {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();
  const { user } = useUser();
  
  // High-level state machine
  // 2: Baseline (select/parse/manual), 3: Launch
  const [step, setStep] = useState<2 | 3>(2);
  const [isRedirecting, setIsRedirecting] = useState(true);

  // Baseline State
  const [mode, setMode] = useState<'select' | 'upload' | 'manual'>('select');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [cvData, setCvData] = useState<any>(DEFAULT_CV);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingItem, setEditingItem] = useState<{sIdx: number, iIdx: number} | null>(null);

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'work_experience': return <Briefcase size={20} color="var(--accent-1)" />;
      case 'education': return <GraduationCap size={20} color="var(--accent-1)" />;
      case 'projects': return <Code size={20} color="var(--accent-1)" />;
      default: return <User size={20} color="var(--accent-1)" />;
    }
  };
  
  // Check profile status and auto-redirect if already set up
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    getToken().then(token => {
      if (!token) {
        setIsRedirecting(false);
        return;
      }
      
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && data.data.has_baseline) {
          router.push('/dashboard');
        } else {
          setIsRedirecting(false);
          
          // Fallback check localStorage for UI state
          const savedCv = localStorage.getItem(`generic_cv_json_${user.id}`);
          if (savedCv) {
            try {
              const parsed = JSON.parse(savedCv);
              if (parsed.personal_info) setCvData(parsed);
            } catch (e) {}
          }
        }
      })
      .catch(() => {
        setIsRedirecting(false);
      });
    });
  }, [isLoaded, getToken, router]);

  if (isRedirecting) {
    return (
      <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: '#6366f1',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // --- Step 2: Baseline Handlers ---
  const handleFileUpload = async (file: File) => {
    setMode('upload');
    setIsParsing(true);
    setParseError('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/parse_pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Backend error' }));
        throw new Error(err.detail || 'Parsing failed on backend');
      }
      
      const data = await res.json();
      
      if (data.status === 'success') {
        setCvData(data.parsed_data);
        if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(data.parsed_data));
        setMode('manual');
      } else {
        setParseError("Failed to parse PDF: " + (data.reason || "Unknown error"));
      }
    } catch (e: any) {
      setParseError(e.message || "Error parsing PDF. Is backend running?");
    }
    setIsParsing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSaveCV = () => {
    if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(cvData));
    setStep(3);
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }, 100);
  };

  // Form Field Updaters
  const updatePersonalInfo = (field: string, value: string) => {
    setCvData((prev: any) => ({ ...prev, personal_info: { ...prev.personal_info, [field]: value } }));
  };
  const updateSummary = (value: string) => {
    setCvData((prev: any) => ({ ...prev, professional_summary: value }));
  };
  const updateSection = (idx: number, field: string, value: string) => {
    const sections = [...cvData.sections];
    sections[idx] = { ...sections[idx], [field]: value };
    setCvData((prev: any) => ({ ...prev, sections }));
  };
  const toggleSection = (idx: number) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };
  const addItem = (sectionIdx: number) => {
    const sections = [...cvData.sections];
    if (!sections[sectionIdx].items) sections[sectionIdx].items = [];
    sections[sectionIdx].items.push({
      title: '',
      subtitle: '',
      date: '',
      url: '',
      context: '',
      bullets: []
    });
    setCvData((prev: any) => ({ ...prev, sections }));
    setEditingItem({ sIdx: sectionIdx, iIdx: sections[sectionIdx].items.length - 1 });
  };
  const updateItem = (sIdx: number, iIdx: number, field: string, value: string) => {
    const sections = [...cvData.sections];
    sections[sIdx].items[iIdx] = { ...sections[sIdx].items[iIdx], [field]: value };
    setCvData((prev: any) => ({ ...prev, sections }));
  };
  const updateBulletsText = (sIdx: number, iIdx: number, text: string) => {
    const sections = [...cvData.sections];
    sections[sIdx].items[iIdx].bullets = text.split('\n').filter(b => b.trim() !== '');
    setCvData((prev: any) => ({ ...prev, sections }));
  };
  const deleteItem = (sIdx: number, iIdx: number) => {
    if (confirm("Are you sure you want to delete this item?")) {
      const sections = [...cvData.sections];
      sections[sIdx].items.splice(iIdx, 1);
      setCvData((prev: any) => ({ ...prev, sections }));
    }
  };

  // Validate class
  const getInputClass = (val: string) => val.trim() === '' ? `${styles.input} ${styles.inputError}` : styles.input;

  // --- Renderers ---
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <div className={styles.logo}>C<span>ursiva</span></div>
          <div className={styles.stepper}>
            <div className={styles.stepWrap}>
              <div className={`${styles.stepNode} ${step >= 2 ? styles.sActive : styles.sPend}`}>
                <div className={styles.stepCircle}>1</div>
                <span className={styles.stepLabel}>Baseline CV</span>
              </div>
              <div className={`${styles.stepLine} ${step >= 3 ? styles.done : ''}`}></div>
              <div className={`${styles.stepNode} ${step >= 3 ? styles.sActive : styles.sPend}`}>
                <div className={styles.stepCircle}>2</div>
                <span className={styles.stepLabel}>Ready</span>
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* STEP 2: BASELINE CV */}
      {step === 2 && (
        <div className={styles.stepSection}>
          <h2 className={styles.stepTitle}>Step 2: Build your Baseline CV</h2>
          <p className={styles.stepDesc}>
            This is your master resume. The AI will extract relevant experiences from this baseline to tailor applications to specific job descriptions.
          </p>
          
          {mode === 'select' && (
            <div className={styles.choiceGrid}>
              <div className={styles.choiceCard} onClick={() => setMode('upload')}>
                <div className={styles.choiceIcon}>📄</div>
                <div className={styles.choiceTitle}>Parse from PDF</div>
                <div className={styles.choiceDesc}>Upload your existing CV and let GPT-4o extract and structure it automatically.</div>
              </div>
              <div className={styles.choiceCard} onClick={() => setMode('manual')}>
                <div className={styles.choiceIcon}>✏️</div>
                <div className={styles.choiceTitle}>Manual Entry</div>
                <div className={styles.choiceDesc}>Build your Baseline CV from scratch using the structured form editor.</div>
              </div>
            </div>
          )}

          {mode === 'upload' && !isParsing && (
            <>
              <div className={styles.label} style={{ marginBottom: '8px' }}>UPLOAD YOUR CV (PDF)</div>
              <div className={styles.dropZone} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
                <div className={styles.dropIcon}>☁️</div>
                <div className={styles.dropText}>Drag and drop file here</div>
                <div className={styles.dropSub}>Limit 200MB per file • PDF</div>
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
                  }}
                  style={{ display: 'none' }} 
                  id="pdfUpload"
                />
                <button 
                  className={styles.btnGhost} 
                  style={{ width: 'auto', marginTop: '16px' }}
                  onClick={() => document.getElementById('pdfUpload')?.click()}
                >
                  Browse files
                </button>
              </div>
              <button className={styles.btnGhost} style={{ width: 'auto' }} onClick={() => setMode('select')}>Cancel</button>

              {parseError && (
                <div className={`${styles.statusMsg} ${styles.statusError}`} style={{ marginTop: '24px' }}>
                  Parsing failed: {parseError}
                </div>
              )}
            </>
          )}

          {mode === 'manual' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <button className={styles.btnGhost} style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setMode('select')}>← Back</button>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Step 2 of 2 — Review your Baseline CV carefully.</p>
              </div>
              <div className={styles.banner}>
                <div className={styles.bannerIcon}>⚠️</div>
                <div className={styles.bannerText}>
                  <p><strong>Review Required</strong></p>
                  <p>Please verify your extracted CV carefully. Fix any wrongly parsed or missed data here. <strong>You ONLY have to do this ONCE!</strong> This serves as your Ground Truth for all future applications.</p>
                </div>
              </div>
              
              {/* Header Profile Card */}
              {editingHeader ? (
                <div className={styles.card} style={{ marginBottom: '24px' }}>
                  <div className={styles.itemHeader}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Editing Personal Info</h3>
                    <button className={styles.btnGhost} style={{ width: 'auto', padding: '4px 12px' }} onClick={() => setEditingHeader(false)}>Done</button>
                  </div>
                  <div className={styles.grid3} style={{ marginTop: '16px' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Full Name</label>
                      <input className={getInputClass(cvData.personal_info.name)} value={cvData.personal_info.name} onChange={e => updatePersonalInfo('name', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Email</label>
                      <input className={getInputClass(cvData.personal_info.email)} value={cvData.personal_info.email} onChange={e => updatePersonalInfo('email', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Phone</label>
                      <input className={getInputClass(cvData.personal_info.phone)} value={cvData.personal_info.phone} onChange={e => updatePersonalInfo('phone', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Location</label>
                      <input className={getInputClass(cvData.personal_info.location)} value={cvData.personal_info.location} onChange={e => updatePersonalInfo('location', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>LinkedIn URL</label>
                      <input className={styles.input} value={cvData.personal_info.linkedin} onChange={e => updatePersonalInfo('linkedin', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>GitHub URL</label>
                      <input className={styles.input} value={cvData.personal_info.github} onChange={e => updatePersonalInfo('github', e.target.value)} />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Professional Summary</label>
                    <textarea className={getInputClass(cvData.professional_summary)} value={cvData.professional_summary} onChange={e => updateSummary(e.target.value)} rows={4} />
                  </div>
                </div>
              ) : (
                <div className={profileStyles.card} style={{ marginBottom: '32px' }}>
                  <div className={profileStyles.headerLayout}>
                    <div className={profileStyles.avatar}>
                      {cvData.personal_info.name ? cvData.personal_info.name.charAt(0) : 'U'}
                    </div>
                    <div className={profileStyles.headerInfo}>
                      <h1 className={profileStyles.name}>{cvData.personal_info.name || 'Your Name'}</h1>
                      <p className={profileStyles.summary}>{cvData.professional_summary || 'Your professional summary'}</p>
                      <p className={profileStyles.location}>{cvData.personal_info.location}</p>
                      <div className={profileStyles.socials}>
                        {cvData.personal_info.github && <a href={cvData.personal_info.github} target="_blank" rel="noreferrer"><FaGithub size={16}/> GitHub</a>}
                        {cvData.personal_info.linkedin && <a href={cvData.personal_info.linkedin} target="_blank" rel="noreferrer"><FaLinkedin size={16}/> LinkedIn</a>}
                        {cvData.personal_info.portfolio && <a href={cvData.personal_info.portfolio} target="_blank" rel="noreferrer"><Globe size={16}/> Portfolio</a>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button className={profileStyles.iconBtn} onClick={() => setEditingHeader(true)} title="Edit Profile"><Pencil size={18} /></button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Sections */}
              {cvData.sections.map((section: any, sIdx: number) => (
                <div key={sIdx} className={profileStyles.sectionGroup}>
                  <div className={profileStyles.sectionHeader}>
                    <h2 className={profileStyles.sectionTitle}>{section.title}</h2>
                    <button className={profileStyles.iconBtn} onClick={() => addItem(sIdx)} title={`Add ${section.title}`}><Plus size={18}/></button>
                  </div>

                  <div className={profileStyles.cardGroup}>
                    {section.items.map((item: any, iIdx: number) => {
                      const isEditing = editingItem?.sIdx === sIdx && editingItem?.iIdx === iIdx;
                      
                      return isEditing ? (
                        <div key={iIdx} className={styles.card} style={{ padding: '24px', marginBottom: '16px' }}>
                          <div className={styles.itemHeader} style={{ marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Editing {item.title || 'Item'}</h3>
                            <button className={styles.btnGhost} style={{ width: 'auto', padding: '4px 12px' }} onClick={() => setEditingItem(null)}>Done</button>
                          </div>
                          
                          <div className={styles.grid2}>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Title / Role</label>
                              <input className={getInputClass(item.title)} value={item.title || ''} onChange={e => updateItem(sIdx, iIdx, 'title', e.target.value)} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Subtitle / Company</label>
                              <input className={styles.input} value={item.subtitle || ''} onChange={e => updateItem(sIdx, iIdx, 'subtitle', e.target.value)} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Date / Duration</label>
                              <input className={styles.input} value={item.date || ''} onChange={e => updateItem(sIdx, iIdx, 'date', e.target.value)} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>URL <span style={{color:'var(--text-secondary)',fontWeight:400}}>(optional)</span></label>
                              <input className={styles.input} value={item.url || ''} onChange={e => updateItem(sIdx, iIdx, 'url', e.target.value)} placeholder="https://..." />
                            </div>
                            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                              <label className={styles.label}>Context <span style={{color:'var(--text-secondary)',fontWeight:400}}>(short line, e.g. "GPA 3.9 | Dean's List")</span></label>
                              <input className={styles.input} value={item.context || ''} onChange={e => updateItem(sIdx, iIdx, 'context', e.target.value)} />
                            </div>
                          </div>
                          
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Bullets <span style={{color:'var(--text-secondary)',fontWeight:400}}>(One bullet per line)</span></label>
                            <textarea 
                              className={styles.input} 
                              value={item.bullets ? item.bullets.join('\n') : ''} 
                              onChange={e => updateBulletsText(sIdx, iIdx, e.target.value)} 
                              rows={5} 
                            />
                          </div>
                        </div>
                      ) : (
                        <div key={iIdx} className={profileStyles.itemCard}>
                          <div className={profileStyles.itemLayout}>
                            <div className={profileStyles.itemIconBox}>
                              {getSectionIcon(section.type)}
                            </div>
                            <div className={profileStyles.itemContent}>
                              <div className={profileStyles.itemHeader}>
                                <h3 className={profileStyles.itemTitle}>{item.title || 'Untitled'}</h3>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button className={profileStyles.iconBtnSmall} onClick={() => setEditingItem({ sIdx, iIdx })}>
                                    <Pencil size={14}/>
                                  </button>
                                  <button className={profileStyles.iconBtnSmall} style={{ color: 'var(--error)' }} onClick={() => deleteItem(sIdx, iIdx)}>
                                    <Trash2 size={14}/>
                                  </button>
                                </div>
                              </div>
                              
                              {(item.subtitle || item.date) && (
                                <div className={profileStyles.itemMeta}>
                                  {item.subtitle}{item.subtitle && item.date && " • "}{item.date}
                                </div>
                              )}

                              {item.context && <p className={profileStyles.itemContext}>{item.context}</p>}
                              
                              {section.type !== 'skills' && item.bullets && item.bullets.length > 0 && (
                                <ul className={profileStyles.bullets}>
                                  {item.bullets.map((b: string, bIdx: number) => (
                                    <li key={bIdx}>{b}</li>
                                  ))}
                                </ul>
                              )}

                              {section.type === 'skills' && item.bullets && (
                                 <div className={profileStyles.badges}>
                                   {item.bullets.map((b: string, bIdx: number) => {
                                     if (!b.trim()) return null;
                                     return <span key={bIdx} className={profileStyles.badge}>{b}</span>;
                                   })}
                                 </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', marginTop: '24px' }} onClick={handleSaveCV}>
                Confirm & Save Baseline →
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: LAUNCH */}
      {step === 3 && (
        <div className={styles.stepSection}>
          <div className={styles.card} style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div className={styles.confettiIcon}>🎉</div>
            <h2 className={styles.title} style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Setup Complete!</h2>
            <p className={styles.stepDesc} style={{ fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 32px' }}>
              Your OpenAI API Key is validated and your Baseline Truth is securely stored in your browser. You are now ready to unleash the Agentic Job Hunter.
            </p>
            <button className="btn-primary" onClick={() => router.push('/dashboard')}>
              Go to Dashboard →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
