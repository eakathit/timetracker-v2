"use client";

// ============================================================
// LoginPage.jsx — Time Tracker V2 · HSD Edition
// วาง logo.jpg ไว้ที่ /public/logo.jpg แล้วใช้งานได้เลย
// ============================================================

import { useState, useEffect } from "react";
import Image from "next/image";

// ─── COMPANY CONFIG ──────────────────────────────────────────
const COMPANY = {
  name: "HSD",
  fullName: "HARU SYSTEM DEVELOPMENT (THAILAND) CO.,LTD.",   // ← ปรับชื่อเต็มบริษัทได้ที่นี่
  logoSrc: "/logo.jpg",          // ← วาง logo ไว้ที่ /public/logo.jpg
  appName: "Time Tracker",
};
// ─────────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ── Live Clock ──────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState({ h: "--", m: "--", s: "--" });
  const [date, setDate] = useState("");

  useEffect(() => {
    const fmt = () => {
      const now = new Date();
      const parts = now.toLocaleTimeString("th-TH", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).split(":");
      setTime({ h: parts[0], m: parts[1], s: parts[2] });
      setDate(now.toLocaleDateString("th-TH", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      }));
    };
    fmt();
    const id = setInterval(fmt, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "1px" }}>
        <span style={{ fontSize: "38px", fontWeight: 800, color: "#0f172a", letterSpacing: "-2px", fontFamily: "'Sarabun', sans-serif" }}>
          {time.h}
        </span>
        <span style={{ fontSize: "28px", fontWeight: 700, color: "#2563eb", paddingBottom: "4px" }}>:</span>
        <span style={{ fontSize: "38px", fontWeight: 800, color: "#0f172a", letterSpacing: "-2px", fontFamily: "'Sarabun', sans-serif" }}>
          {time.m}
        </span>
        <span style={{ fontSize: "20px", fontWeight: 600, color: "#94a3b8", marginLeft: "5px", letterSpacing: "-1px", minWidth: "30px" }}>
          {time.s}
        </span>
      </div>
      <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "4px", fontFamily: "'Sarabun', sans-serif" }}>
        {date}
      </div>
    </div>
  );
}

