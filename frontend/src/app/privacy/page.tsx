import Link from "next/link";
import Footer from "@/components/Footer";
import styles from "../legal.module.css";

export const metadata = {
  title: "Privacy Policy | Cursiva",
  description: "How Cursiva collects, uses, and protects your data.",
};

export default function PrivacyPolicy() {
  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.logo}>
            C<span>ursiva</span>
          </Link>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </header>

        <main className={styles.content}>
          <p>
            At Cursiva, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information when you use our website and services (the "Service").
          </p>

          <h2>1. Transparency and Open Source</h2>
          <p>
            Cursiva is an open-source project. Our entire codebase is public and verifiable on GitHub. We believe in complete transparency regarding how your data is handled. You do not need to take our word for it - you or any developer can audit the code to ensure we treat your data exactly as described here.
          </p>

          <h2>2. Information We Collect</h2>
          <p>We collect the following types of information when you use our Service:</p>
          <ul>
            <li><strong>Account Information:</strong> We use Clerk for authentication. When you sign up, we collect your email address and basic profile information provided by your identity provider.</li>
            <li><strong>CV and Career Data:</strong> When you upload your CV or provide career history, we store this data to facilitate the creation of tailored job applications.</li>
            <li><strong>Usage Data:</strong> We may collect anonymous, aggregated data on how the Service is used to help us improve the platform.</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>Your information is used strictly to provide the Cursiva service:</p>
          <ul>
            <li>To authenticate your account and manage your credits.</li>
            <li>To parse your CV and generate tailored cover letters and resumes using OpenAI APIs.</li>
            <li>To communicate with you regarding your account, updates, or support requests.</li>
          </ul>

          <h2>4. Third-Party Services (OpenAI)</h2>
          <p>
            To generate your applications, we send your CV data and the target job description to OpenAI via API. <strong>We do not use your personal data to train our own models, and under OpenAI's API data usage policies, data sent via the API is NOT used to train OpenAI's models.</strong> Your data is used exclusively to generate the output requested.
          </p>

          <h2>5. Data Retention and Deletion</h2>
          <p>
            You have full control over your data. If you choose to delete your account, your CV data, generated documents, and user profile are permanently removed from our databases immediately. For abuse prevention, we retain a cryptographic hash of your email address (which cannot be reverse-engineered to identify you) to prevent free-trial abuse.
          </p>

          <h2>6. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at <a href="mailto:hej@heishi.se">hej@heishi.se</a>.
          </p>
        </main>
      </div>
      <Footer />
    </>
  );
}
