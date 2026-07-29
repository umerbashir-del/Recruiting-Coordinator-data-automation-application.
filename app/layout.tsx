import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Applicanttrack | Candidate pipeline",
  description: "A focused, fair candidate pipeline workspace.",
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
      <body>{children}</body>
    </html>
  );
}
