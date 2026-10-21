import styles from "./flow.module.css";

const STEPS = ["Job ad", "Strategy", "Drafts", "Done"];

/** Quiet progress rail shown above every pipeline step. `current` is 1-4. */
export default function FlowRail({ current }: { current: number }) {
  return (
    <nav aria-label="Progress">
      <ol className={styles.rail}>
        {STEPS.map((label, i) => {
          const n = i + 1;
          const cls = n === current ? styles.railNow : n < current ? styles.railDone : "";
          return (
            <li key={label} className={`${styles.railItem} ${cls}`} aria-current={n === current ? "step" : undefined}>
              <span className={styles.railNum}>{String(n).padStart(2, "0")}</span>
              {label}
            </li>
          );
        })}
      </ol>
      <div className={styles.railPhone}>
        <span>{String(current).padStart(2, "0")} {STEPS[current - 1]}</span>
        <span className={styles.railBars} aria-hidden="true">
          {STEPS.map((label, i) => (
            <span key={label} className={`${styles.railBar} ${i + 1 === current ? styles.railBarNow : i + 1 < current ? styles.railBarDone : ""}`} />
          ))}
        </span>
        <span className={styles.railOf}>of 04</span>
      </div>
    </nav>
  );
}
