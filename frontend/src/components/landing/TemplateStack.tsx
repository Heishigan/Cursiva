"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { CV_TEMPLATES } from "@/config/cvTemplates";
import styles from "./TemplateStack.module.css";

/** The five CV templates as a stack of cards: click (or press Enter) to send the top card to the back. */
export default function TemplateStack() {
  // order[0] is the card on top; Classic (Jake's) starts there.
  const [order, setOrder] = useState(CV_TEMPLATES.map((_, i) => i));
  const [leaving, setLeaving] = useState<number | null>(null);
  const top = CV_TEMPLATES[order[0]];

  const next = () => {
    if (leaving !== null) return;
    setLeaving(order[0]);
    window.setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setLeaving(null);
    }, 280);
  };

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.stack} onClick={next}
        aria-label={`${top.name} template. Show the next template`}>
        {CV_TEMPLATES.map((t, i) => {
          const depth = order.indexOf(i);
          const isLeaving = leaving === i;
          return (
            <div key={t.id}
              className={`${styles.card} ${isLeaving ? styles.leaving : ""}`}
              style={{ zIndex: CV_TEMPLATES.length - depth, ["--depth" as string]: depth }}
              aria-hidden={depth !== 0}>
              <Image src={`/templates/${t.id}.jpg`} alt={depth === 0 ? `A CV in the ${t.name} template` : ""}
                width={992} height={1403} className={styles.img} priority={depth === 0} />
            </div>
          );
        })}
      </button>

      <div className={styles.meta}>
        <div>
          <span className={styles.name}>{top.name}</span>
          <span className={styles.count}>{order[0] + 1} / {CV_TEMPLATES.length}</span>
        </div>
        <span className={styles.hint}>Click the CV to see the next style</span>
      </div>
      <div className={styles.credit}>
        {top.credit ? (
          <a href={top.credit.href} target="_blank" rel="noopener noreferrer">
            {top.credit.label} · github.com/jakegut/resume <ExternalLink size={12} />
          </a>
        ) : (
          <span>Original Cursiva design</span>
        )}
      </div>
    </div>
  );
}
