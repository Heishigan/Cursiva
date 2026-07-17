import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { Search, Brain, FileText, CheckCircle, Zap, Mail, LayoutDashboard } from "lucide-react";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.container}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 100 }}>
        <Show when="signed-in">
          <UserButton />
        </Show>
        <Show when="signed-out">
          <Link href="/sign-in" style={{ textDecoration: 'none', color: 'var(--text-secondary)', marginRight: '16px' }}>Log In</Link>
          <Link href="/sign-up">
            <button className="btn-primary" style={{ padding: '8px 16px', borderRadius: '6px' }}>Sign Up</button>
          </Link>
        </Show>
      </div>

      <div className={styles.hero}>
        <div style={{ fontSize: '2.25rem', fontFamily: 'var(--font-plus-jakarta)', fontWeight: 800, marginBottom: '16px' }}>
          C<span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>ursiva</span>
        </div>
        <h1 className={styles.title}>
          Stop Applying.<br/><span className={styles.titleHighlight}>Start Strategizing.</span>
        </h1>
        <p className={styles.description}>
          Deploy a team of autonomous AI agents to research, tailor, and natively compile your technical job applications. Not just a keyword stuffer, but a true career executive assistant that crafts both your CV and Cover Letter.
        </p>
        <div className={styles.ctaGroup}>
          <Show when="signed-out">
            <Link href="/sign-up">
              <button className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '8px' }}>
                Deploy Your Agents - It&apos;s Free
              </button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard">
              <button className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.1rem', borderRadius: '8px' }}>
                Go to Dashboard &rarr;
              </button>
            </Link>
          </Show>
        </div>
      </div>

      <div className={styles.pipelineVisual}>
        <div className={styles.agentNode}>
          <div className={styles.agentIcon}><Search size={24} /></div>
          <div className={styles.agentLabel}>Requirements Extractor</div>
          <div className={styles.agentSub}>Analyzes JD</div>
        </div>
        <div className={styles.pipelineConnector}></div>
        <div className={styles.agentNode}>
          <div className={styles.agentIcon}><Brain size={24} /></div>
          <div className={styles.agentLabel}>Job Fit Strategist</div>
          <div className={styles.agentSub}>Formulates angle</div>
        </div>
        <div className={styles.pipelineConnector}></div>
        <div className={styles.agentNode}>
          <div className={styles.agentIcon}><FileText size={24} /></div>
          <div className={styles.agentLabel}>Resume Tailor</div>
          <div className={styles.agentSub}>Rewrites impact</div>
        </div>
        <div className={styles.pipelineConnector}></div>
        <div className={styles.agentNode}>
          <div className={styles.agentIcon}><CheckCircle size={24} /></div>
          <div className={styles.agentLabel}>Quality Reviewer</div>
          <div className={styles.agentSub}>Checks facts</div>
        </div>
        <div className={styles.pipelineConnector}></div>
        <div className={styles.agentNode}>
          <div className={styles.agentIcon}><Mail size={24} /></div>
          <div className={styles.agentLabel}>Cover Letter Writer</div>
          <div className={styles.agentSub}>Crafts narrative</div>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>An Autonomous Team at your Fingertips</h2>
          <p className={styles.sectionSubtitle}>Generic AI tools just replace words with keywords. Cursiva deploys specialized LangGraph agents that understand context, evaluate your fit, and strategize before they write a single word.</p>
        </div>
        <div className={styles.grid2}>
          <div className={styles.glassCard}>
            <div className={styles.cardIcon}><Brain size={28} /></div>
            <h3 className={styles.cardTitle}>Human-in-the-Loop Strategy</h3>
            <p className={styles.cardDesc}>Our Strategist agent analyzes the job description against your baseline CV, formulating a unique angle. You review and approve the strategy before tailoring begins.</p>
          </div>
          <div className={styles.glassCard}>
            <div className={styles.cardIcon}><CheckCircle size={28} /></div>
            <h3 className={styles.cardTitle}>Self-Correcting Pipeline</h3>
            <p className={styles.cardDesc}>The Reviewer agent critiques the drafted resume. If it hallucinates skills you don't have, or misses critical requirements, it kicks it back for a rewrite.</p>
          </div>
          <div className={styles.glassCard}>
            <div className={styles.cardIcon}><Zap size={28} /></div>
            <h3 className={styles.cardTitle}>Insanely Cost-Effective</h3>
            <p className={styles.cardDesc}>Bring your own OpenAI API key. A complete application including strategy, multiple resume drafts, and a cover letter costs roughly $0.05 per job.</p>
          </div>
          <div className={styles.glassCard}>
            <div className={styles.cardIcon}><FileText size={28} /></div>
            <h3 className={styles.cardTitle}>Native LaTeX Compilation</h3>
            <p className={styles.cardDesc}>No more struggling with MS Word formatting. Your tailored CV is natively compiled into a pristine, ATS-friendly LaTeX PDF directly on the server.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} style={{ textAlign: 'center', marginTop: '64px' }}>
        <h2 className={styles.sectionTitle} style={{ fontSize: '2.5rem', marginBottom: '32px' }}>Stop tweaking templates. Start winning interviews.</h2>
        <Show when="signed-out">
          <Link href="/sign-up">
            <button className="btn-primary" style={{ padding: '1.25rem 3rem', fontSize: '1.25rem', borderRadius: '12px' }}>
              Create Your Free Account
            </button>
          </Link>
        </Show>
        <Show when="signed-in">
          <Link href="/dashboard">
            <button className="btn-primary" style={{ padding: '1.25rem 3rem', fontSize: '1.25rem', borderRadius: '12px' }}>
              Launch Dashboard
            </button>
          </Link>
        </Show>
      </section>

      <footer className={styles.footer}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: '1.25rem', fontFamily: 'var(--font-plus-jakarta)' }}>C<span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>ursiva</span></div>
        </div>
        <p>Open-source tool by <a href="https://github.com/Heishigan" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-1)' }}>Heishigan Pathmaraj</a>.</p>
        <p style={{ marginTop: '8px' }}>Not a SaaS. No subscriptions. Bring your own key.</p>
      </footer>
    </main>
  );
}
