import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VerifyAI — Trustless Content Integrity",
  description:
    "On-chain plagiarism detection and AI-generated text analysis. Verdicts produced by validator consensus on GenLayer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ minHeight: "100vh", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
