"use client";

import { useState, useRef, useEffect } from "react";
import { readClient, createWriteClient, formatGEN } from "@/lib/clients";

// EIP-3085 chain spec — works on both Rabby and MetaMask.
// Do NOT use genlayer-js connect() snap methods (MetaMask-only).
const BRADBURY_CHAIN = {
  chainId: "0x107d",
  chainName: "Genlayer Bradbury Testnet",
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com/"],
} as const;

type WalletState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; address: string; balance: string }
  | { status: "error"; message: string };

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface Props {
  compact?: boolean;
}

export default function ConnectButton({ compact = false }: Props) {
  const [wallet, setWallet] = useState<WalletState>({ status: "disconnected" });
  const writeClientRef = useRef<ReturnType<typeof createWriteClient> | null>(null);

  // Restore connection on mount if wallet was already authorized.
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    async function detectExisting() {
      try {
        const accounts = await window.ethereum!.request<string[]>({ method: "eth_accounts" });
        if (!accounts || accounts.length === 0) return;
        const address = accounts[0] as `0x${string}`;
        let balance = "— GEN";
        try {
          const wei = await readClient.getBalance({ address });
          balance = formatGEN(wei);
        } catch { /* balance non-critical */ }
        setWallet({ status: "connected", address, balance });
      } catch { /* wallet unavailable */ }
    }
    detectExisting();
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setWallet({ status: "disconnected" });
        writeClientRef.current = null;
      } else if (wallet.status === "connected") {
        handleConnect();
      }
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.status]);

  async function handleConnect() {
    if (!window.ethereum) {
      setWallet({ status: "error", message: "No wallet detected. Install Rabby or MetaMask." });
      return;
    }
    setWallet({ status: "connecting" });
    try {
      const accounts = await window.ethereum.request<string[]>({ method: "eth_requestAccounts" });
      const address = accounts[0] as `0x${string}`;

      // Add Bradbury if not present, then switch — EIP-3085, works on Rabby + MetaMask.
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [BRADBURY_CHAIN] });
      const currentChainId = await window.ethereum.request<string>({ method: "eth_chainId" });
      if (currentChainId !== BRADBURY_CHAIN.chainId) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BRADBURY_CHAIN.chainId }],
        });
      }

      writeClientRef.current = createWriteClient(address);

      let balance = "— GEN";
      try {
        const wei = await readClient.getBalance({ address });
        balance = formatGEN(wei);
      } catch { /* non-critical */ }

      setWallet({ status: "connected", address, balance });
    } catch (err) {
      setWallet({ status: "error", message: errMsg(err) });
    }
  }

  function handleDisconnect() {
    writeClientRef.current = null;
    setWallet({ status: "disconnected" });
  }

  // ── Compact (nav bar) ─────────────────────────────────────────────────────
  if (compact) {
    if (wallet.status === "connected") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            background: "#0f172a", color: "#f1f5f9", borderRadius: 100,
            padding: "5px 14px", fontSize: 12, fontWeight: 500,
            fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ color: "#4ade80", fontSize: 8 }}>●</span>
            {truncate(wallet.address)}
          </div>
          <button
            onClick={handleDisconnect}
            title="Disconnect"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#94a3b8", fontSize: 15, lineHeight: 1, padding: "2px 4px", borderRadius: 4,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#0f172a"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
          >
            ×
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={handleConnect}
        disabled={wallet.status === "connecting"}
        style={{
          background: wallet.status === "connecting" ? "#cbd5e1" : "#0f172a",
          color: wallet.status === "connecting" ? "#64748b" : "#f1f5f9",
          borderRadius: 100, padding: "6px 16px", fontSize: 13, fontWeight: 600,
          border: "none", cursor: wallet.status === "connecting" ? "not-allowed" : "pointer",
          display: "inline-flex", alignItems: "center", gap: 5,
          transition: "transform 0.12s ease, box-shadow 0.12s ease", flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (wallet.status === "connecting") return;
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(15,23,42,0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
        }}
      >
        {wallet.status === "connecting" ? "Connecting…" : <>Connect <span style={{ fontSize: 11 }}>↗</span></>}
      </button>
    );
  }

  // ── Full (hero) ───────────────────────────────────────────────────────────
  if (wallet.status === "connected") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{
          background: "#ffffff", border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 16, padding: "20px 28px", textAlign: "center",
          minWidth: 320, boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
        }}>
          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
            color: "#64748b", textTransform: "uppercase", margin: "0 0 10px",
          }}>
            Connected · Bradbury Testnet
          </p>
          <p style={{ fontFamily: "monospace", fontSize: 13, color: "#0f172a", wordBreak: "break-all", margin: "0 0 12px" }}>
            {wallet.address}
          </p>
          <p style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>
            {wallet.balance}
          </p>
        </div>
        <button
          onClick={handleDisconnect}
          style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <button
        onClick={handleConnect}
        disabled={wallet.status === "connecting"}
        style={{
          background: wallet.status === "connecting" ? "#cbd5e1" : "#0f172a",
          color: wallet.status === "connecting" ? "#64748b" : "#f1f5f9",
          borderRadius: 100, padding: "14px 36px", fontSize: 15, fontWeight: 600,
          border: "none", cursor: wallet.status === "connecting" ? "not-allowed" : "pointer",
          display: "inline-flex", alignItems: "center", gap: 8,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (wallet.status === "connecting") return;
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px) scale(1.02)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(15,23,42,0.22)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
        }}
      >
        {wallet.status === "connecting" ? "Connecting…" : <>Connect Wallet <span style={{ fontSize: 14 }}>↗</span></>}
      </button>
      {wallet.status === "error" && (
        <p style={{ fontSize: 13, color: "#ef4444", maxWidth: 340, textAlign: "center", margin: 0 }}>
          {wallet.message}
        </p>
      )}
    </div>
  );
}
