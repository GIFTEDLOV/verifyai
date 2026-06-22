"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "./ConnectButton";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/plagiarism", label: "Plagiarism" },
  { href: "/ai-detection", label: "AI Detection" },
  { href: "/profile", label: "Profile" },
];

export default function NavBar() {
  const path = usePathname();

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      borderBottom: "1px solid rgba(15,23,42,0.07)",
      background: "rgba(248,250,252,0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: "#0f172a",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#f1f5f9", fontWeight: 700,
          }}>
            ✓
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
            VerifyAI
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? "#0f172a" : "#64748b",
                  textDecoration: "none",
                  padding: "5px 11px",
                  borderRadius: 8,
                  background: active ? "#f1f5f9" : "transparent",
                  transition: "color 0.12s ease, background 0.12s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Wallet */}
        <div style={{ flexShrink: 0 }}>
          <ConnectButton compact />
        </div>
      </div>
    </nav>
  );
}
