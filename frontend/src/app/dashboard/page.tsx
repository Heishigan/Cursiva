import styles from './page.module.css';

export default function Dashboard() {
  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Welcome back, Heishigan</h1>
        <p className={styles.subtitle}>Your agentic job hunter is currently standing by.</p>
      </header>

      <div className={styles.grid}>
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricTitle}>Active Pipelines</div>
          <div className={styles.metricValue}>3</div>
        </div>
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricTitle}>CVs Tailored (This Month)</div>
          <div className={styles.metricValue}>12</div>
        </div>
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.metricTitle}>Credits Remaining</div>
          <div className={styles.metricValue}>85</div>
        </div>
      </div>

      <section className={styles.recentSection}>
        <h2 className={styles.recentTitle}>Recent Applications</h2>
        <p style={{ color: 'var(--text-secondary)' }}>You have no new applications drafted. Provide a job description to trigger the tailors.</p>
        <button className="btn-primary" style={{ marginTop: '24px' }}>+ New Application Pipeline</button>
      </section>
    </div>
  );
}
