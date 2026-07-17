import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { Search, Brain, FileText, CheckCircle, Zap, Mail, LayoutDashboard } from "lucide-react";
import { FaGithub } from "react-icons/fa";
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

      <section className={styles.section}>
        <div className={styles.grid2}>
          <div>
            <h2 className={styles.sectionTitle}>Why Jake&apos;s Resume Format?</h2>
            <p className={styles.sectionSubtitle} style={{ marginLeft: 0, textAlign: 'left', marginBottom: '24px' }}>
              We exclusively compile your tailored CV and Cover Letter into the legendary "Jake's Resume" LaTeX template and a standard business format. Here is why:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <CheckCircle size={20} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }}/>
                <span><strong>100% ATS Parser Compatibility.</strong> Complex columns, icons, and graphic templates confuse Applicant Tracking Systems. Jake's format is perfectly structured text.</span>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <CheckCircle size={20} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }}/>
                <span><strong>High Readability.</strong> Recruiters scan resumes in 6 seconds. This academic-grade format directs eyes straight to your bolded job titles, companies, and impact metrics.</span>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <CheckCircle size={20} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }}/>
                <span><strong>Persuasive Cover Letters.</strong> We also generate a highly targeted Cover Letter (CL) that pairs beautifully with your CV, compiled in a clean, standard business letter format.</span>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <CheckCircle size={20} color="#34d399" style={{ flexShrink: 0, marginTop: '2px' }}/>
                <span><strong>Pristine PDF Compilation.</strong> We don't use sketchy HTML-to-PDF generators. Your documents are compiled via pdflatex on our servers, generating flawless, crisp PDFs every time.</span>
              </li>
            </ul>
          </div>
          
          <div className={styles.resumePreview}>
            <div className={styles.resumeHeader}>
              <div className={styles.resumeName}>John Doe</div>
              <div className={styles.resumeContact}>San Francisco, CA • (123) 456-7890 • john.doe@email.com • github.com/johndoe</div>
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

      <footer className={styles.footer} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '48px', paddingBottom: '48px', marginTop: '64px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontWeight: 800, fontSize: '1.5rem', fontFamily: 'var(--font-plus-jakarta)' }}>C<span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>ursiva</span></div>
          </div>
          
          <div style={{ display: 'flex', gap: '24px', color: 'var(--text-secondary)' }}>
            <a href="https://github.com/Heishigan/Cursiva" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
              <FaGithub size={24} />
            </a>
            <a href="mailto:hej@heishi.se" className={styles.socialLinkEmail}>
              <Mail size={24} />
            </a>
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6' }}>
            <p>Designed and built by <a href="https://heishi.se" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-1)', textDecoration: 'none' }}>Heishigan Pathmaraj</a>.</p>
            <p style={{ marginTop: '16px', fontSize: '0.85rem', opacity: 0.7 }}>&copy; {new Date().getFullYear()} Cursiva. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
