"use client";

import styles from '@/app/dashboard/pipeline/pipeline.module.css';
import { useState, useEffect } from 'react';

export default function PasteJdStep({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (text.trim().length > 0) {
      sessionStorage.setItem('safeToLeave', 'false');
    } else {
      sessionStorage.setItem('safeToLeave', 'true');
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (text.trim().length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [text]);
  
  return (
    <div className={`${styles.stepContainer} ${styles.animateFadeIn}`} style={{ maxWidth: '1200px', width: '90%' }}>
      <div className={styles.header}>
        <h1 className={styles.title}>Start Your Application</h1>
        <p className={styles.subtitle}>Paste the job description below to begin the analysis.</p>
      </div>

      <div className={styles.textareaBox}>
        <textarea 
          className={styles.textarea}
          placeholder="Paste the full job description here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      
      <div className={styles.buttonContainer}>
        <button 
          className={styles.primaryBtn}
          onClick={() => onSubmit(text)}
          disabled={!text.trim()}
        >
          Start Pipeline &rarr;
        </button>
      </div>
    </div>
  );
}
