"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import LogoutButton from '@/components/LogoutButton';

// ─── Types ───────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  labelTh: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

// ─── Icons (SVG inline เพื่อไม่ต้องลง library) ───────────────────────────────
const Icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  chartBar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  ot: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="12" x2="15" y2="14" />
      <path d="M17 3.5L21 7" />
    </svg>
  ),
  leave: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  logo: (
    <svg viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="10" fill="#38BDF8" fillOpacity="0.15" />
      <path d="M16 6L6 11l10 5 10-5-10-5z" stroke="#38BDF8" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 21l10 5 10-5" stroke="#38BDF8" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6 16l10 5 10-5" stroke="#38BDF8" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
};

// ─── Nav config (เพิ่มเมนูได้ตรงนี้เลย) ──────────────────────────────────────
const NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: "Overview",
    items: [
      { label: "Time Attendance", labelTh: "ลงเวลา", href: "/", icon: Icons.ot },
      { label: "Report", labelTh: "รายการ", href: "/report", icon: Icons.chartBar },
      { label: "Calendar", labelTh: "ปฏิทิน", href: "/calendar", icon: Icons.calendar },
      { label: "Profile", labelTh: "โปรไฟล์", href: "/profile", icon: Icons.user },
    ],
  },
  {
    groupLabel: "Requests",
    items: [
      { label: "OT Request", labelTh: "ขอทำ OT", href: "/ot", icon: Icons.ot, badge: 2 },
      { label: "Leave Request", labelTh: "ลาออก", href: "/leave", icon: Icons.leave },
    ],
  },
  {
    groupLabel: "Reports",
    items: [
      { label: "Team", labelTh: "ทีม", href: "/team", icon: Icons.users },
    ],
  },
  {
    groupLabel: "System",
    items: [
      { label: "Notifications", labelTh: "แจ้งเตือน", href: "/notifications", icon: Icons.bell, badge: 5 },
      { label: "Profile", labelTh: "โปรไฟล์", href: "/profile", icon: Icons.user },
      { label: "Settings", labelTh: "ตั้งค่า", href: "/settings", icon: Icons.settings },
    ],
  },
];

// ─── Single Nav Item Component ────────────────────────────────────────────────
function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      title={collapsed ? `${item.label} · ${item.labelTh}` : undefined}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-200 ease-out
        ${isActive
          ? "bg-sky-50 text-sky-600"
          : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
        }
      `}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sky-400 rounded-full" />
      )}

      {/* Icon */}
      <span className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${isActive ? "text-sky-500" : "text-gray-400 group-hover:text-gray-600"}`}>
        {item.icon}
      </span>

      {/* Label */}
      {!collapsed && (
        <span className="flex-1 truncate leading-none">{item.label}</span>
      )}

      {/* Badge */}
      {!collapsed && item.badge && (
        <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-sky-100 text-sky-600 text-xs font-semibold flex items-center justify-center">
          {item.badge}
        </span>
      )}

      {/* Collapsed tooltip */}
      {collapsed && (
        <span className="
          pointer-events-none absolute left-full ml-3 z-50
          px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-100 text-xs font-medium whitespace-nowrap
          opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0
          transition-all duration-150 shadow-xl border border-gray-700
        ">
          {item.label}
          {item.badge && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-sky-500/25 text-sky-400 text-[10px]">
              {item.badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <aside
      className={`
        hidden md:flex flex-col h-screen fixed top-0 left-0 z-30
        bg-white border-r border-gray-100
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-60"}
      `}
    >
      {/* ── Logo & Toggle ───────────────────────────────────────── */}
      <div className="relative flex items-center h-16 px-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 overflow-hidden min-w-0">
          <span className="w-8 h-8 flex-shrink-0">{Icons.logo}</span>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-gray-800 font-bold text-base leading-tight whitespace-nowrap tracking-tight">TimeTracker</p>
              <p className="text-gray-400 text-[10px] whitespace-nowrap">Work Management System</p>
            </div>
          )}
        </div>

        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="
            absolute -right-3 top-1/2 -translate-y-1/2
            w-6 h-6 rounded-full bg-white border border-gray-200
            flex items-center justify-center
            text-gray-400 hover:text-gray-700 hover:bg-gray-50
            transition-all duration-200 shadow-md
          "
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className={`w-3.5 h-3.5 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}>
            {Icons.chevronLeft}
          </span>
        </button>
      </div>

      {/* ── User Card ──────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 border-b border-gray-100 ${collapsed ? "p-2" : "p-3"}`}>
        <div className={`flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50 transition-colors cursor-pointer ${collapsed ? "justify-center" : ""}`}>
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
              ว
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-gray-800 font-semibold text-sm leading-tight truncate">ช่างวิทย์</p>
              <p className="text-gray-400 text-xs truncate">รหัส: #1055 · ช่างเทคนิค</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation Groups (Scrollable, hidden scrollbar) ─────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-5 px-2
        [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupLabel}>
            {/* Group label */}
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 select-none">
                {group.groupLabel}
              </p>
            )}
            {collapsed && (
              <div className="mx-auto w-6 border-t border-gray-100 mb-1.5" />
            )}

            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      
      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 p-3 border-t border-gray-100">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {!collapsed && (
            <p className="text-gray-400 text-[10px]">System Online · v2.0.1</p>
          )}
        </div>
      </div>
    </aside>
  );
}