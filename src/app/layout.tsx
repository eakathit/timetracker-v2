// src/app/layout.tsx
import "./globals.css";
import { Prompt } from "next/font/google";
import IOSPWACameraFix from "@/components/IOSPWACameraFix"; // ← เพิ่ม

const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["300", "400", "500", "700"] });

export const metadata = {
  title: "TimeTracker",
  description: "ระบบบันทึกเวลาเข้า-ออกงาน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={prompt.className}>
        <IOSPWACameraFix /> {/* ← เพิ่ม */}
        {children}
      </body>
    </html>
  );
}