import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";
import "./intake.css";
import "./program-group.css";

export const metadata: Metadata = {
  title: "ChildCareRegistration.Com",
  description: "Secure, complete child care registrations for providers and families.",
  other: {
    "codex-preview": "child-care-registration",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
