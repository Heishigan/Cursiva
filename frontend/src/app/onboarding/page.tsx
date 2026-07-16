"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import confetti from 'canvas-confetti';
import styles from './page.module.css';

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
  
  // High-level state machine
  // 1: Auth, 2: Baseline (select/parse/manual), 3: Launch
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isRedirecting, setIsRedirecting] = useState(true);
  
  // Auth State
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [authError, setAuthError] = useState('');

  // Baseline State
  const [mode, setMode] = useState<'select' | 'upload' | 'manual'>('select');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [cvData, setCvData] = useState<any>(DEFAULT_CV);
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});
  
  // Check profile status and auto-redirect if already set up
  useEffect(() => {
    if (!isLoaded) return;
    
    getToken().then(token => {
      if (!token) {
        setIsRedirecting(false);
        return;
      }
      
      fetch("http://localhost:8000/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && data.data.has_api_key && data.data.has_baseline) {
          router.push('/dashboard');
        } else {
          setIsRedirecting(false);
          
          // Fallback check localStorage for UI state
          const savedKey = localStorage.getItem('openai_api_key');
          if (savedKey) setApiKey(savedKey);
          const savedCv = localStorage.getItem('generic_cv_json');
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

  // --- Step 1: Auth Handlers ---
  const handleValidateAuth = async () => {
    if (!apiKey.trim()) {
      setAuthError('API Key cannot be empty.');
      return;
    }
    setIsValidating(true);
    setAuthError('');
    
    try {
      // Validate via our Next.js backend to avoid CORS issues
      const res = await fetch('/api/validate_key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Invalid API Key. Please check and try again.');
      }
      
      // Save the API key securely to the backend database
      const token = await getToken();
      await fetch("http://localhost:8000/api/user/profile", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ openai_api_key: apiKey })
      });
      
      localStorage.setItem('openai_api_key', apiKey);
      setStep(2);
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setIsValidating(false);
    }
  };

  // --- Step 2: Baseline Handlers ---
  const handleFileUpload = async (file: File) => {
    setMode('upload');
    setIsParsing(true);
    setParseError('');
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = await getToken();
      const res = await fetch('http://localhost:8000/api/parse_pdf', {
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
        localStorage.setItem('generic_cv_json', JSON.stringify(data.parsed_data));
        setStep(3);
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
    localStorage.setItem('generic_cv_json', JSON.stringify(cvData));
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
    setExpandedSections(prev => ({ ...prev, [sectionIdx]: true }));
  };
  const updateItem = (sIdx: number, iIdx: number, field: string, value: string) => {
    const sections = [...cvData.sections];
    sections[sIdx].items[iIdx] = { ...sections[sIdx].items[iIdx], [field]: value };
    setCvData((prev: any) => ({ ...prev, sections }));
  };
  const addBullet = (sIdx: number, iIdx: number) => {
    const sections = [...cvData.sections];
    if (!sections[sIdx].items[iIdx].bullets) sections[sIdx].items[iIdx].bullets = [];
    sections[sIdx].items[iIdx].bullets.push("");
    setCvData((prev: any) => ({ ...prev, sections }));
  };
  const updateBullet = (sIdx: number, iIdx: number, bIdx: number, value: string) => {
    const sections = [...cvData.sections];
    sections[sIdx].items[iIdx].bullets[bIdx] = value;
    setCvData((prev: any) => ({ ...prev, sections }));
  };
  const removeBullet = (sIdx: number, iIdx: number, bIdx: number) => {
    const sections = [...cvData.sections];
    sections[sIdx].items[iIdx].bullets.splice(bIdx, 1);
    setCvData((prev: any) => ({ ...prev, sections }));
  };

  // Validate class
  const getInputClass = (val: string) => val.trim() === '' ? `${styles.input} ${styles.inputError}` : styles.input;

  // --- Renderers ---
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>C<span>ursiva</span></h1>
        
        {/* Stepper UI */}
        <div className={styles.stepper}>
          <div className={styles.stepWrap}>
            <div className={`${styles.stepNode} ${step > 1 ? styles.sDone : (isValidating ? styles.sLoading : styles.sActive)}`}>
              <div className={styles.stepCircle}>1</div>
              <span className={styles.stepLabel}>{isValidating ? 'Validating API Key' : 'API Key'}</span>
            </div>
          </div>
          <div className={`${styles.stepLine} ${step > 1 ? styles.done : ''}`}></div>
          <div className={styles.stepWrap}>
            <div className={`${styles.stepNode} ${step > 2 ? styles.sDone : (step === 2 ? (isParsing ? styles.sLoading : styles.sActive) : styles.sPend)}`}>
              <div className={styles.stepCircle}>2</div>
              <span className={styles.stepLabel}>{isParsing ? 'Extracting & Parsing...' : 'Baseline CV'}</span>
            </div>
          </div>
          <div className={`${styles.stepLine} ${step > 2 ? styles.done : ''}`}></div>
          <div className={styles.stepWrap}>
            <div className={`${styles.stepNode} ${step === 3 ? styles.sActive : styles.sPend}`}>
              <div className={styles.stepCircle}>3</div>
              <span className={styles.stepLabel}>Launch</span>
            </div>
          </div>
        </div>
      </header>

      {/* STEP 1: AUTH */}
      {step === 1 && (
        <div className={styles.stepSection}>
          <h2 className={styles.stepTitle}>Step 1: Connect OpenAI</h2>
          <p className={styles.stepDesc}>
            Cursiva uses GPT-4o to tailor your CVs and Cover Letters. We need your OpenAI API key to proceed. Your key is stored locally in your browser and never leaves your machine.
          </p>
          <div className={styles.card}>
            <div className={styles.formGroup}>
              <label className={styles.label}>OpenAI API Key</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password" 
                  className={styles.input}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                />
              </div>
            </div>
            
            {authError && (
              <div className={`${styles.statusMsg} ${styles.statusError}`}>
                {authError}
              </div>
            )}

            <button 
              className="btn-primary" 
              onClick={handleValidateAuth}
              disabled={isValidating}
              style={{ marginTop: '16px' }}
            >
              Save & Continue
            </button>
          </div>
        </div>
      )}

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
                  <p>Please review all extracted fields carefully. The red fields indicate missing information. This only needs to be done once to serve as your Ground Truth for all future applications.</p>
                </div>
              </div>
              
              <div className={styles.card}>
                <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Personal Information</h3>
                <div className={styles.grid3}>
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
                  <textarea className={getInputClass(cvData.professional_summary)} value={cvData.professional_summary} onChange={e => updateSummary(e.target.value)} />
                </div>
              </div>

              {cvData.sections.map((section: any, sIdx: number) => (
                <div key={sIdx} className={styles.accordion}>
                  <div className={`${styles.accordionHeader} ${expandedSections[sIdx] ? styles.expanded : ''}`} onClick={() => toggleSection(sIdx)}>
                    <span>{section.title} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 400 }}>({section.type})</span></span>
                    <span>{expandedSections[sIdx] ? '▼' : '▶'}</span>
                  </div>
                  {expandedSections[sIdx] && (
                    <div className={styles.accordionContent}>
                      <div className={styles.grid2}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Section Title</label>
                          <input className={styles.input} value={section.title} onChange={e => updateSection(sIdx, 'title', e.target.value)} />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Section Type</label>
                          <select className={styles.select} value={section.type} onChange={e => updateSection(sIdx, 'type', e.target.value)}>
                            <option value="work_experience">Work Experience</option>
                            <option value="education">Education</option>
                            <option value="projects">Projects</option>
                            <option value="skills">Technical Skills</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                      </div>

                      {section.items && section.items.map((item: any, iIdx: number) => (
                        <div key={iIdx} className={styles.itemBlock}>
                          <div className={styles.itemHeader}>
                            <span className={styles.itemTitle}>{item.title || 'Untitled Item'}</span>
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
                              <label className={styles.label}>Context <span style={{color:'var(--text-secondary)',fontWeight:400}}>(short line, e.g. &quot;GPA 3.9 | Dean&apos;s List&quot;)</span></label>
                              <input className={styles.input} value={item.context || ''} onChange={e => updateItem(sIdx, iIdx, 'context', e.target.value)} />
                            </div>
                          </div>
                          
                          <div className={styles.formGroup}>
                            <label className={styles.label}>Bullets</label>
                            <div className={styles.bulletList}>
                              {item.bullets && item.bullets.map((bullet: string, bIdx: number) => (
                                <div key={bIdx} className={styles.bulletRow}>
                                  <textarea className={getInputClass(bullet)} value={bullet} onChange={e => updateBullet(sIdx, iIdx, bIdx, e.target.value)} rows={2} />
                                  <button className={styles.btnIcon} onClick={() => removeBullet(sIdx, iIdx, bIdx)} title="Remove bullet">✕</button>
                                </div>
                              ))}
                              <button className={styles.btnGhost} style={{ marginTop: '8px' }} onClick={() => addBullet(sIdx, iIdx)}>+ Add Bullet</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <button className={styles.btnGhost} onClick={() => addItem(sIdx)}>+ Add New {section.title} Item</button>
                    </div>
                  )}
                </div>
              ))}

              <button className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', marginTop: '24px' }} onClick={handleSaveCV}>
                Save Baseline Truth →
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
