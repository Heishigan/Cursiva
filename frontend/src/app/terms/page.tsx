import Link from "next/link";
import Footer from "@/components/Footer";
import styles from "../legal.module.css";

export const metadata = {
  title: "Terms of Service | Cursiva",
  description: "Terms and conditions for using the Cursiva service.",
};

export default function TermsOfService() {
  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.logo}>
            C<span>ursiva</span>
          </Link>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.lastUpdated}>Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </header>

        <main className={styles.content}>
          <p>
            Welcome to Cursiva. By accessing or using our website and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.
          </p>

          <h2>1. Open Source vs. SaaS Service</h2>
          <p>
            The core Cursiva software is an open-source project available on GitHub under its respective license. You are free to audit, self-host, and modify the code in accordance with that license. However, these Terms of Service govern your use of the hosted Software-as-a-Service (SaaS) available at <code>cursiva.se</code>, operated by Heishigan Pathmaraj.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Cursiva is an AI-powered tool designed to help users generate tailored job applications, resumes, and cover letters. We provide this service on a freemium model utilizing credit-based processing.
          </p>

          <h2>3. Account Registration and Abuse Prevention</h2>
          <p>
            To use the Service, you must register for an account. You agree to provide accurate information. We offer free trial credits to new users. You may not attempt to circumvent our billing or abuse prevention systems - for example, by repeatedly deleting and recreating accounts to farm free credits. Violation of this rule will result in a permanent ban.
          </p>

          <h2>4. Limitation of Liability and "As-Is" Provision</h2>
          <p>
            The Service and any AI-generated outputs are provided "as is" and "as available." While we strive to produce high-quality documents, Cursiva does not guarantee that the generated applications are error-free or that they will secure you an interview or job offer. You are solely responsible for reviewing and verifying any generated documents before submitting them to employers.
          </p>
          <p>
            In no event shall Cursiva or its operators be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service or the output it generates.
          </p>

          <h2>5. User Data and Content</h2>
          <p>
            You retain full ownership of the personal data and CV documents you upload to Cursiva. By uploading your data, you grant us a temporary license to process it solely for the purpose of generating your applications. We do not claim ownership over your professional history.
          </p>

          <h2>6. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users of the Service, us, or third parties, or for any other reason.
          </p>

          <h2>7. Contact Information</h2>
          <p>
            If you have any questions about these Terms, please contact us at <a href="mailto:hej@heishi.se">hej@heishi.se</a>.
          </p>
        </main>
      </div>
      <Footer />
    </>
  );
}
