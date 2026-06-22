"use client";
import { useState, useCallback } from "react";
import { readClient, createWriteClient, CONTRACT_ADDRESS } from "@/lib/clients";

type Mode = "plagiarism" | "ai_detection";
type Phase = "idle" | "wallet" | "pending";

const TERMINAL_FAIL = new Set([
  "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT", "VALIDATORS_TIMEOUT",
]);

interface Source {
  url: string;
  snippet?: string;
}

interface CheckResult {
  id: unknown;
  check_type: unknown;
  status: unknown;
  verdict: string;
  score: unknown;
  sources: string;
  reasoning: string;
}

const VERDICT_CONFIG: Record<string, { bg: string; border: string; color: string; label: string }> = {
  PLAGIARIZED:  { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626", label: "Plagiarized" },
  ORIGINAL:     { bg: "#f0fdf4", border: "#86efac", color: "#16a34a", label: "Original" },
  AI_GENERATED: { bg: "#fff7ed", border: "#fdba74", color: "#ea580c", label: "AI Generated" },
  HUMAN:        { bg: "#f0fdf4", border: "#86efac", color: "#16a34a", label: "Human Written" },
  MIXED:        { bg: "#fefce8", border: "#fde047", color: "#ca8a04", label: "Mixed" },
};

function parseSources(raw: string): Source[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as Source[]; } catch { return []; }
}

function errMsg(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);

  // GenLayer contract errors arrive as:
  // "GenLayer RPC error (gen_call): execution failed: &genvm.VMResult{Kind:0x1, ReturnData:[]uint8{0x2e, 0x4, 0x64, 0x61, 0x74, 0x61, 0x7c, 0x43, 0x68, 0x65, 0x63...}}"
  // ReturnData bytes encode "data|<user error message>" — extract and surface that.
  const hexMatch = raw.match(/ReturnData:\[\]uint8\{([\d,\s0xa-fA-F]+)\}/);
  if (hexMatch) {
    try {
      const bytes = hexMatch[1]
        .split(",")
        .map((s) => parseInt(s.trim(), 16))
        .filter((n) => !isNaN(n) && n < 128);
      const text = bytes.map((b) => String.fromCharCode(b)).join("");
      const pipe = text.indexOf("|");
      const msg = pipe !== -1 ? text.slice(pipe + 1).trim() : text.trim();
      if (msg.length > 0) return msg;
    } catch { /* fall through */ }
  }

  // Hide the raw Go struct dump from users — show a generic message instead
  if (raw.includes("GenLayer RPC error") || raw.includes("VMResult") || raw.includes("execution failed")) {
    return "Contract call failed.";
  }

  return raw;
}

