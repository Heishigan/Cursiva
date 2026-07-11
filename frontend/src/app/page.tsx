import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}></div>
        <div className={styles.container}>
          <h1 className={styles.heroTitle}>Project Sentinel</h1>
          <p className={styles.heroSubtitle}>
            The Agentic Job Hunter. Stop spray-and-pray applying. Deploy an autonomous Executive Assistant that builds meticulously researched, natively compiled applications.
          </p>
          <div className={styles.ctaGroup}>
            <Link href="/dashboard" className="btn-primary" style={{ display: 'inline-block', textAlign: 'center' }}>
              Launch Dashboard
            </Link>
            <a href="https://github.com/Heishigan/Cursiva" target="_blank" rel="noopener noreferrer" className={styles.btnSecondary}>
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* Why This Matters Section */}
      <section className={styles.whySection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Quality Over Quantity</h2>
          <div className={styles.featuresGrid}>
            
            <div className={`glass-panel ${styles.featureCard}`}>
              <span className={styles.featureIcon}>✦</span>
              <h3 className={styles.featureTitle}>Adversarial Critic Nodes</h3>
              <p className={styles.featureDesc}>
                Most tools wrap basic ChatGPT prompts. We use LangGraph Actor-Critic architecture to aggressively reject "AI-speak", em-dashes, and hallucinations before they ever reach the final draft.
              </p>
            </div>

            <div className={`glass-panel ${styles.featureCard}`}>
              <span className={styles.featureIcon}>✧</span>
              <h3 className={styles.featureTitle}>Native LaTeX Compilation</h3>
              <p className={styles.featureDesc}>
                Stand out from generic web-PDFs. Sentinel injects verified data strictly into professional, ATS-optimized LaTeX templates, compiled natively via our microservices.
              </p>
            </div>

            <div className={`glass-panel ${styles.featureCard}`}>
              <span className={styles.featureIcon}>✦</span>
              <h3 className={styles.featureTitle}>Zero Hallucination Guarantee</h3>
              <p className={styles.featureDesc}>
                Every metric, tool, and claim in the tailored CV is strictly bound to your uploaded source of truth. The agent weaves keywords organically without compromising your authentic voice.
              </p>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
