import styles from '@/app/dashboard/pipeline/pipeline.module.css';

export default function DoneStep({ cvPdfUrl, clPdfUrl, jobMetadata, userName, onReset }: { cvPdfUrl: string, clPdfUrl: string, jobMetadata?: any, userName?: string, onReset: () => void }) {
  const cleanStr = (s?: string) => (s || "").replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const namePart = cleanStr(userName) || "User";
  const rolePart = cleanStr(jobMetadata?.role_name) || "Role";
  const companyPart = cleanStr(jobMetadata?.company_name) || "Company";
  
  const cvFilename = `${namePart}_${rolePart}_${companyPart}_CV.pdf`;
  const clFilename = `${namePart}_${rolePart}_${companyPart}_CoverLetter.pdf`;

  return (
    <div className={styles.animateFadeIn} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Application Ready
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Your documents have been compiled and saved. You can always view or edit this application later from your Dashboard.
        </p>
      </div>

      <div style={{ padding: '16px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderLeft: '4px solid var(--accent)', borderRadius: '8px', color: 'var(--text-primary)', marginBottom: '24px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
        <span style={{ color: 'var(--accent)', marginRight: '8px' }}>✓</span> PDF compilation complete.
      </div>

      <div className={styles.workbenchLayout}>
        <div className={styles.pane} style={{ padding: '8px', background: '#525659', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', padding: '8px 12px', fontWeight: 600 }}>
            Tailored CV
          </div>
          {cvPdfUrl ? (
            <>
              <iframe src={`${cvPdfUrl}#toolbar=1&view=FitH`} className={styles.pdfFrame} />
              <div className={styles.mobilePdfFallback}>
                <p>Mobile browsers cannot preview PDFs.</p>
              </div>
              <a href={cvPdfUrl} download={cvFilename} style={{ marginTop: '12px', padding: '10px 16px', background: 'var(--accent)', color: 'var(--accent-ink)', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>Download CV</a>
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>No CV generated.</div>
          )}
        </div>

        <div className={styles.pane} style={{ padding: '8px', background: '#525659', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', padding: '8px 12px', fontWeight: 600 }}>
            Cover Letter
          </div>
          {clPdfUrl ? (
            <>
              <iframe src={`${clPdfUrl}#toolbar=1&view=FitH`} className={styles.pdfFrame} />
              <div className={styles.mobilePdfFallback}>
                <p>Mobile browsers cannot preview PDFs.</p>
              </div>
              <a href={clPdfUrl} download={clFilename} style={{ marginTop: '12px', padding: '10px 16px', background: 'var(--accent)', color: 'var(--accent-ink)', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>Download Cover Letter</a>
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>No Cover Letter generated.</div>
          )}
        </div>
      </div>



    </div>
  );
}