export default function SubmitCheck({ address, mode }: { address: string; mode: Mode }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgCheckId, setBgCheckId] = useState<number | null>(null);
  const [bgTxHash, setBgTxHash] = useState<string | null>(null);
  const [undetermined, setUndetermined] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setText("");
    setError(null);
    setBgProcessing(false);
    setBgCheckId(null);
    setBgTxHash(null);
    setUndetermined(false);
  }, []);

  const retryFetch = useCallback(async (checkId: number, txHash?: string) => {
    setError(null);

    // If we have the tx hash, check whether it terminally failed before polling state.
    const hashToCheck = txHash ?? bgTxHash;
    if (hashToCheck) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = await readClient.getTransaction({ hash: hashToCheck as any });
        const sn = (tx as Record<string, unknown>).statusName as string | undefined;
        if (sn && TERMINAL_FAIL.has(sn)) {
          setBgProcessing(false);
          setUndetermined(true);
          return;
        }
      } catch { /* if getTransaction fails, fall through to contract read */ }
    }

    try {
      const raw = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_check",
        args: [BigInt(checkId), address],
      });
      const check = raw as unknown as CheckResult;
      if (Number(check.status) === 0) {
        setError("Still processing — validators haven't reached consensus yet. Try again in a moment.");
        return;
      }
      setResult(check);
      setBgProcessing(false);
    } catch (e) {
      const msg = errMsg(e);
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("does not exist")) {
        setError("Check not found — it may still be processing. Try again in a moment.");
      } else {
        setError("Couldn't fetch result: " + msg);
      }
    }
  }, [address, bgTxHash]);

  async function handleSubmit() {
    if (!text.trim() || phase !== "idle") return;
    setError(null);
    setResult(null);
    setBgProcessing(false);

    let txSubmitted = false;
    let expectedId: number | null = null;
    let submittedHash: `0x${string}` | null = null;
    const addr = address as `0x${string}`;

    setPhase("wallet");
    try {
      // Ensure wallet is on Bradbury before writing
      if (typeof window !== "undefined" && window.ethereum) {
        const chainId = await window.ethereum.request<string>({ method: "eth_chainId" });
        if (chainId !== "0x107d") {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x107d" }],
          });
        }
      }

      // Predict new check's ID from current count
      const countRaw = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_check_count",
        args: [],
      });
      expectedId = Number(countRaw as bigint);

      const wc = createWriteClient(addr);
      submittedHash = await wc.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: mode === "plagiarism" ? "submit_plagiarism_check" : "submit_ai_detection",
        args: [text.trim()],
        value: BigInt(0),
      });
      txSubmitted = true;
      setPhase("pending");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const receipt = await wc.waitForTransactionReceipt({ hash: submittedHash as any, retries: 120, interval: 5000 });
      setPhase("idle");

      // Check if consensus definitively failed (UNDETERMINED / CANCELED / timeout)
      const statusName = (receipt as Record<string, unknown>).statusName as string | undefined;
      if (statusName && TERMINAL_FAIL.has(statusName)) {
        setUndetermined(true);
        return;
      }

      const raw = await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_check",
        args: [BigInt(expectedId), addr],
      });
      setResult(raw as unknown as CheckResult);
    } catch (e) {
      setPhase("idle");
      if (txSubmitted) {
        setBgProcessing(true);
        if (expectedId !== null) setBgCheckId(expectedId);
        if (submittedHash) setBgTxHash(submittedHash);
      } else {
        setError(errMsg(e));
      }
    }
  }

  const charCount = text.length;
  const isPlagiarism = mode === "plagiarism";
  const isSubmitting = phase !== "idle";

  // ── Undetermined — consensus definitively failed ─────────────────────────
  if (undetermined) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{
          background: "#fefce8",
          border: "1.5px solid #fde047",
          borderRadius: 18,
          padding: "28px 30px",
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 18, marginBottom: 12 }}>⚖️</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#713f12", margin: "0 0 8px" }}>
            Validators couldn&apos;t reach a verdict
          </p>
          <p style={{ fontSize: 13, color: "#92400e", lineHeight: 1.7, margin: "0 0 6px" }}>
            The GenLayer validators analyzed your text but couldn&apos;t agree on a verdict.
            This usually happens with genuinely ambiguous content — text that sits at the
            boundary between original and copied, or between human and AI writing.
          </p>
          <p style={{ fontSize: 13, color: "#92400e", lineHeight: 1.7, margin: 0 }}>
            Try rephrasing slightly, splitting into a shorter excerpt, or resubmitting.
          </p>
        </div>
        <button
          onClick={reset}
          style={{
            background: "#0f172a", color: "#f8fafc",
            border: "none", borderRadius: 100,
            padding: "13px 28px", fontSize: 14, fontWeight: 600,
            cursor: "pointer", letterSpacing: "-0.01em",
          }}
        >
          Submit again →
        </button>
      </div>
    );
  }

  // ── Result card ──────────────────────────────────────────────────────────
  if (result) {
    // Guard: status=COMPLETE but verdict field empty (shouldn't happen, but handle it)
    if (!result.verdict) {
      return (
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{
            background: "#f1f5f9", border: "1px solid #e2e8f0",
            borderRadius: 18, padding: "28px 30px", marginBottom: 14,
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
              Check completed — no verdict returned
            </p>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7, margin: 0 }}>
              The check was stored on-chain but the verdict field is empty.
              This is unexpected — please try submitting again.
            </p>
          </div>
          <button
            onClick={reset}
            style={{
              background: "#0f172a", color: "#f8fafc",
              border: "none", borderRadius: 100,
              padding: "13px 28px", fontSize: 14, fontWeight: 600,
              cursor: "pointer", letterSpacing: "-0.01em",
            }}
          >
            Submit again →
          </button>
        </div>
      );
    }

    const vc = VERDICT_CONFIG[result.verdict] ?? {
      bg: "#f1f5f9", border: "#e2e8f0", color: "#475569", label: result.verdict,
    };
    const isPlag = Number(result.check_type) === 1;
    const scorePct = Math.round(Number(result.score));
    // Plagiarism score = originality 0–100 (100 = fully original, 0 = entirely copied).
    // AI score = AI-likelihood 0–100 (100 = certain AI, 0 = certain human).
    // Both are shown directly — no inversion. Bar height and verdict color tell the story.
    const barValue = scorePct;
    const barLabel = isPlag ? "Originality Score" : "AI Likelihood";
    const barNote = isPlag
      ? "(100 = fully original · 0 = entirely copied)"
      : "(100 = certain AI · 0 = certain human)";
    const sources = parseSources(result.sources);

    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Main verdict card */}
        <div style={{
          background: vc.bg,
          border: `1.5px solid ${vc.border}`,
          borderRadius: 18,
          padding: "26px 30px",
          marginBottom: 14,
        }}>
          {/* Header: verdict pill + on-chain badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
            <span style={{
              background: vc.color, color: "#fff",
              borderRadius: 100, padding: "6px 18px",
              fontSize: 13, fontWeight: 700, letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
              {vc.label}
            </span>
            <span style={{
              fontSize: 11, color: "#64748b",
              background: "rgba(255,255,255,0.7)", borderRadius: 100,
              padding: "4px 12px", border: "1px solid rgba(0,0,0,0.07)",
              fontFamily: "monospace",
            }}>
              on-chain · check #{Number(result.id)}
            </span>
          </div>

          {/* Score bar */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  {barLabel}
                </span>
                <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>
                  {barNote}
                </span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: vc.color, flexShrink: 0, marginLeft: 8 }}>
                {barValue}%
              </span>
            </div>
            <div style={{ height: 8, background: "rgba(0,0,0,0.08)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${barValue}%`,
                background: vc.color,
                borderRadius: 100,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>

          {/* Reasoning */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 8px" }}>
              Reasoning
            </p>
            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.8, margin: 0 }}>
              {result.reasoning}
            </p>
          </div>
        </div>

        {/* Matched sources (plagiarism only) */}
        {sources.length > 0 && (
          <div style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            padding: "18px 22px",
            marginBottom: 14,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
              Matched Sources ({sources.length})
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sources.map((src, i) => (
                <div key={i} style={{ borderLeft: "3px solid #e2e8f0", paddingLeft: 14 }}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", wordBreak: "break-all", display: "block" }}
                  >
                    {src.url}
                  </a>
                  {src.snippet && (
                    <p style={{ fontSize: 12, color: "#64748b", margin: "5px 0 0", fontStyle: "italic", lineHeight: 1.55 }}>
                      &ldquo;{src.snippet}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={reset}
          style={{
            background: "#0f172a", color: "#f8fafc",
            border: "none", borderRadius: 100,
            padding: "13px 28px", fontSize: 14, fontWeight: 600,
            cursor: "pointer", letterSpacing: "-0.01em",
          }}
        >
          Run another check →
        </button>
      </div>
    );
  }

  // ── Submission form ──────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Amber: background processing */}
      {bgProcessing && (
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 18,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", margin: "0 0 4px" }}>
              Check still processing on Bradbury
            </p>
            <p style={{ fontSize: 12, color: "#b45309", margin: 0, lineHeight: 1.55 }}>
              Your submission was received. Validators are reaching consensus — this takes 1–2 minutes.
              {bgCheckId !== null && <> Check #{bgCheckId}.</>}
            </p>
          </div>
          {bgCheckId !== null && (
            <button
              onClick={() => retryFetch(bgCheckId, bgTxHash ?? undefined)}
              style={{
                background: "#fef3c7", color: "#92400e",
                border: "1px solid #fcd34d", borderRadius: 100,
                padding: "6px 14px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
              }}
            >
              Fetch result
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5",
          borderRadius: 12, padding: "14px 18px", marginBottom: 18,
        }}>
          <p style={{ fontSize: 13, color: "#991b1b", margin: 0, lineHeight: 1.5 }}>{error}</p>
        </div>
      )}

      {/* Textarea */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 5000))}
          disabled={isSubmitting}
          placeholder={
            isPlagiarism
              ? "Paste text to check for plagiarism…"
              : "Paste text to check if it was written by AI…"
          }
          rows={9}
          style={{
            width: "100%",
            padding: "16px",
            paddingBottom: "38px",
            fontSize: 14,
            lineHeight: 1.7,
            color: "#0f172a",
            background: isSubmitting ? "#f8fafc" : "#fff",
            border: "1.5px solid rgba(15,23,42,0.12)",
            borderRadius: 14,
            resize: "vertical",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            transition: "border-color 0.15s ease, background 0.15s ease",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(15,23,42,0.35)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(15,23,42,0.12)"; }}
        />
        <span style={{
          position: "absolute", bottom: 11, right: 14,
          fontSize: 11, fontWeight: 500,
          color: charCount > 4800 ? "#ef4444" : charCount > 4000 ? "#f59e0b" : "#9ca3af",
          pointerEvents: "none",
        }}>
          {charCount.toLocaleString()} / 5,000
        </span>
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !text.trim()}
        style={{
          width: "100%",
          background: isSubmitting || !text.trim() ? "#94a3b8" : "#0f172a",
          color: "#f8fafc",
          border: "none",
          borderRadius: 100,
          padding: "15px 28px",
          fontSize: 15,
          fontWeight: 700,
          cursor: isSubmitting || !text.trim() ? "default" : "pointer",
          letterSpacing: "-0.01em",
          transition: "background 0.15s ease",
        }}
      >
        {phase === "wallet"
          ? "Confirm in wallet…"
          : phase === "pending"
          ? isPlagiarism
            ? "Analyzing on-chain, this can take a minute or two (plagiarism searches the web)…"
            : "Analyzing on-chain…"
          : `Run ${isPlagiarism ? "Plagiarism" : "AI Detection"} Check`}
      </button>

      {phase === "pending" && (
        <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>
          GenLayer validators are reaching consensus on-chain. Keep this tab open.
        </p>
      )}
    </div>
  );
}
