import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DM Command Table",
  description: "A private command center for encounters, monsters, session notes, and campaign story progress.",
  icons: {
    icon: "/favicon-new.svg",
    shortcut: "/favicon-new.svg",
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
