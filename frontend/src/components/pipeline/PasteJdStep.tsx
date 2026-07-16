"use client";

import styles from '@/app/dashboard/pipeline/pipeline.module.css';
import { useState } from 'react';

export default function PasteJdStep({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  
  return (
    <div className={`${styles.stepContainer} ${styles.animateFadeIn}`}>
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
          Analyze JD &rarr;
        </button>
      </div>
    </div>
  );
}
