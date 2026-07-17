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
  const { getToken } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // Auto-purge legacy cross-account keys immediately
        localStorage.removeItem('generic_cv_json');
        localStorage.removeItem('openai_api_key');
        localStorage.removeItem('job_description');
        localStorage.removeItem('diff_tailored_cv');

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          if (!data.data.has_baseline) {
            router.push('/onboarding');
            return;
          }
          setMissingBaseline(!data.data.has_baseline);
          
          if (data.data.has_api_key) {
            // Test the key
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const testRes = await fetch(`${apiUrl}/api/user/test_key`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (testRes.ok) {
              setApiKeyStatus("Valid");
            } else {
              setApiKeyStatus("Invalid");
            }
          } else {
            setApiKeyStatus("Missing");
          }
          
          if (data.data.cv_data && user?.id) {
             localStorage.setItem(`generic_cv_json_${user.id}`, JSON.stringify(data.data.cv_data));
          } else if (user?.id) {
             localStorage.removeItem(`generic_cv_json_${user.id}`);
          }
        }
      } catch(e) { console.error(e) }
    };
    
    fetchProfile();
    const interval = setInterval(fetchProfile, 5000);
    return () => clearInterval(interval);
  }, [getToken]);

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
