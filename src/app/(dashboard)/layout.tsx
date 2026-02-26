// src/app/(dashboard)/layout.tsx
import Sidebar from "@/components/Sidebar";
// 1. Import ตัว BottomNav ของคุณเข้ามา
import BottomNav from "@/components/BottomNav"; 

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* 2. Sidebar จะทำงานบนจอ PC (มักจะถูกซ่อนในมือถือ) */}
      <Sidebar />
      
      {/* 3. เพิ่ม pb-20 (padding-bottom) เฉพาะจอมือถือ 
             เพื่อป้องกันไม่ให้เนื้อหาด้านล่างสุดโดนแถบ BottomNav บังทับ */}
      <main className="flex-1 md:ml-64 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* 4. Bottom Nav จะทำงานบนจอมือถือ (ต้องเขียน CSS ซ่อนในจอ PC ไว้ที่ไฟล์ BottomNav.tsx) */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}