import styles from '@/app/dashboard/pipeline/pipeline.module.css';

export default function DoneStep({ cvPdfUrl, clPdfUrl, onReset }: { cvPdfUrl: string, clPdfUrl: string, onReset: () => void }) {
  return (
    <div className={styles.animateFadeIn} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Application Ready
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Your documents have been compiled and saved.
        </p>
      </div>

      <div style={{ padding: '16px', background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)', borderRadius: '8px', color: '#4ade80', marginBottom: '24px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
        ✓ PDF compilation complete.
      </div>

      <div className={styles.workbenchLayout}>
        <div className={styles.pane} style={{ padding: '8px', background: '#525659', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', padding: '8px 12px', fontWeight: 600 }}>
            Tailored CV
          </div>
          {cvPdfUrl ? (
            <>
              <iframe src={`${cvPdfUrl}#toolbar=1&view=FitH`} style={{ width: '100%', flex: 1, border: 'none', borderRadius: '8px' }} />
              <a href={cvPdfUrl} download="Tailored_CV.pdf" style={{ marginTop: '12px', padding: '10px 16px', background: 'var(--accent-1)', color: 'white', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>Download CV</a>
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
              <iframe src={`${clPdfUrl}#toolbar=1&view=FitH`} style={{ width: '100%', flex: 1, border: 'none', borderRadius: '8px' }} />
              <a href={clPdfUrl} download="Cover_Letter.pdf" style={{ marginTop: '12px', padding: '10px 16px', background: 'var(--accent-1)', color: 'white', textDecoration: 'none', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: 600 }}>Download Cover Letter</a>
            </>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>No Cover Letter generated.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
        <button className={styles.secondaryBtn} onClick={onReset}>
          &larr; New Application
        </button>
      </div>

    </div>
  );
}
