import styles from './flow.module.css';

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12m-5-5 5 5 5-5M5 20h14" />
    </svg>
  );
}

function Sheet({ url, label }: { url: string; label: string }) {
  return (
    <div className={`${styles.paper} ${styles.docSheet}`} aria-label={`${label} preview`}>
      {url ? (
        <>
          <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`} title={`${label} preview`} className={styles.previewFrame} tabIndex={-1} />
          <div className={styles.previewFallback}>{label}</div>
        </>
      ) : (
        <div className={styles.waitingSheet} style={{ padding: 24 }}>No {label === "CV" ? "CV" : label.toLowerCase()} generated.</div>
      )}
    </div>
  );
}

export default function DoneStep({ cvPdfUrl, clPdfUrl, jobMetadata, userName, onReset }: { cvPdfUrl: string, clPdfUrl: string, jobMetadata?: any, userName?: string, onReset: () => void }) {
  const cleanStr = (s?: string) => (s || "").replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const namePart = cleanStr(userName) || "User";
  const rolePart = cleanStr(jobMetadata?.role_name) || "Role";
  const companyPart = cleanStr(jobMetadata?.company_name) || "Company";

  const cvFilename = `${namePart}_${rolePart}_${companyPart}_CV.pdf`;
  const clFilename = `${namePart}_${rolePart}_${companyPart}_CoverLetter.pdf`;
  const eyebrow = [jobMetadata?.role_name, jobMetadata?.company_name].filter(Boolean).join(' · ');

  return (
    <div className={`${styles.page} ${styles.medium}`} style={{ gap: 36 }}>
      <header className={styles.headRow}>
        <div className={styles.head}>
          <h1 className={styles.title}>Ready to send</h1>
          <p className={styles.subtitle}>{eyebrow ? `${eyebrow}. ` : ""}Saved to your dashboard, where you can open and edit it any time.</p>
        </div>
        <button className={styles.link} onClick={onReset}>Start another application &rarr;</button>
      </header>

      <div className={styles.docs}>
        <div className={styles.doc}>
          <Sheet url={cvPdfUrl} label="CV" />
          <div className={styles.fname}>{cvFilename}</div>
          {cvPdfUrl && <a href={cvPdfUrl} download={cvFilename} className={styles.btn}><DownloadIcon />Download CV</a>}
        </div>
        <div className={styles.doc}>
          <Sheet url={clPdfUrl} label="Cover letter" />
          <div className={styles.fname}>{clFilename}</div>
          {clPdfUrl && <a href={clPdfUrl} download={clFilename} className={styles.ghost}><DownloadIcon />Download cover letter</a>}
        </div>
      </div>
    </div>
  );
}
