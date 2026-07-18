"use client";
import { useEffect, useState, useRef } from "react";
import styles from "./profile.module.css";
import { useUser, useAuth } from "@clerk/nextjs";
import { ExternalLink, FileText, Pencil, Plus, Briefcase, GraduationCap, Award, FolderGit2, Code2, Info, Globe, Download } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [cvData, setCvData] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [hasBaseline, setHasBaseline] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const fetchProfile = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.status === "success" && data.data.has_baseline) {
          const parsed = data.data.cv_data;
          
          // Reorder work experience to top for display
          const workIdx = parsed.sections.findIndex((s: any) => s.type === 'work_experience');
          if (workIdx > 0) {
            const workSec = parsed.sections.splice(workIdx, 1)[0];
            parsed.sections.unshift(workSec);
          }
          
          setCvData(parsed);
          setHasBaseline(true);
          
          // Cache to local storage for the pipeline frontend components that still check it (diff viewer etc)
          if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(parsed));
        } else {
          setHasBaseline(false);
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
        setHasBaseline(false);
      }
    };
    fetchProfile();
  }, [isLoaded, user]);

  const compilePdf = async (data: any) => {
    setIsCompiling(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/compile_cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.status === 'success') {
        const byteCharacters = atob(result.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        setPdfUrl(blobUrl);
      }
    } catch (e) {
      console.error("Compilation error:", e);
    }
    setIsCompiling(false);
  };

  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState<any>(null);
  const [editingItem, setEditingItem] = useState<{ sIdx: number, iIdx: number } | null>(null);
  const [itemForm, setItemForm] = useState<any>(null);
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  useEffect(() => {
    if (cvData && !pdfUrl && !isCompiling) {
      compilePdf(cvData);
    }
  }, [cvData]);

  const handleUploadNew = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/parse_pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCvData(data.parsed_data);
        if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(data.parsed_data));
        setHasBaseline(true);
        setUploadFile(null);
      } else {
        alert("Failed to parse PDF: " + (data.detail || data.reason || "Unknown error"));
      }
    } catch (e) {
      alert("Error parsing PDF. Is backend running?");
    }
    setIsUploading(false);
  };

  if (!isLoaded) {
    return (
      <div className={styles.splitLayout} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className={styles.spinner} style={{ width: '40px', height: '40px', borderWidth: '4px', opacity: 0.5 }}></div>
      </div>
    );
  }

  if (!hasBaseline) {
    return (
      <div className={styles.splitLayout} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className={styles.card} style={{ maxWidth: '600px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '1rem', justifyContent: 'center' }}>Upload New CV</h2>
          <p className={styles.summary} style={{ marginBottom: '2rem' }}>Drop your existing resume PDF here to instantly parse and generate a new baseline.</p>
          
          <input 
            type="file" 
            accept="application/pdf"
            ref={fileInputRef}
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
          
          {!uploadFile ? (
            <button 
              className={styles.btnGhost} 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--surface-border)', width: '100%', padding: '3rem', borderRadius: '12px' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <span>Click to Browse or Drag PDF Here</span>
            </button>
          ) : (
            <div style={{ padding: '2rem', border: '1px solid var(--surface-border)', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)' }}>
              <FileText size={32} style={{ color: 'var(--accent-1)', marginBottom: '1rem' }} />
              <p style={{ fontWeight: '600', marginBottom: '1.5rem' }}>{uploadFile.name}</p>
              <button 
                className={styles.btnPrimary} 
                onClick={handleUploadNew}
                disabled={isUploading}
                style={{ width: '100%' }}
              >
                {isUploading ? "Parsing..." : "Parse & Initialize Profile"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!cvData) {
    return (
      <div className={styles.splitLayout} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className={styles.spinner} style={{ width: '40px', height: '40px', borderWidth: '4px', opacity: 0.5 }}></div>
      </div>
    );
  }

  const openHeaderEdit = () => {
    setHeaderForm({
      name: cvData.personal_info.name || "",
      email: cvData.personal_info.email || "",
      phone: cvData.personal_info.phone || "",
      location: cvData.personal_info.location || "",
      github: cvData.personal_info.github || "",
      linkedin: cvData.personal_info.linkedin || "",
      portfolio: cvData.personal_info.portfolio || "",
      professional_summary: cvData.professional_summary || ""
    });
    setIsEditingHeader(true);
  };

  const saveHeaderEdit = () => {
    const newData = { ...cvData };
    newData.personal_info = {
      ...newData.personal_info,
      name: headerForm.name,
      email: headerForm.email,
      phone: headerForm.phone,
      location: headerForm.location,
      github: headerForm.github,
      linkedin: headerForm.linkedin,
      portfolio: headerForm.portfolio
    };
    newData.professional_summary = headerForm.professional_summary;
    setCvData(newData);
    if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(newData));
    compilePdf(newData);
    setIsEditingHeader(false);
  };

  const openItemEdit = (sIdx: number, iIdx: number, item?: any) => {
    setEditingItem({ sIdx, iIdx });
    if (item) {
      setItemForm({ 
        ...item, 
        bulletsText: item.bullets && Array.isArray(item.bullets) ? item.bullets.join('\n') : '' 
      });
    } else {
      setItemForm({
        title: "",
        subtitle: "",
        date: "",
        context: "",
        url: "",
        bulletsText: ""
      });
    }
  };

  const saveItemEdit = () => {
    if (!editingItem) return;
    const newData = { ...cvData };
    const updatedItem = { ...itemForm, url: itemForm.url || "" };
    updatedItem.bullets = (updatedItem.bulletsText || '').split('\n').filter((b: string) => b.trim() !== '');
    delete updatedItem.bulletsText;
    
    if (editingItem.iIdx === -1) {
      newData.sections[editingItem.sIdx].items.push(updatedItem);
    } else {
      newData.sections[editingItem.sIdx].items[editingItem.iIdx] = updatedItem;
    }
    
    setCvData(newData);
    if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(newData));
    compilePdf(newData);
    setEditingItem(null);
    setItemForm(null);
  };

  const deleteItemEdit = () => {
    if (!editingItem || editingItem.iIdx === -1) return;
    const confirmDelete = window.confirm("Are you sure you want to delete this entry?");
    if (confirmDelete) {
      const newData = { ...cvData };
      newData.sections[editingItem.sIdx].items.splice(editingItem.iIdx, 1);
      setCvData(newData);
      if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(newData));
      compilePdf(newData);
      setEditingItem(null);
      setItemForm(null);
    }
  };

  const addSection = () => {
    setNewSectionTitle('');
    setIsAddingSection(true);
  };

  const addSectionSubmit = () => {
    if (!newSectionTitle.trim()) {
      setIsAddingSection(false);
      return;
    }
    const newData = { ...cvData };
    newData.sections.push({
      title: newSectionTitle.trim(),
      type: "custom",
      items: []
    });
    setCvData(newData);
    if (user?.id) localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(newData));
    compilePdf(newData);
    setIsAddingSection(false);
  };

  const handleDownload = () => {
    if (!pdfUrl || !cvData) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    const cleanStr = (s?: string) => (s || "").replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const namePart = cleanStr(cvData.personal_info.name) || "User";
    a.download = `${namePart}_Generic_CV.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const wipeData = () => {
    setShowWipeConfirm(true);
  };

  const executeWipeData = () => {
    if (user?.id) {
      localStorage.removeItem(`generic_cv_json_${user.id}`);
      localStorage.removeItem(`job_description_${user.id}`);
      localStorage.removeItem(`diff_tailored_cv_${user.id}`);
      localStorage.removeItem(`diff_cover_letter_${user.id}`);
      localStorage.removeItem(`diff_company_${user.id}`);
      localStorage.removeItem(`diff_role_${user.id}`);
    }
    setCvData(null);
    setPdfUrl(null);
    setHasBaseline(false);
    setShowWipeConfirm(false);
  };

  const { personal_info, professional_summary, sections } = cvData;

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'work_experience': return <Briefcase size={20} />;
      case 'education': return <GraduationCap size={20} />;
      case 'projects': return <FolderGit2 size={20} />;
      case 'skills': return <Code2 size={20} />;
      default: return <Award size={20} />;
    }
  };

  const getTooltip = (field: string) => {
    if (!editingItem) return "";
    const sectionType = cvData.sections[editingItem.sIdx]?.type;
    
    if (sectionType === 'education') {
      switch (field) {
        case 'title': return "Enter your degree (e.g., B.S. in Computer Science).";
        case 'subtitle': return "Enter your institution's name (e.g., Stanford University).";
        case 'context': return "Optional: Enter your GPA, honors, or minor.";
      }
    } else if (sectionType === 'work_experience') {
      switch (field) {
        case 'title': return "Enter your exact role (e.g., Senior Software Engineer).";
        case 'subtitle': return "Enter the company name (e.g., Google).";
        case 'context': return "Optional: Enter the job location (e.g., San Francisco, CA) or team name.";
      }
    } else if (sectionType === 'projects') {
      switch (field) {
        case 'title': return "Enter the project name (e.g., Personal Portfolio Website).";
        case 'subtitle': return "Optional: Enter a live link, client name, or 'Academic Project'.";
        case 'context': return "Enter the core tech stack, tools, or methodologies used (e.g., React, Python, Figma).";
      }
    } else if (sectionType === 'skills') {
      switch (field) {
        case 'title': return "Enter the skill category (e.g., Languages, Frameworks, Tools).";
        case 'bullets': return "List your skills one per line. They will be formatted as a comma-separated list on the PDF.";
      }
    }
    
    switch (field) {
      case 'title': return "Enter the main title for this item.";
      case 'subtitle': return "Enter a secondary title or organization name.";
      case 'context': return "Enter any additional context or location info.";
      case 'date': return "The time period (e.g., Jan 2021 - Present). Keep formats consistent.";
      case 'bullets': return "One bullet point per line. Focus on quantifiable impact.";
      default: return "";
    }
  };

  return (
    <>
      {showWipeConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#1f2937', padding: '32px', borderRadius: '12px', width: '400px', border: '1px solid #ef4444', boxShadow: '0 20px 25px -5px rgba(239, 68, 68, 0.1), 0 10px 10px -5px rgba(239, 68, 68, 0.04)' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#f87171', marginBottom: '12px' }}>Wipe All Data?</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '24px', lineHeight: 1.5 }}>
              Are you absolutely sure you want to completely wipe your baseline CV and job customization? This cannot be undone and you will have to upload a new CV to continue.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowWipeConfirm(false)} 
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={executeWipeData} 
                style={{ padding: '8px 16px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Yes, wipe data
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={styles.splitLayout}>
        <div className={styles.leftColumn}>
        {/* Header Profile Card */}
        <div className={styles.card}>
          <div className={styles.headerLayout}>
            <div className={styles.avatar}>
              {user?.firstName?.charAt(0) || personal_info.name.charAt(0)}
            </div>
            <div className={styles.headerInfo}>
              <h1 className={styles.name}>{personal_info.name}</h1>
              <p className={styles.summary}>{professional_summary}</p>
              <p className={styles.location}>{personal_info.location}</p>
              <div className={styles.socials}>
                {personal_info.github && <a href={personal_info.github} target="_blank" rel="noreferrer"><FaGithub size={16}/> GitHub</a>}
                {personal_info.linkedin && <a href={personal_info.linkedin} target="_blank" rel="noreferrer"><FaLinkedin size={16}/> LinkedIn</a>}
                {personal_info.portfolio && <a href={personal_info.portfolio} target="_blank" rel="noreferrer"><Globe size={16}/> Portfolio</a>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className={styles.iconBtn} onClick={openHeaderEdit} title="Edit Profile"><Pencil size={18} /></button>
            </div>
          </div>
        </div>

        {/* Dynamic Sections */}
        {sections.map((section: any, sIdx: number) => (
          <div key={sIdx} className={styles.sectionGroup}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <button className={styles.iconBtn} onClick={() => openItemEdit(sIdx, -1)}><Plus size={18}/></button>
            </div>

            <div className={styles.cardGroup}>
              {section.items.map((item: any, iIdx: number) => (
                <div key={iIdx} className={styles.itemCard}>
                  <div className={styles.itemLayout}>
                    
                    <div className={styles.itemIconBox}>
                      {getSectionIcon(section.type)}
                    </div>
                    
                    <div className={styles.itemContent}>
                      <div className={styles.itemHeader}>
                        <h3 className={styles.itemTitle}>{item.title}</h3>
                        <button className={styles.iconBtnSmall} onClick={() => openItemEdit(sIdx, iIdx, item)}>
                          <Pencil size={14}/>
                        </button>
                      </div>
                      
                      {(item.subtitle || item.date) && (
                        <div className={styles.itemMeta}>
                          {item.subtitle}{item.subtitle && item.date && " • "}{item.date}
                        </div>
                      )}

                      {item.context && <p className={styles.itemContext}>{item.context}</p>}
                      
                      {section.type !== 'skills' && item.bullets && item.bullets.length > 0 && (
                        <ul className={styles.bullets}>
                          {item.bullets.map((b: string, bIdx: number) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      )}

                      {section.type === 'skills' && (
                         <div className={styles.badges}>
                           {item.bullets.map((b: string, bIdx: number) => {
                             if (!b.trim()) return null;
                             return <span key={bIdx} className={styles.badge}>{b}</span>;
                           })}
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <button 
          onClick={addSection}
          className={styles.btnGhost} 
          style={{ width: '100%', border: '1px dashed var(--surface-border)', margin: '1rem 0' }}
        >
          <Plus size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/>
          Add Custom Section
        </button>

        <button 
          onClick={wipeData}
          className={styles.btnGhost} 
          style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444', marginTop: '2rem' }}
        >
          Wipe Data & Upload New CV
        </button>
      </div>

      <div className={styles.rightColumn}>
        <div className={styles.pdfContainer}>
          {isCompiling && (
            <div className={styles.pdfOverlay}>
              <div className={styles.spinner}></div>
              <span>Recompiling PDF...</span>
            </div>
          )}
          {pdfUrl ? (
            <>
              <iframe src={`${pdfUrl}#view=FitH`} className={styles.pdfFrame} title="CV Preview" />
              <button 
                className={styles.downloadFab}
                onClick={handleDownload}
              >
                <Download size={18} />
                Download PDF
              </button>
            </>
          ) : (
            <div className={styles.loading}>Generating Preview...</div>
          )}
        </div>
      </div>

      {isEditingHeader && headerForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Edit Header Info</h2>
            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <label>Full Name</label>
                <input value={headerForm.name} onChange={e => setHeaderForm({...headerForm, name: e.target.value})} />
              </div>
              <div className={styles.modalField}>
                <label>Email</label>
                <input value={headerForm.email} onChange={e => setHeaderForm({...headerForm, email: e.target.value})} />
              </div>
              <div className={styles.modalField}>
                <label>Phone</label>
                <input value={headerForm.phone} onChange={e => setHeaderForm({...headerForm, phone: e.target.value})} />
              </div>
              <div className={styles.modalField}>
                <label>Location</label>
                <input value={headerForm.location} onChange={e => setHeaderForm({...headerForm, location: e.target.value})} />
              </div>
              <div className={styles.modalField}>
                <label>Github URL</label>
                <input value={headerForm.github} onChange={e => setHeaderForm({...headerForm, github: e.target.value})} />
              </div>
              <div className={styles.modalField}>
                <label>LinkedIn URL</label>
                <input value={headerForm.linkedin} onChange={e => setHeaderForm({...headerForm, linkedin: e.target.value})} />
              </div>
              <div className={styles.modalField} style={{ gridColumn: '1 / -1' }}>
                <label>Portfolio URL</label>
                <input value={headerForm.portfolio} onChange={e => setHeaderForm({...headerForm, portfolio: e.target.value})} />
              </div>
              <div className={styles.modalField} style={{ gridColumn: '1 / -1' }}>
                <label>Professional Summary</label>
                <textarea 
                  rows={4} 
                  value={headerForm.professional_summary} 
                  onChange={e => setHeaderForm({...headerForm, professional_summary: e.target.value})} 
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setIsEditingHeader(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={saveHeaderEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {editingItem && itemForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>
              {editingItem.iIdx === -1 
                ? (itemForm.title ? `Add New: ${itemForm.title}` : `Add New to ${cvData.sections[editingItem.sIdx]?.title || 'Item'}`)
                : (itemForm.title ? `Edit: ${itemForm.title}` : `Edit in ${cvData.sections[editingItem.sIdx]?.title || 'Item'}`)}
            </h2>
            <div className={styles.modalGrid}>
              <div className={styles.modalField} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.labelWithInfo}>
                  {cvData.sections[editingItem.sIdx]?.type === 'skills' ? 'Skill Category' : 'Title'}
                  <div className={styles.infoWrapper}>
                    <Info size={14} className={styles.infoIcon} />
                    <div className={styles.tooltip}>{getTooltip('title')}</div>
                  </div>
                </label>
                <input 
                  value={itemForm.title} 
                  onChange={e => setItemForm({...itemForm, title: e.target.value})} 
                />
              </div>

              {cvData.sections[editingItem.sIdx]?.type !== 'skills' && (
                <>
                  <div className={styles.modalField}>
                    <label className={styles.labelWithInfo}>
                      Subtitle
                      <div className={styles.infoWrapper}>
                        <Info size={14} className={styles.infoIcon} />
                        <div className={styles.tooltip}>{getTooltip('subtitle')}</div>
                      </div>
                    </label>
                    <input 
                      value={itemForm.subtitle} 
                      onChange={e => setItemForm({...itemForm, subtitle: e.target.value})} 
                    />
                  </div>
                  <div className={styles.modalField}>
                    <label className={styles.labelWithInfo}>
                      Date
                      <div className={styles.infoWrapper}>
                        <Info size={14} className={styles.infoIcon} />
                        <div className={styles.tooltip}>{getTooltip('date')}</div>
                      </div>
                    </label>
                    <input 
                      value={itemForm.date} 
                      onChange={e => setItemForm({...itemForm, date: e.target.value})} 
                    />
                  </div>
                  <div className={styles.modalField} style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.labelWithInfo}>
                      Context
                      <div className={styles.infoWrapper}>
                        <Info size={14} className={styles.infoIcon} />
                        <div className={styles.tooltip}>{getTooltip('context')}</div>
                      </div>
                    </label>
                    <input 
                      value={itemForm.context} 
                      onChange={e => setItemForm({...itemForm, context: e.target.value})} 
                    />
                  </div>
                  <div className={styles.modalField} style={{ gridColumn: '1 / -1' }}>
                    <label className={styles.labelWithInfo}>
                      Link / URL
                      <div className={styles.infoWrapper}>
                        <Info size={14} className={styles.infoIcon} />
                        <div className={styles.tooltip}>Optional link (e.g., live project, certificate URL)</div>
                      </div>
                    </label>
                    <input 
                      value={itemForm.url || ""} 
                      onChange={e => setItemForm({...itemForm, url: e.target.value})} 
                      placeholder="https://"
                    />
                  </div>
                </>
              )}

              <div className={styles.modalField} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.labelWithInfo}>
                  {cvData.sections[editingItem.sIdx]?.type === 'skills' ? 'Skills List' : 'Bullet Points'}
                  <div className={styles.infoWrapper}>
                    <Info size={14} className={styles.infoIcon} />
                    <div className={styles.tooltip}>{getTooltip('bullets')}</div>
                  </div>
                </label>
                <textarea 
                  rows={6} 
                  value={itemForm.bulletsText} 
                  onChange={e => setItemForm({...itemForm, bulletsText: e.target.value})} 
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              {editingItem.iIdx !== -1 && (
                <button className={styles.btnGhost} style={{ color: '#ef4444', marginRight: 'auto' }} onClick={deleteItemEdit}>Delete Entry</button>
              )}
              <button className={styles.btnGhost} onClick={() => { setEditingItem(null); setItemForm(null); }}>Cancel</button>
              <button className={styles.btnPrimary} onClick={saveItemEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {isAddingSection && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '400px' }}>
            <h2 className={styles.modalTitle}>Add Custom Section</h2>
            <div className={styles.modalGrid}>
              <div className={styles.modalField} style={{ gridColumn: '1 / -1' }}>
                <label>Section Title</label>
                <input 
                  autoFocus
                  value={newSectionTitle} 
                  onChange={e => setNewSectionTitle(e.target.value)} 
                  placeholder="e.g., Volunteer Experience"
                  onKeyDown={e => { if (e.key === 'Enter') addSectionSubmit(); }}
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnGhost} onClick={() => setIsAddingSection(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={addSectionSubmit}>Create Section</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
