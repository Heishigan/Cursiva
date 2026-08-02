import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { CheckCircle2 } from "lucide-react";
import styles from "./page.module.css";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <main className={styles.container}>
        <header className={styles.header}>
          <div className={styles.logo}>Cursiva</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Show when="signed-in">
              <UserButton />
            </Show>
            <Show when="signed-out">
              <Link href="/sign-in" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
                Log In
              </Link>
              <Link href="/sign-up">
                <button style={{ padding: '6px 16px', background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Sign Up</button>
              </Link>
            </Show>
          </div>
        </header>

        <div className={styles.hero}>
          <h1 className={`${styles.title} font-anton`}>
            STOP APPLYING.<br />
            START <span className={styles.titleHighlight}>STRATEGIZING.</span>
          </h1>
          <p className={styles.description}>
            Deploy a team of autonomous AI agents to research, tailor, and natively compile your technical job applications. Not just a keyword stuffer, but a true career executive assistant that crafts both your CV and Cover Letter.
          </p>
          <Show when="signed-out">
            <Link href="/sign-up">
              <button className="btn-primary">Deploy Your Agents For Free</button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard">
              <button className="btn-primary">Go to Dashboard &rarr;</button>
            </Link>
          </Show>
        </div>

        <div className={styles.pipelineVisual}>
          <div className={styles.agentNode}>
            <div className={styles.agentNumber}>01</div>
            <div className={styles.agentLabel}>Requirements Extractor</div>
            <div className={styles.agentSub}>Analyzes JD</div>
          </div>
          <div className={styles.agentNode}>
            <div className={styles.agentNumber}>02</div>
            <div className={styles.agentLabel}>JD Hit Strategist</div>
            <div className={styles.agentSub}>Formulates angle</div>
          </div>
          <div className={styles.agentNode}>
            <div className={styles.agentNumber}>03</div>
            <div className={styles.agentLabel}>Resume Tailor</div>
            <div className={styles.agentSub}>Matches exact fit</div>
          </div>
          <div className={styles.agentNode}>
            <div className={styles.agentNumber}>04</div>
            <div className={styles.agentLabel}>Quality Reviewer</div>
            <div className={styles.agentSub}>Checks facts</div>
          </div>
          <div className={styles.agentNode}>
            <div className={styles.agentNumber}>05</div>
            <div className={styles.agentLabel}>Cover Letter Writer</div>
            <div className={styles.agentSub}>Crafts narrative</div>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={`${styles.sectionTitle} font-anton`}>AN AUTONOMOUS TEAM AT YOUR FINGERTIPS</h2>
            <p className={styles.sectionSubtitle}>
              Generic AI tools just replace words with keywords. Cursiva deploys specialized LangGraph agents that understand context, evaluate your fit, and strategize before they write a single word.
            </p>
          </div>
          <div className={styles.grid2}>
            <div className={styles.glassCard}>
              <div className={styles.cardIcon}>01</div>
              <h3 className={styles.cardTitle}>Human-in-the-Loop Strategy</h3>
              <p className={styles.cardDesc}>Our JD Litigant agent analyzes the job data against your baseline CV, formulating a unique angle. You review and approve the strategy before tailoring begins.</p>
            </div>
            <div className={styles.glassCard}>
              <div className={styles.cardIcon}>02</div>
              <h3 className={styles.cardTitle}>Self-Correcting Pipeline</h3>
              <p className={styles.cardDesc}>If a Reviewer agent critiques the drafted resume, if it hallucinates skills you don't have, or misses critical requirements, it kicks it back for a rewrite.</p>
            </div>
            <div className={styles.glassCard}>
              <div className={styles.cardIcon}>03</div>
              <h3 className={styles.cardTitle}>Pay-As-You-Go Credits</h3>
              <p className={styles.cardDesc}>No expensive monthly subscriptions. Pay a flat rate of $5.00 for 15 tailored application credits. Generating a complete tailored CV and Cover Letter costs exactly 1 credit.</p>
            </div>
            <div className={styles.glassCard}>
              <div className={styles.cardIcon}>04</div>
              <h3 className={styles.cardTitle}>Native LaTeX Compilation</h3>
              <p className={styles.cardDesc}>No more struggling with MS Word formatting. Your tailored CV is natively compiled into a pristine, ATS-friendly LaTeX PDF directly on our servers.</p>
            </div>
            <div className={styles.glassCard}>
              <div className={styles.cardIcon}>05</div>
              <h3 className={styles.cardTitle}>Application Tracking Dashboard</h3>
              <p className={styles.cardDesc}>Track the lifecycle of your applications in a centralized view. Manage saved jobs, batch delete, and review tailored CVs and cover letters all from one place.</p>
            </div>
            <div className={styles.glassCard}>
              <div className={styles.cardIcon}>06</div>
              <h3 className={styles.cardTitle}>1-Click Chrome Extension</h3>
              <p className={styles.cardDesc}>Instantly parse and save jobs from LinkedIn or Indeed directly to your dashboard. Our AI will automatically calculate a semantic match score against your baseline CV.</p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={`${styles.sectionTitle} font-anton`}>WHY JAKE'S RESUME FORMAT?</h2>
            <p className={styles.sectionSubtitle} style={{ marginLeft: 0, textAlign: 'left', marginBottom: '40px' }}>
              We exclusively compile your tailored CV and Cover Letter into the legendary "Jake's Resume" LaTeX template and a standard business format. Here is why:
            </p>
          </div>
          <div className={styles.grid2}>
            <div>
              <ul className={styles.featureList}>
                <li className={styles.featureItem}>
                  <CheckCircle2 size={20} className={styles.checkIcon} />
                  <span><span className={styles.featureTitle}>100% ATS Parser Compatibility.</span> Complex columns, icons, and graphic templates confuse Applicant Tracking Systems. Jake's format is perfectly structured text.</span>
                </li>
                <li className={styles.featureItem}>
                  <CheckCircle2 size={20} className={styles.checkIcon} />
                  <span><span className={styles.featureTitle}>High Readability.</span> Recruiters scan resumes in 6 seconds. This academic-grade format directs eyes straight to your bolded job titles, companies, and impact metrics.</span>
                </li>
                <li className={styles.featureItem}>
                  <CheckCircle2 size={20} className={styles.checkIcon} />
                  <span><span className={styles.featureTitle}>Persuasive Cover Letters.</span> We also generate a highly targeted Cover Letter (CL) that pairs beautifully with your CV, compiled in a clean, standard business letter format.</span>
                </li>
                <li className={styles.featureItem}>
                  <CheckCircle2 size={20} className={styles.checkIcon} />
                  <span><span className={styles.featureTitle}>Pristine PDF Compilation.</span> We don't use sketchy HTML-to-PDF generators. Your documents are compiled via pdflatex on our servers, generating flawless, crisp PDFs every time.</span>
                </li>
              </ul>
            </div>
            
            <div className={styles.resumePreview}>
              <div className={styles.resumeHeader}>
                <div className={styles.resumeName}>John Doe</div>
                <div className={styles.resumeContact}>San Francisco, CA • (123) 456-7890 • github.com/johndoe</div>
              </div>
              
              <div className={styles.resumeSectionTitle}>Experience</div>
              <div className={styles.resumeItem}>
                <span>Senior Software Engineer | TechCorp</span>
                <span>Jan 2021 - Present</span>
              </div>
              <ul className={styles.resumeBullets}>
                <li>Architected and deployed a highly scalable microservices architecture...</li>
                <li>Led a team of 5 engineers to deliver the flagship product, increasing revenue by 15%...</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.section} style={{ marginTop: '80px' }}>
          <h2 className={`${styles.sectionTitle} font-anton`} style={{ fontSize: '4.5rem', marginBottom: '32px' }}>
            STOP TWEAKING TEMPLATES.<br />START WINNING INTERVIEWS.
          </h2>
          <Show when="signed-out">
            <Link href="/sign-up">
              <button className="btn-primary" style={{ padding: '1.25rem 3rem', fontSize: '1.25rem' }}>
                Create Your Free Account
              </button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard">
              <button className="btn-primary" style={{ padding: '1.25rem 3rem', fontSize: '1.25rem' }}>
                Launch Dashboard
              </button>
            </Link>
          </Show>
        </section>

      </main>
      <Footer />
    </>
  );
}
