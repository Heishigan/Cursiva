import styles from './page.module.css';

export default function DiffViewer() {
  return (
    <div>
      <header className={styles.header}>
        <h1 className={styles.title}>Application Diff: Spotify Data Scientist</h1>
        <p className={styles.subtitle}>Review the Agent's proposed changes before compiling to LaTeX.</p>
      </header>

      <div className={styles.diffContainer}>
        {/* Source Panel */}
        <div className={`glass-panel ${styles.panel}`} style={{ padding: 0 }}>
          <div className={styles.panelHeader}>
            <span>Generic CV (Source of Truth)</span>
            <span className={styles.badge}>v1.0</span>
          </div>
          <div className={styles.panelContent}>
            <p><strong>Professional Summary</strong></p>
            <p>Data Scientist with 3 years of experience building machine learning models. <span className={styles.removed}>Passionate about data and improving system performance.</span></p>
            <br />
            <p><strong>Experience: TechCorp</strong></p>
            <p>• Built a classifier <span className={styles.removed}>that was very robust</span>, achieving 94% accuracy.</p>
            <p>• Developed a data pipeline <span className={styles.removed}>to seamlessly handle various</span> data sources.</p>
          </div>
        </div>

        {/* Tailored Panel */}
        <div className={`glass-panel ${styles.panel}`} style={{ padding: 0, borderColor: 'var(--accent-1)' }}>
          <div className={styles.panelHeader}>
            <span>Tailored CV (Agent Proposal)</span>
            <span className={styles.badge} style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>Ready for Review</span>
          </div>
          <div className={styles.panelContent}>
            <p><strong>Professional Summary</strong></p>
            <p>Data Scientist with 3 years of experience building machine learning models. <span className={styles.added}>Specializing in audio recommendation systems and high-throughput data pipelines.</span></p>
            <br />
            <p><strong>Experience: TechCorp</strong></p>
            <p>• Built a <span className={styles.added}>scikit-learn Random Forest</span> classifier, achieving 94% accuracy <span className={styles.added}>on streaming datasets</span>.</p>
            <p>• Architected a data pipeline <span className={styles.added}>using Apache Kafka</span> to handle <span className={styles.added}>real-time user activity</span> data sources.</p>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button style={{ background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Reject & Regenerate</button>
        <button className="btn-primary">Approve & Compile LaTeX</button>
      </div>
    </div>
  );
}
