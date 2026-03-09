"use client";

// ============================================================
// LoginPage.tsx — Time Tracker V2 · HSD Edition
// ============================================================

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase"; // ← ปรับ path ให้ตรงกับ project

// ─── COMPANY CONFIG ──────────────────────────────────────────
const COMPANY = {
  name: "HSD",
  fullName: "HARU SYSTEM DEVELOPMENT (THAILAND) CO.,LTD.",
  logoSrc: "/logo.jpg",
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

// ── Main Login Page ─────────────────────────────────────────
export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [googleHover, setGoogleHover] = useState(false);
  const [installHover, setInstallHover] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(link);
    const t = setTimeout(() => setMounted(true), 80);

    // ── รับ PWA install prompt ──
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // ── Google Sign-in ──────────────────────────────────────
  const handleGoogleLogin = async () => {
    try {
      setLoadingGoogle(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error("Google login error:", err);
      setLoadingGoogle(false);
    }
  };

  // ── PWA Install ─────────────────────────────────────────
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
    }
  };

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

      {/* Decorative circles */}
      <div style={{ position: "absolute", top: "-140px", right: "-140px", width: "420px", height: "420px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "-90px", right: "-90px", width: "300px", height: "300px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-80px", left: "-80px", width: "320px", height: "320px", borderRadius: "50%", background: "rgba(22,163,74,0.18)", filter: "blur(70px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "25%", right: "-50px", width: "240px", height: "240px", borderRadius: "50%", background: "rgba(37,99,235,0.25)", filter: "blur(60px)", pointerEvents: "none" }} />
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
          <div style={{ height: "4px", background: "linear-gradient(90deg, #1a3a8f 0%, #2563eb 50%, #16a34a 100%)" }} />

          <div style={{ padding: "26px 24px 22px" }}>

            {/* Heading */}
            <div style={{ marginBottom: "18px", textAlign: "center" }}>
              <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.3px" }}>
                เข้าสู่ระบบ
              </h1>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
                ลงชื่อเข้าใช้เพื่อเริ่มบันทึกเวลางาน
              </p>
            </div>

            {/* ── Google Button ── */}
            <button
              onClick={handleGoogleLogin}
              disabled={loadingGoogle}
              onMouseEnter={() => setGoogleHover(true)}
              onMouseLeave={() => setGoogleHover(false)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                padding: "13px 20px", borderRadius: "12px",
                border: `2px solid ${googleHover ? "#2563eb" : "#e2e8f0"}`,
                background: loadingGoogle ? "#f8fafc" : googleHover ? "#f0f7ff" : "white",
                cursor: loadingGoogle ? "not-allowed" : "pointer",
                fontSize: "14.5px", fontWeight: 600,
                color: "#1e293b", fontFamily: "'Sarabun', sans-serif",
                transition: "all 0.18s ease",
                boxShadow: googleHover ? "0 4px 16px rgba(37,99,235,0.15)" : "0 2px 6px rgba(0,0,0,0.06)",
                transform: googleHover && !loadingGoogle ? "translateY(-1px)" : "none",
                opacity: loadingGoogle ? 0.7 : 1,
              }}
            >
              {loadingGoogle ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"
                  style={{ animation: "spin 0.8s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              ) : (
                <GoogleIcon />
              )}
              {loadingGoogle ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วย Google"}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "14px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              <span style={{ fontSize: "11.5px", color: "#94a3b8", fontWeight: 500 }}>หรือ</span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            </div>

            {/* ── Install Button ── */}
            <button
              onClick={handleInstall}
              disabled={!canInstall}
              onMouseEnter={() => setInstallHover(true)}
              onMouseLeave={() => setInstallHover(false)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: "13px 20px", borderRadius: "12px", border: "none",
                background: !canInstall
                  ? "linear-gradient(135deg, #94a3b8, #cbd5e1)"
                  : installHover
                    ? "linear-gradient(135deg, #1a3a8f, #1d4ed8)"
                    : "linear-gradient(135deg, #1e40af, #2563eb)",
                cursor: canInstall ? "pointer" : "not-allowed",
                fontSize: "14.5px", fontWeight: 600,
                color: "white", fontFamily: "'Sarabun', sans-serif",
                transition: "all 0.18s ease",
                boxShadow: canInstall
                  ? installHover ? "0 8px 24px rgba(26,58,143,0.45)" : "0 4px 14px rgba(37,99,235,0.3)"
                  : "none",
                transform: installHover && canInstall ? "translateY(-1px)" : "none",
                opacity: canInstall ? 1 : 0.6,
              }}
            >
              <DownloadIcon />
              {canInstall ? `ติดตั้งแอป ${COMPANY.appName}` : "เปิดในเบราว์เซอร์เพื่อติดตั้ง"}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// TypeScript type สำหรับ BeforeInstallPromptEvent
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
}