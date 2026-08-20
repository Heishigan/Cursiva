import { ClerkProvider } from "@clerk/nextjs";

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursiva | AI-Powered Job Applications",
  description: "Stop spray-and-pray applying. Deploy an autonomous Executive Assistant that builds meticulously researched, natively compiled applications.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#c8f24c",
              colorBackground: "#111113",
              borderRadius: "9px",
            },
            elements: {
              card: {
                backgroundColor: "#17171a",
                color: "#dedcd5",
              },
              headerTitle: { color: "#f0efe9" },
              headerSubtitle: { color: "#8f8f93" },
              profileSectionTitleText: { color: "#f0efe9" },
              navbarButton: { color: "#8f8f93" },
              userButtonPopoverCard: {
                backgroundColor: "#17171a",
                border: "1px solid #232327",
              },
              userButtonPopoverActionButtonText: {
                color: "#dedcd5",
              },
              userButtonPopoverActionButtonIcon: {
                color: "#8f8f93",
              },
              userPreviewSecondaryIdentifier: {
                color: "#8f8f93",
              },
              userPreviewMainIdentifier: {
                color: "#f0efe9",
              },
              formFieldLabel: { color: "#dedcd5" },
              formFieldInput: { backgroundColor: "#1c1c1f", color: "#f0efe9", border: "1px solid #232327" },
              dividerText: { color: "#8f8f93" },
              socialButtonsBlockButton: { backgroundColor: "#1c1c1f", border: "1px solid #232327" },
              socialButtonsBlockButtonText: { color: "#dedcd5" },
              footerActionText: { color: "#8f8f93" },
              footerActionLink: { color: "#c8f24c" },
              navbar: { color: "#dedcd5" },
              navbarMobileMenuButton: { color: "#dedcd5" }
            }
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}