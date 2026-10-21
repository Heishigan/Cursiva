"use client";

import styles from './flow.module.css';
import { useState, useEffect } from 'react';

interface PasteJdStepProps {
  onSubmit: (jdText: string) => void;
  initialText?: string;
}

export default function PasteJdStep({ onSubmit, initialText = "" }: PasteJdStepProps) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

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
    <div className={`${styles.page} ${styles.narrow}`}>
      <header className={styles.head}>
        <h1 className={styles.title}>New application</h1>
        <p className={styles.subtitle}>Paste the job ad below. The whole page is fine: the Reader strips out the clutter and pulls out the requirements.</p>
      </header>

      <div className={`${styles.paper} ${styles.jdPaper}`}>
        <textarea
          id="jd-input"
          aria-label="Job ad"
          className={styles.jdInput}
          placeholder="Paste the full job description here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => onSubmit(text)} disabled={!text.trim()}>
          Read the job &rarr;
        </button>
      </div>
    </div>
  );
}
