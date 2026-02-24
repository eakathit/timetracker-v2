import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const prompt = Prompt({ 
  weight: ['400', '500', '600', '700'],
  subsets: ["thai", "latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "TimeTracker V2",
  description: "ระบบบันทึกเวลาเข้า-ออกงาน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${prompt.className} antialiased bg-gray-50 text-gray-800`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}