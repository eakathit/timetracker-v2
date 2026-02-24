import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

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
        
        {/* คอนเทนเนอร์หลัก (ไม่ให้หน้าจอหลักขยับ) */}
        <div className="flex flex-col md:flex-row w-full h-screen overflow-hidden">
          
          {/* 📍 Sidebar สำหรับ PC (กว้าง 256px) */}
          <aside className="hidden md:flex flex-col w-64 h-screen fixed top-0 left-0 bg-white border-r border-gray-200 z-20">
            <div className="flex items-center gap-2 h-16 border-b border-gray-100 pl-5">
                <svg className="w-8 h-8 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5"></path>
                    <path d="M2 12l10 5 10-5"></path>
                </svg>
                <h1 className="text-lg font-bold text-gray-800">TimeTracker</h1>
            </div>
            <div className="p-4 text-center text-gray-400 text-sm mt-10">
              (เตรียมวางเมนู PC)
            </div>
          </aside>

          {/* 📍 พื้นที่ Content (เว้นระยะซ้ายหลบ Sidebar และกางเต็ม 100%) */}
          <div className="flex-1 md:ml-64 h-screen overflow-y-auto">
            {children}
          </div>

        </div>
      </body>
    </html>
  );
}