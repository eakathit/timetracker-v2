"use client";

import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";

// แยก inner component เพื่ออ่าน context ได้
function AppShellInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex w-full min-h-screen">
      {/* ── PC Sidebar ── */}
      <Sidebar />

      {/* ── Main Content ── ขยับตาม sidebar collapse/expand ด้วย transition */}
      <main
        className={`
          flex-1 min-h-screen overflow-y-auto
          transition-all duration-300 ease-in-out
          ${collapsed ? "md:ml-[72px]" : "md:ml-60"}
        `}
      >
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <BottomNav />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShellInner>{children}</AppShellInner>
    </SidebarProvider>
  );
}