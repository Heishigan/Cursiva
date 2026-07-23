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
  const [strictEligibility, setStrictEligibility] = useState<boolean>(true);

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
          setStrictEligibility(data.data.strict_eligibility !== undefined ? data.data.strict_eligibility : true);
        }
      } catch (e) {
        console.error("Failed to check profile", e);
      }
    };
    if (isLoaded && user) {
      fetchStatus();
    }
  }, [isLoaded, user, getToken]);

  const toggleEligibility = async () => {
    const newVal = !strictEligibility;
    setStrictEligibility(newVal);
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user/profile`, {
        method: "POST",
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ strict_eligibility: newVal })
      });
    } catch (e) {
      console.error("Failed to update strict eligibility", e);
      setStrictEligibility(!newVal); // revert on failure
    }
  };

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

      <div className={styles.card} style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </div>
          <h2 className={styles.cardTitle} style={{ margin: 0 }}>Preferences</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ flex: 1, paddingRight: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Strict Eligibility Checks</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              When enabled, the JD Pipeline will automatically block applications where you lack mandatory visa requirements, location constraints, or essential language skills. This helps avoid wasting credits on roles you are fundamentally ineligible for.
            </p>
          </div>
          
          <label style={{ position: 'relative', display: 'inline-block', width: '52px', height: '28px' }}>
            <input 
              type="checkbox" 
              checked={strictEligibility} 
              onChange={toggleEligibility}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: strictEligibility ? '#6366f1' : 'rgba(255,255,255,0.2)',
              transition: '.3s', borderRadius: '34px'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '20px', width: '20px',
                left: strictEligibility ? '28px' : '4px', bottom: '4px',
                backgroundColor: 'white', transition: '.3s', borderRadius: '50%'
              }} />
            </span>
          </label>
        </div>
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
