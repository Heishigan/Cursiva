import Link from "next/link";
import styles from "./Logo.module.css";

interface LogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Logo({ href = "/", size = "md", className = "" }: LogoProps) {
  const content = (
    <span className={`${styles.logo} ${styles[size]} ${className}`}>
      <span className={styles.logoInitial}>C</span>
      <span className={styles.logoRest}>ursiva</span>
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className={styles.link}>
      {content}
    </Link>
  );
}
