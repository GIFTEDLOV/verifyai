"use client";
import SubmitCheck from "@/components/SubmitCheck";
import ConnectButton from "@/components/ConnectButton";
import { useWalletAddress } from "@/hooks/useWalletAddress";

export default function PlagiarismPage() {
  const address = useWalletAddress();

  return (
    <div style={{ background: "#f8fafc", fontFamily: "inherit" }}>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "52px 24px 80px" }}>
        {/* Page header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#eff6ff", border: "1px solid #bfdbfe",
            borderRadius: 100, padding: "4px 13px",
            fontSize: 11, fontWeight: 600, color: "#2563eb",
            letterSpacing: "0.06em", textTransform: "uppercase",
            marginBottom: 14,
          }}>
            Plagiarism Detection
          </div>
          <h1 style={{
            fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800,
            color: "#0f172a", letterSpacing: "-0.03em",
            lineHeight: 1.15, margin: "0 0 12px",
          }}>
            Check text for plagiarism
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, margin: 0, maxWidth: 520 }}>
            Paste any text below. GenLayer validators will search the web for matching sources
            and return an on-chain verdict with cited evidence.
          </p>
        </div>

        {/* Form or connect prompt */}
        {address ? (
          <SubmitCheck address={address} mode="plagiarism" />
        ) : (
          <ConnectPrompt />
        )}
      </main>
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div style={{
      background: "#fff",
      border: "1.5px dashed rgba(15,23,42,0.14)",
      borderRadius: 18,
      padding: "48px 32px",
      textAlign: "center",
    }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 8px" }}>
        Connect your wallet to get started
      </p>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>
        You need a wallet on GenLayer Testnet Bradbury to submit a check.
      </p>
      <ConnectButton />
    </div>
  );
}
