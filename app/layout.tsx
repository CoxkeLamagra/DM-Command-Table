import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "DM Command Table",
  description:
    "A private command center for encounters, monsters, session notes, and campaign story progress.",
  icons: {
    icon: "/favicon-new.svg",
    shortcut: "/favicon-new.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce-based CSP requires request-time rendering so Next.js can copy the
  // per-request nonce from the proxy header onto every framework script.
  await connection();
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
