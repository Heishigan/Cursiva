import Link from 'next/link';
import styles from './layout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>Project Sentinel</div>
        <nav className={styles.nav}>
          <Link href="/dashboard" className={`${styles.navLink} ${styles.navLinkActive}`}>Dashboard</Link>
          <Link href="/dashboard/diff" className={styles.navLink}>Diff Viewer (Demo)</Link>
          <Link href="#" className={styles.navLink}>Applications</Link>
          <Link href="#" className={styles.navLink}>Settings</Link>
        </nav>
      </aside>
      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
