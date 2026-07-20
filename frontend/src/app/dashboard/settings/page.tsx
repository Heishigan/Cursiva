"use client";
import { useState, useEffect, Suspense } from "react";
import styles from "./settings.module.css";
import { useUser, useAuth } from "@clerk/nextjs";
import { CreditCard, Zap } from "lucide-react";
import { useSearchParams } from "next/navigation";

function SettingsContent() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (searchParams.get("success")) {
      setStatus("Payment successful! 15 credits have been added to your account.");
      setTimeout(() => setStatus(""), 5000);
    } else if (searchParams.get("canceled")) {
      setStatus("Payment was canceled.");
      setTimeout(() => setStatus(""), 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === "success") {
          setCredits(data.data.credits !== undefined ? data.data.credits : null);
        }
      } catch (e) {
        console.error("Failed to check profile", e);
      }
    };
    if (isLoaded && user) {
      fetchStatus();
    }
  }, [isLoaded, user, getToken]);

  const handleTopUp = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/create-checkout-session`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStatus("Failed to initiate checkout.");
        setTimeout(() => setStatus(""), 3000);
      }
    } catch (e) {
      setStatus("Error connecting to server.");
      setTimeout(() => setStatus(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account, billing, and preferences.</p>
      </header>

      {status && <div className={`${styles.statusMsg} ${status.includes('successful') ? styles.success : styles.error}`} style={{marginBottom: '24px', padding: '16px', borderRadius: '8px', background: status.includes('successful') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: status.includes('successful') ? '#4ade80' : '#f87171', border: status.includes('successful') ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)'}}>{status}</div>}

      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Zap size={24} color="#f59e0b" />
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>Billing & Credits</h2>
        </div>
        <p className={styles.cardDesc}>
          Cursiva uses a simple Pay-As-You-Go model. You pay a flat rate of $5.00 for 15 tailored application credits. Generating a complete tailored CV and Cover Letter costs exactly 1 credit.
        </p>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Current Balance</div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {credits !== null ? credits : '...'} <span style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-secondary)' }}>credits</span>
            </div>
          </div>
          {credits !== null && credits <= 5 && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
              Low Balance
            </div>
          )}
        </div>

        <button className={styles.saveBtn} onClick={handleTopUp} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#6366f1' }}>
          <CreditCard size={18} />
          {isLoading ? "Redirecting to Stripe..." : "Top Up 15 Credits - $5.00"}
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
