// src/app/layout.tsx
import "./globals.css";
import { Prompt } from "next/font/google";

const prompt = Prompt({ subsets: ["thai", "latin"], weight: ["300", "400", "500", "700"] });

export const metadata = {
  title: "TimeTracker V2",
  description: "ระบบบันทึกเวลาเข้า-ออกงาน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={prompt.className}>
        {/* ไม่มี Sidebar ตรงนี้แล้ว! หน้า Login จะได้โล่งๆ */}
        {children}
      </body>
    </html>
  );
}