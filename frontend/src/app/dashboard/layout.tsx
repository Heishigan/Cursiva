"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import { LayoutGrid, PlusCircle, User, Settings } from "lucide-react";
import styles from "./layout.module.css";
import React, { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [missingBaseline, setMissingBaseline] = useState<boolean | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState("Checking...");
  const { getToken, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  useEffect(() => {
    if (!authLoaded || !userLoaded) return;
    
    const fetchProfile = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // 1. Check profile FIRST before any migration logic
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.status === 'success') {
          // 2. New user — redirect immediately, do NOT migrate stale localStorage data
          if (!data.data.has_baseline) {
            window.location.href = '/onboarding';
            return;
          }

          // 3. Existing user — safe to run legacy key migration now
          const legacyCv = localStorage.getItem('generic_cv_json');
          const legacyKey = localStorage.getItem('openai_api_key');

          if (legacyCv && user?.id) {
            localStorage.setItem(`generic_cv_json_${user.id}`, legacyCv);
            fetch(`${apiUrl}/api/user/profile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ cv_data_json: legacyCv })
            }).catch(() => {});
          }

          if (legacyKey && user?.id) {
            localStorage.setItem(`openai_api_key_${user.id}`, legacyKey);
            fetch(`${apiUrl}/api/user/profile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ openai_api_key: legacyKey })
            }).catch(() => {});
          }

          localStorage.removeItem('generic_cv_json');
          localStorage.removeItem('openai_api_key');
          localStorage.removeItem('job_description');
          localStorage.removeItem('diff_tailored_cv');

          setMissingBaseline(!data.data.has_baseline);

          if (data.data.has_api_key) {
            setApiKeyStatus("Valid");
          } else {
            setApiKeyStatus("Missing");
          }

          if (data.data.cv_data && user?.id) {
             localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(data.data.cv_data));
          } else if (user?.id) {
             localStorage.removeItem(`generic_cv_json_${user.id}`);
          }
        } else {
          // Non-success response from backend (401, 500, etc.) — treat as new user and redirect to onboarding
          console.warn('[layout] Profile fetch returned non-success:', data);
          window.location.href = '/onboarding';
        }
      } catch(e) {
        // Network error or cold-start timeout — treat as new user and redirect to onboarding
        console.error('[layout] Profile fetch failed:', e);
        window.location.href = '/onboarding';
      }
    };
    
    fetchProfile();
  }, [getToken, pathname, authLoaded, userLoaded, user?.id]);

  const getStatusText = () => {
    if (apiKeyStatus === "Checking..." || missingBaseline === null) return "Checking...";
    if (apiKeyStatus === "Missing" && missingBaseline) return "Not Configured";
    if (apiKeyStatus === "Missing") return "Missing API Key";
    if (apiKeyStatus === "Invalid") return "API Key Invalid";
    if (missingBaseline) return "Missing CV";
    return "Status: Ready";
  };

  const isError = apiKeyStatus === "Missing" || apiKeyStatus === "Invalid" || missingBaseline === true;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className={styles.container}>
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <Link href="/" className={styles.logo}>
          C<span>ursiva</span>
        </Link>
        <button className={styles.hamburger} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <LayoutGrid size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.logoContainer}>
          <Link href="/" className={styles.logo}>
            C<span>ursiva</span>
          </Link>
        </div>

        <nav className={styles.nav}>
          <Link href="/dashboard" className={`${styles.navItem} ${pathname === '/dashboard' ? styles.active : ''}`}>
            <LayoutGrid size={22} />
            <span className={styles.navLabel}>Dashboard</span>
          </Link>
          <Link href="/dashboard/pipeline" className={`${styles.navItem} ${pathname.startsWith('/dashboard/pipeline') ? styles.active : ''}`}>
            <PlusCircle size={22} />
            <span className={styles.navLabel}>New Application</span>
          </Link>
          <Link href="/dashboard/profile" className={`${styles.navItem} ${pathname.startsWith('/dashboard/profile') ? styles.active : ''}`}>
            <User size={22} />
            <span className={styles.navLabel}>Profile</span>
          </Link>
          <Link href="/dashboard/settings" className={`${styles.navItem} ${pathname.startsWith('/dashboard/settings') ? styles.active : ''}`}>
            <Settings size={22} />
            <span className={styles.navLabel}>Settings</span>
          </Link>
        </nav>

        <div className={styles.sidebarBottom}>
          <UserButton 
            appearance={{
              elements: {
                userButtonAvatarBox: { width: 36, height: 36 },
              }
            }}
          />
          <div className={styles.userInfo}>
            <div className={styles.navLabel} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {user ? (user.firstName || (user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress.split('@')[0] : "Account")) : "Account"}
            </div>
            <div className={`${styles.userStatus} ${isError ? styles.userStatusError : styles.userStatusOnline}`}>
              {getStatusText()}
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div className={styles.overlay} onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
