"use client";
import { useState, useEffect } from "react";
import styles from "./settings.module.css";
import { useUser, useAuth } from "@clerk/nextjs";

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSave = async () => {
    if (apiKey.trim()) {
      try {
        const token = await getToken();
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/user/profile`, {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ openai_api_key: apiKey.trim() })
        });
        localStorage.setItem('openai_api_key', apiKey.trim());
        setStatus("Settings saved and encrypted in the database successfully!");
        setTimeout(() => setStatus(""), 3000);
      } catch (e) {
        setStatus("Failed to save to database.");
        setTimeout(() => setStatus(""), 3000);
      }
    }
  };

  if (!isLoaded) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your API keys and application preferences.</p>
      </header>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Bring Your Own Key (BYOK)</h2>
        <p className={styles.cardDesc}>
          Cursiva runs entirely on your own OpenAI API key. Your key is securely encrypted using symmetric encryption and stored in our database, so you can access your profile from any device without re-entering it.
        </p>

        <div className={styles.formGroup}>
          <label className={styles.label}>OpenAI API Key</label>
          <input 
            type="password" 
            className={styles.input} 
            placeholder="sk-..." 
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button className={styles.helpBtn} onClick={() => setShowHelp(true)}>How to obtain an API key?</button>
        </div>

        <button className={styles.saveBtn} onClick={handleSave}>Save Changes</button>
        {status && <div className={`${styles.statusMsg} ${styles.success}`}>{status}</div>}
      </div>

      {showHelp && (
        <div className={styles.modalOverlay} onClick={() => setShowHelp(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>How to obtain an OpenAI API Key</h2>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <li>
                <strong>Create an OpenAI Account</strong>
                <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)' }}>Go to <a href="https://platform.openai.com/signup" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>platform.openai.com/signup</a>. You can sign up using your email, Google, Microsoft, or Apple account. You will need to verify your phone number during this process.</p>
              </li>
              <li>
                <strong>Set up Billing & Add Credits</strong>
                <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)' }}>OpenAI requires a prepaid balance to use the API. In the left sidebar, click the gear icon (Settings) and select <strong>Billing</strong>. Click "Add payment details", enter your card info, and add an initial credit balance (e.g., $5 to $10). <em>Note: ChatGPT Plus subscription does NOT cover API usage.</em></p>
              </li>
              <li>
                <strong>Navigate to API Keys</strong>
                <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)' }}>In the left sidebar, find the "API keys" section under your project dashboard.</p>
              </li>
              <li>
                <strong>Create a new secret key</strong>
                <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)' }}>Click the "Create new secret key" button. Give it a memorable name like "Cursiva".</p>
              </li>
              <li>
                <strong>Copy your API Key</strong>
                <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)' }}>Copy the generated key immediately (it will start with <code>sk-...</code>). <strong>You will not be able to view it again</strong> once you close the window. Keep it secure.</p>
              </li>
              <li>
                <strong>Paste it in Cursiva</strong>
                <p style={{ marginTop: '8px', color: 'rgba(255,255,255,0.7)' }}>Return to this page, paste the key into the input field, and click "Save Changes".</p>
              </li>
            </ol>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
              <button className={styles.saveBtn} onClick={() => setShowHelp(false)}>Got it!</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
