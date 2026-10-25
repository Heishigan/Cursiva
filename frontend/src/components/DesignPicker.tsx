"use client";
import Image from "next/image";
import styles from "./DesignPicker.module.css";
import { CV_TEMPLATES, type CvTemplateId } from "@/config/cvTemplates";

/** The five CV and cover letter designs as a row of cards: each shows the CV in
 *  front of its matching letter. Picking one is the user's choice for every application. */
export default function DesignPicker({ value, onChange, busy = false, labelledBy }: {
  value: CvTemplateId | null;
  onChange: (id: CvTemplateId) => void;
  busy?: boolean;
  labelledBy?: string;
}) {
  return (
    <div className={styles.grid} role="radiogroup" aria-labelledby={labelledBy} aria-busy={busy}>
      {CV_TEMPLATES.map((t) => {
        const on = value === t.id;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={on} title={t.blurb}
            disabled={value === null || (busy && !on)}
            className={`${styles.option} ${on ? styles.on : ""}`} onClick={() => onChange(t.id)}>
            <span className={styles.sheets} aria-hidden="true">
              <span className={`${styles.sheet} ${styles.letter}`}>
                <Image src={`/templates/${t.id}-letter.jpg`} alt="" width={992} height={1403} sizes="90px" />
              </span>
              <span className={`${styles.sheet} ${styles.cv}`}>
                <Image src={`/templates/${t.id}.jpg`} alt="" width={992} height={1403} sizes="90px" />
              </span>
              {on && (
                <span className={styles.check}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
              )}
            </span>
            <span className={styles.name}>{t.name}</span>
          </button>
        );
      })}
    </div>
  );
}
