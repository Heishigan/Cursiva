import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { Mail } from "lucide-react";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        
        {/* Brand Column */}
        <div className={styles.brandColumn}>
          <Link href="/" className={styles.logo}>
            C<span>ursiva</span>
          </Link>
          <p className={styles.tagline}>
            Deploy a team of autonomous AI agents to research, tailor, and natively compile your technical job applications.
          </p>
          <div className={styles.socialLinks}>
            <a href="https://github.com/Heishigan/Cursiva" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="GitHub">
              <FaGithub size={24} />
            </a>
            <a href="mailto:hej@heishi.se" className={styles.socialLink} aria-label="Email">
              <Mail size={24} />
            </a>
          </div>
        </div>

        {/* Product Column */}
        <div>
          <h3 className={styles.columnTitle}>Product</h3>
          <ul className={styles.linkList}>
            <li><Link href="/sign-up">Sign Up</Link></li>
            <li><Link href="/sign-in">Log In</Link></li>
            <li><Link href="/dashboard">Dashboard</Link></li>
            <li>
              <a href="https://github.com/Heishigan/Cursiva" target="_blank" rel="noopener noreferrer">
                Open Source
              </a>
            </li>
          </ul>
        </div>

        {/* Legal Column */}
        <div>
          <h3 className={styles.columnTitle}>Legal</h3>
          <ul className={styles.linkList}>
            <li><Link href="/privacy">Privacy Policy</Link></li>
            <li><Link href="/terms">Terms of Service</Link></li>
            <li><Link href="/cookies">Cookie Policy</Link></li>
          </ul>
        </div>

        {/* Support Column */}
        <div>
          <h3 className={styles.columnTitle}>Support</h3>
          <ul className={styles.linkList}>
            <li><a href="mailto:hej@heishi.se">Contact Us</a></li>
            <li><a href="https://github.com/Heishigan/Cursiva/issues" target="_blank" rel="noopener noreferrer">Report an Issue</a></li>
          </ul>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className={styles.bottomBar}>
        <p>Designed and built by <a href="https://heishi.se" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-1)', textDecoration: 'none' }}>Heishigan Pathmaraj</a>.</p>
        <p>&copy; {new Date().getFullYear()} Cursiva. All rights reserved.</p>
      </div>
    </footer>
  );
}
