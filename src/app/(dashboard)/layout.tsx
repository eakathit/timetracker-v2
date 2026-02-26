// src/app/(dashboard)/layout.tsx
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav"; 
import { SidebarProvider } from "@/context/SidebarContext";
// 1. Import ตัว Wrapper ที่เราเพิ่งสร้าง
import MainWrapper from "@/components/MainWrapper";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        
        {/* 2. เปลี่ยนแท็ก <main> เป็น MainWrapper ที่เราสร้างขึ้น */}
        <MainWrapper>
          {children}
        </MainWrapper>

        <div className="md:hidden">
          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}