"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import InstallPrompt from "@/components/InstallPrompt";
import GoogleLoginButton from "@/components/GoogleLoginButton";

const COMPANY = {
  name: "HSD",
  fullName: "HARU SYSTEM DEVELOPMENT (THAILAND) CO.,LTD.",
  logoSrc: "/logo.jpg",
  appName: "Time Tracker",
};

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // โหลด Prompt font จาก Google Fonts
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(link);
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0f1f4e 0%, #1a3a8f 50%, #0a2040 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Prompt', sans-serif",
        position: "relative",
        overflow: "hidden",
        padding: "24px 16px",
      }}
    >
      {/* Decorative circles */}
      <div style={{ position: "absolute", top: "-140px", right: "-140px", width: "420px", height: "420px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.05)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "-90px", right: "-90px", width: "300px", height: "300px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-80px", left: "-80px", width: "320px", height: "320px", borderRadius: "50%", background: "rgba(22,163,74,0.18)", filter: "blur(70px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "25%", right: "-50px", width: "240px", height: "240px", borderRadius: "50%", background: "rgba(37,99,235,0.25)", filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

      {/* ── Card Container ── */}
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0) scale(1)" : "translateY(20px) scale(0.98)",
          transition: "all 0.65s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* ── LOGO + COMPANY NAME ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "22px",
            gap: "12px",
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.8s ease 0.15s",
          }}
        >
          {/* Logo */}
          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "absolute", inset: "-10px", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(37,99,235,0.4) 0%, transparent 70%)",
                filter: "blur(10px)",
              }}
            />
            <div
              style={{
                width: "88px", height: "88px", borderRadius: "50%",
                background: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
                position: "relative",
                border: "3px solid rgba(255,255,255,0.95)",
                overflow: "hidden",
              }}
            >
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
            {/* ชื่อบริษัท: Prompt 700 */}
            <div
              style={{
                fontSize: "15px",
                fontWeight: 700,
                fontFamily: "'Prompt', sans-serif",
                color: "white",
                letterSpacing: "0.01em",
                lineHeight: 1.4,
              }}
            >
              {COMPANY.fullName}
            </div>

            {/* Badge */}
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                marginTop: "8px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "20px", padding: "3px 10px",
              }}
            >
              <div
                style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "#4ade80", boxShadow: "0 0 6px #4ade80",
                }}
              />
              {/* Badge text: Prompt 500 */}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  fontFamily: "'Prompt', sans-serif",
                  color: "rgba(255,255,255,0.75)",
                  letterSpacing: "0.05em",
                }}
              >
                {COMPANY.appName}
              </span>
            </div>
          </div>
        </div>

        {/* ── Glass Card ── */}
        <div
          style={{
            background: "rgba(255,255,255,0.97)",
            borderRadius: "24px",
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.15)",
            overflow: "hidden",
          }}
        >
          
          <div style={{ padding: "26px 24px 22px" }}>

            {/* ── Heading ── */}
            <div style={{ marginBottom: "20px", textAlign: "center" }}>
              {/* หัวข้อหลัก: Prompt 700 */}
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  fontFamily: "'Prompt', sans-serif",
                  color: "#0f172a",
                  margin: "0 0 6px",
                  letterSpacing: "-0.2px",
                }}
              >
                เข้าสู่ระบบ
              </h1>
              {/* คำบรรยาย: Prompt 300 */}
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 300,
                  fontFamily: "'Prompt', sans-serif",
                  color: "#94a3b8",
                  margin: 0,
                  letterSpacing: "0.01em",
                }}
              >
                ลงชื่อเข้าใช้เพื่อเริ่มบันทึกเวลางาน
              </p>
            </div>

            {/* ── Google Login (component เดิม) ── */}
            <GoogleLoginButton />

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "14px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 400,
                  fontFamily: "'Prompt', sans-serif",
                  color: "#94a3b8",
                }}
              >
                หรือ
              </span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            </div>

            {/* ── Install PWA (component เดิม) ── */}
            <InstallPrompt />

            {/* Security note */}
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "5px", marginTop: "16px",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {/* หมายเหตุ: Prompt 300 */}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 300,
                  fontFamily: "'Prompt', sans-serif",
                  color: "#94a3b8",
                }}
              >
                ข้อมูลของคุณปลอดภัย · เข้ารหัสตลอดเวลา
              </span>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            textAlign: "center", marginTop: "16px",
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.8s ease 0.4s",
          }}
        >
          {/* Footer: Prompt 300 */}
          <p
            style={{
              fontSize: "11px",
              fontWeight: 300,
              fontFamily: "'Prompt', sans-serif",
              color: "rgba(255,255,255,0.3)",
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            © {new Date().getFullYear()} {COMPANY.fullName} · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}