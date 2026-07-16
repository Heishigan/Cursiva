"use client";
import { useState, useEffect } from "react";
import styles from "./settings.module.css";
import { useUser, useAuth } from "@clerk/nextjs";

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const handleSave = async () => {
    if (apiKey.trim()) {
      try {
        const token = await getToken();
        await fetch("http://localhost:8000/api/user/profile", {
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
        </div>

        <button className={styles.saveBtn} onClick={handleSave}>Save Changes</button>
        {status && <div className={`${styles.statusMsg} ${styles.success}`}>{status}</div>}
      </div>
    </div>
  );
}
