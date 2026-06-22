"use client";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const CONTRACT_ADDRESS =
  "0xB1aBc0020194300a198E05B62571cb3d216BfF26" as const;

// Read-only client — no wallet required. Safe to use anywhere.
export const readClient = createClient({ chain: testnetBradbury });

// Write client — call only after wallet has returned an address.
export function createWriteClient(address: `0x${string}`) {
  return createClient({
    chain: testnetBradbury,
    account: address,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: (window as any).ethereum,
  });
}

export function formatGEN(wei: bigint): string {
  const whole = wei / BigInt("1000000000000000000");
  const remainder = wei % BigInt("1000000000000000000");
  const frac = (remainder * BigInt(10000)) / BigInt("1000000000000000000");
  return `${whole}.${frac.toString().padStart(4, "0")} GEN`;
}
