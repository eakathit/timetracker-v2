"use client";

import { useSidebar } from "@/context/SidebarContext";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
  // ดึงสถานะ collapsed ว่า Sidebar ถูกพับอยู่หรือไม่
  const { collapsed } = useSidebar();

  return (
    <main
      className={`
        flex-1 overflow-y-auto pb-20 md:pb-0 
        transition-all duration-300 ease-in-out
        ${collapsed ? "md:ml-[72px]" : "md:ml-60"}
      `}
    >
      {children}
    </main>
  );
}