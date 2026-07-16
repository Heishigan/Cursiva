"use client";
import styles from '@/app/dashboard/pipeline/pipeline.module.css';
import { useEffect, useRef } from 'react';

export default function AgentTerminal({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className={`${styles.terminalContainer} ${styles.animateFadeIn}`}>
      <div className={styles.terminalHeader}>
        <div className={`${styles.dot} ${styles.dotRed}`}></div>
        <div className={`${styles.dot} ${styles.dotYellow}`}></div>
        <div className={`${styles.dot} ${styles.dotGreen}`}></div>
        <span className={styles.terminalTitle}>AGENT_TERMINAL</span>
      </div>
      <div className={styles.terminalLogs}>
        {logs.map((log, idx) => (
          <div key={idx} className={styles.logRow}>
            <span className={styles.logPrompt}>{'>'}</span>
            <span className={styles.animatePulse}>{log}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
