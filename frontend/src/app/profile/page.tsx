"use client";
import ConnectButton from "@/components/ConnectButton";
import { useWalletAddress } from "@/hooks/useWalletAddress";
import { readClient, CONTRACT_ADDRESS, formatGEN } from "@/lib/clients";
import { useEffect, useState } from "react";

interface CheckRecord {
  id: number;
  check_type: number;
  status: number;
  verdict: string;
  score: number;
  reasoning: string;
  text?: string;
}

const VERDICT_CONFIG: Record<string, { color: string; label: string }> = {
  PLAGIARIZED:  { color: "#dc2626", label: "Plagiarized" },
  ORIGINAL:     { color: "#16a34a", label: "Original" },
  AI_GENERATED: { color: "#ea580c", label: "AI Generated" },
  HUMAN:        { color: "#16a34a", label: "Human Written" },
  MIXED:        { color: "#ca8a04", label: "Mixed" },
};

export default function ProfilePage() {
  const address = useWalletAddress();

  return (
    <div style={{ background: "#f8fafc", fontFamily: "inherit" }}>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "52px 24px 80px" }}>
        {address ? <ProfileContent address={address} /> : <ConnectPrompt />}
      </main>
    </div>
  );
}

function ProfileContent({ address }: { address: string }) {
  const [balance, setBalance] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [balRaw, checksRaw] = await Promise.all([
          (window as Window & { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
            ?.request({ method: "eth_getBalance", params: [address, "latest"] })
            .then((b) => formatGEN(BigInt(b as string)))
            .catch(() => null),
          readClient.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_my_checks",
            args: [address],
          }),
        ]);
        if (cancelled) return;
        setBalance(balRaw ?? null);
        const raw = checksRaw as unknown as CheckRecord[];
        setChecks(raw.sort((a, b) => b.id - a.id));
      } catch {
        if (!cancelled) setError("Couldn't load profile data. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [address]);

  const plagChecks = checks?.filter((c) => c.check_type === 1) ?? [];
  const aiChecks = checks?.filter((c) => c.check_type === 2) ?? [];

  return (
    <div>
      {/* Wallet card */}
      <div style={{
        background: "#0f172a", borderRadius: 18,
        padding: "28px 30px", marginBottom: 24,
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>
          Connected Wallet
        </p>
        <p style={{ fontSize: 15, fontFamily: "monospace", color: "#f8fafc", margin: "0 0 14px", wordBreak: "break-all" }}>
          {address}
        </p>
        {balance && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.07)", borderRadius: 100,
            padding: "5px 14px",
          }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Balance:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>{balance}</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      {checks && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14, marginBottom: 32,
        }}>
          <StatCard label="Total Checks" value={checks.length} />
          <StatCard label="Plagiarism" value={plagChecks.length} />
          <StatCard label="AI Detection" value={aiChecks.length} />
        </div>
      )}

      {/* History */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 16px", letterSpacing: "-0.02em" }}>
          Check History
        </h2>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>
            Loading your checks…
          </div>
        )}

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fca5a5",
            borderRadius: 12, padding: "14px 18px",
          }}>
            <p style={{ fontSize: 13, color: "#991b1b", margin: 0 }}>{error}</p>
          </div>
        )}

        {!loading && !error && checks?.length === 0 && (
          <div style={{
            background: "#fff", border: "1.5px dashed rgba(15,23,42,0.12)",
            borderRadius: 14, padding: "40px 24px", textAlign: "center",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 6px" }}>No checks yet</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Submit your first check from the Plagiarism or AI Detection pages.
            </p>
          </div>
        )}

        {!loading && checks && checks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {checks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 14, padding: "18px 20px", textAlign: "center",
    }}>
      <p style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.03em" }}>
        {value}
      </p>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
        {label}
      </p>
    </div>
  );
}

function CheckRow({ check }: { check: CheckRecord }) {
  const [expanded, setExpanded] = useState(false);
  const vc = VERDICT_CONFIG[check.verdict] ?? { color: "#475569", label: check.verdict || "Pending" };
  const isPlag = check.check_type === 1;
  const isPending = check.status === 0;

  const excerpt = check.text
    ? check.text.slice(0, 120) + (check.text.length > 120 ? "…" : "")
    : null;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 14,
      overflow: "hidden",
    }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer",
        }}
      >
        {/* Type badge */}
        <div style={{
          flexShrink: 0,
          fontSize: 10, fontWeight: 700,
          background: isPlag ? "#eff6ff" : "#f5f3ff",
          color: isPlag ? "#2563eb" : "#7c3aed",
          border: `1px solid ${isPlag ? "#bfdbfe" : "#ddd6fe"}`,
          borderRadius: 100, padding: "3px 10px",
          textTransform: "uppercase", letterSpacing: "0.05em",
          whiteSpace: "nowrap",
        }}>
          {isPlag ? "Plagiarism" : "AI Detect"}
        </div>

        {/* Verdict */}
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: isPending ? "#92400e" : vc.color,
          flexShrink: 0,
        }}>
          {isPending ? "Pending…" : vc.label}
        </span>

        {/* Score */}
        {!isPending && (
          <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0 }}>
            {check.score}%
          </span>
        )}

        {/* Text excerpt */}
        {excerpt && (
          <span style={{
            fontSize: 12, color: "#64748b",
            flex: 1, overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", minWidth: 0,
          }}>
            {excerpt}
          </span>
        )}

        {/* Check id */}
        <span style={{ fontSize: 11, color: "#cbd5e1", flexShrink: 0, fontFamily: "monospace" }}>
          #{check.id}
        </span>

        {/* Expand chevron */}
        <span style={{
          fontSize: 12, color: "#cbd5e1", flexShrink: 0,
          transform: expanded ? "rotate(180deg)" : "none",
          transition: "transform 0.15s ease",
        }}>
          ▾
        </span>
      </div>

      {/* Expanded reasoning */}
      {expanded && check.reasoning && (
        <div style={{
          borderTop: "1px solid rgba(0,0,0,0.06)",
          padding: "14px 20px",
          background: "#f8fafc",
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>
            Reasoning
          </p>
          <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0 }}>
            {check.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div style={{ textAlign: "center", paddingTop: 60 }}>
      <p style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
        Connect your wallet to view your profile
      </p>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 28px" }}>
        Your check history is linked to your wallet address.
      </p>
      <ConnectButton />
    </div>
  );
}