// ── Main Login Page ─────────────────────────────────────────
export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [googleHover, setGoogleHover] = useState(false);
  const [installHover, setInstallHover] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(link);
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f1f4e 0%, #1a3a8f 50%, #0a2040 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Sarabun', sans-serif",
      position: "relative",
      overflow: "hidden",
      padding: "24px 16px",
    }}>

      {/* Decorative circles (gear-like) */}
      <div style={{ position: "absolute", top: "-140px", right: "-140px", width: "420px", height: "420px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "-90px", right: "-90px", width: "300px", height: "300px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />

      {/* Green glow - bottom left */}
      <div style={{ position: "absolute", bottom: "-80px", left: "-80px", width: "320px", height: "320px", borderRadius: "50%", background: "rgba(22,163,74,0.18)", filter: "blur(70px)", pointerEvents: "none" }} />
      {/* Blue glow - top right */}
      <div style={{ position: "absolute", top: "25%", right: "-50px", width: "240px", height: "240px", borderRadius: "50%", background: "rgba(37,99,235,0.25)", filter: "blur(60px)", pointerEvents: "none" }} />

      {/* Dot grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

      {/* ── Card Container ── */}
      <div style={{
        width: "100%", maxWidth: "380px",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0) scale(1)" : "translateY(20px) scale(0.98)",
        transition: "all 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>

        {/* ── LOGO + COMPANY NAME ── */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          marginBottom: "22px", gap: "12px",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.8s ease 0.15s",
        }}>
          {/* Logo with glow ring */}
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute", inset: "-10px", borderRadius: "50%",
              background: "radial-gradient(circle, rgba(37,99,235,0.4) 0%, transparent 70%)",
              filter: "blur(10px)",
            }} />
            <div style={{
              width: "88px", height: "88px", borderRadius: "50%",
              background: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
              position: "relative",
              border: "3px solid rgba(255,255,255,0.95)",
              overflow: "hidden",
            }}>
              <Image
                src={COMPANY.logoSrc}
                alt={`${COMPANY.name} Logo`}
                width={76}
                height={76}
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
          </div>

          {/* Company name + badge */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "19px", fontWeight: 800, color: "white", letterSpacing: "0.02em", lineHeight: 1 }}>
              {COMPANY.fullName}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              marginTop: "6px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "20px", padding: "3px 10px",
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", fontWeight: 500, letterSpacing: "0.06em" }}>
                {COMPANY.appName}
              </span>
            </div>
          </div>
        </div>

        {/* ── Glass Card ── */}
        <div style={{
          background: "rgba(255,255,255,0.97)",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.8)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}>

          {/* HSD brand colors top bar */}
          <div style={{ height: "4px", background: "linear-gradient(90deg, #1a3a8f 0%, #2563eb 50%, #16a34a 100%)" }} />

          <div style={{ padding: "26px 24px 22px" }}>

            {/* Clock */}
            <div style={{
              background: "linear-gradient(135deg, #f8faff 0%, #eff4ff 100%)",
              borderRadius: "16px", padding: "18px 16px",
              marginBottom: "22px",
              border: "1px solid #dde8ff",
              boxShadow: "inset 0 1px 3px rgba(37,99,235,0.07)",
            }}>
              <LiveClock />
            </div>

            {/* Heading */}
            <div style={{ marginBottom: "18px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.3px" }}>
                เข้าสู่ระบบ
              </h1>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
                ลงชื่อเข้าใช้เพื่อเริ่มบันทึกเวลางาน
              </p>
            </div>

            {/* Google Button */}
            <button
              onMouseEnter={() => setGoogleHover(true)}
              onMouseLeave={() => setGoogleHover(false)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                padding: "13px 20px", borderRadius: "12px",
                border: `2px solid ${googleHover ? "#2563eb" : "#e2e8f0"}`,
                background: googleHover ? "#f0f7ff" : "white",
                cursor: "pointer", fontSize: "14.5px", fontWeight: 600,
                color: "#1e293b", fontFamily: "'Sarabun', sans-serif",
                transition: "all 0.18s ease",
                boxShadow: googleHover ? "0 4px 16px rgba(37,99,235,0.15)" : "0 2px 6px rgba(0,0,0,0.06)",
                transform: googleHover ? "translateY(-1px)" : "none",
              }}
            >
              <GoogleIcon />
              เข้าสู่ระบบด้วย Google
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "14px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              <span style={{ fontSize: "11.5px", color: "#94a3b8", fontWeight: 500 }}>หรือ</span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            </div>

            {/* Install Button */}
            <button
              onMouseEnter={() => setInstallHover(true)}
              onMouseLeave={() => setInstallHover(false)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: "13px 20px", borderRadius: "12px", border: "none",
                background: installHover
                  ? "linear-gradient(135deg, #1a3a8f, #1d4ed8)"
                  : "linear-gradient(135deg, #1e40af, #2563eb)",
                cursor: "pointer", fontSize: "14.5px", fontWeight: 600,
                color: "white", fontFamily: "'Sarabun', sans-serif",
                transition: "all 0.18s ease",
                boxShadow: installHover ? "0 8px 24px rgba(26,58,143,0.45)" : "0 4px 14px rgba(37,99,235,0.3)",
                transform: installHover ? "translateY(-1px)" : "none",
              }}
            >
              <DownloadIcon />
              ติดตั้งแอป {COMPANY.appName}
            </button>

            {/* Security note */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "16px" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                ข้อมูลของคุณปลอดภัย · เข้ารหัสตลอดเวลา
              </span>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center", marginTop: "16px",
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.8s ease 0.4s",
        }}>
          <p style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.3)", margin: 0 }}>
            © {new Date().getFullYear()} {COMPANY.fullName} · All rights reserved
          </p>
        </div>

      </div>
    </div>
  );
}