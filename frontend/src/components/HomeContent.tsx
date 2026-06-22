"use client";
import { useState, useEffect } from "react";
import ConnectButton from "./ConnectButton";
import SubmitCheck from "./SubmitCheck";

export default function HomeContent() {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const detect = async () => {
      try {
        const accs = await window.ethereum!.request<string[]>({ method: "eth_accounts" });
        setAddress(accs?.[0] ?? null);
      } catch { /* wallet not available */ }
    };
    detect();

    const handler = (accounts: unknown) => setAddress((accounts as string[])[0] ?? null);
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  }, []);

  // ── Connected: show check form ───────────────────────────────────────────
  if (address) {
    return (
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "52px 24px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{
            fontSize: 26, fontWeight: 800, color: "#0f172a",
            letterSpacing: "-0.03em", margin: "0 0 10px",
          }}>
            Check Content Integrity
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            AI validators reach consensus on-chain. Your text is stored privately — only you can read it back.
          </p>
        </div>
        <SubmitCheck address={address} mode="plagiarism" />
      </div>
    );
  }

  // ── Disconnected: show hero ──────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "calc(100vh - 56px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
    }}>
      <div style={{ textAlign: "center", maxWidth: 560, marginBottom: 48 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#f1f5f9", border: "1px solid rgba(15,23,42,0.1)",
          borderRadius: 100, padding: "4px 12px",
          fontSize: 12, fontWeight: 600, color: "#475569",
          letterSpacing: "0.05em", textTransform: "uppercase",
          marginBottom: 24,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
          GenLayer Bradbury Testnet
        </div>

        <h1 style={{
          fontSize: "clamp(32px, 5vw, 52px)",
          fontWeight: 800,
          color: "#0f172a",
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          marginBottom: 20,
        }}>
          Trustless Content<br />Integrity
        </h1>

        <p style={{
          fontSize: 17,
          color: "#475569",
          lineHeight: 1.65,
          maxWidth: 440,
          margin: "0 auto 36px",
        }}>
          Paste any text. AI validators issue an on-chain verdict — plagiarism
          or AI-generated — with reasoning and sources. Nobody can rig it.
        </p>

        <ConnectButton />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { icon: "🔍", label: "Plagiarism detection" },
          { icon: "🤖", label: "AI-writing detection" },
          { icon: "⛓️",  label: "On-chain verdict" },
          { icon: "🔒", label: "Your text stays private" },
        ].map(({ icon, label }) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#ffffff",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 100,
            padding: "8px 16px",
            fontSize: 13, color: "#334155", fontWeight: 500,
            boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
          }}>
            <span>{icon}</span> {label}
          </div>
        ))}
      </div>
    </div>
  );
}
