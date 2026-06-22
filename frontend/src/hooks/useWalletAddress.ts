"use client";
import { useState, useEffect } from "react";

export function useWalletAddress(): string | null {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    const detect = async () => {
      try {
        const accs = await window.ethereum!.request<string[]>({ method: "eth_accounts" });
        setAddress(accs?.[0] ?? null);
      } catch { /* wallet unavailable */ }
    };
    detect();
    const handler = (accounts: unknown) => setAddress((accounts as string[])[0] ?? null);
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  }, []);

  return address;
}
