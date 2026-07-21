import Link from "next/link";
import Footer from "@/components/Footer";
import styles from "../legal.module.css";

export const metadata = {
  title: "Cookie Policy | Cursiva",
  description: "Information about how Cursiva uses cookies and local storage.",
};

export default function CookiePolicy() {
  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.logo}>
            C<span>ursiva</span>
          </Link>
          <h1 className={styles.title}>Cookie Policy</h1>
          <p className={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </header>

        <main className={styles.content}>
          <p>
            This Cookie Policy explains how Cursiva uses cookies and similar tracking technologies (such as local storage) when you use our website and services.
          </p>

          <h2>1. What Are Cookies?</h2>
          <p>
            Cookies are small data files that are placed on your computer or mobile device when you visit a website. In addition to traditional cookies, modern web applications often use "Local Storage" or "Session Storage" in your browser to store information securely and quickly.
          </p>

          <h2>2. How We Use Cookies and Local Storage</h2>
          <p>
            At Cursiva, we prioritize a fast, seamless user experience while minimizing tracking. We strictly use cookies and local storage for <strong>essential functionality</strong>:
          </p>
          <ul>
            <li><strong>Authentication:</strong> We use Clerk for secure authentication. Clerk sets essential cookies to keep you logged into your account during your session.</li>
            <li><strong>Application State Caching:</strong> We heavily rely on your browser's Local Storage to cache your CV data and your credit balance. This allows the dashboard to load instantly (preventing the layout shift associated with fetching data from the server) and ensures your draft progress is saved seamlessly between page navigations.</li>
          </ul>

          <h2>3. Third-Party Tracking and Analytics</h2>
          <p>
            We do not use aggressive third-party marketing cookies, nor do we sell your cookie data to advertisers. Any third-party cookies present are strictly necessary for the operation of our authentication provider (Clerk).
          </p>

          <h2>4. Managing Cookies</h2>
          <p>
            You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by setting or amending your web browser controls to accept or refuse cookies. However, please note that if you choose to reject essential cookies or clear your local storage, you may be logged out of your account or lose unsaved application drafts.
          </p>

          <h2>5. Contact Us</h2>
          <p>
            If you have any questions about our use of cookies or other technologies, please email us at <a href="mailto:hej@heishi.se">hej@heishi.se</a>.
          </p>
        </main>
      </div>
      <Footer />
    </>
  );
}
