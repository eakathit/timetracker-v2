"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ─── Icon Library ─────────────────────────────────────────────────────────────
const Icons = {
  // Requests (clipboard + list)
  requests: {
    outline: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
    filled: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    ),
  },

  // Report (bar chart)
  report: {
    outline: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
    filled: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },

  // Home — classic house (triangular roof + door)
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* หลังคาสามเหลี่ยม */}
      <polyline points="3 11 12 2 21 11" />
      {/* ผนังบ้าน */}
      <path d="M5 11v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
    </svg>
  ),

  // Calendar
  calendar: {
    outline: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
      </svg>
    ),
    filled: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="16" y1="2" x2="16" y2="6" />
      </svg>
    ),
  },

  // Profile (user)
  profile: {
    outline: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    filled: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
};

// ─── Nav Config ───────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  labelTh: string;
  href: string;
  isCTA?: boolean;
  badge?: number;
  icon: React.ReactNode;
  iconFilled: React.ReactNode;
}

const BOTTOM_NAV: NavItem[] = [
  {
    label: "Requests",
    labelTh: "คำขอ",
    href: "/requests",
    icon: Icons.requests.outline,
    iconFilled: Icons.requests.filled,
  },
  {
  label:   "On-site",
  labelTh: "On-site",
  href:    "/onsite",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  iconFilled: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
},
  {
    // ── CTA Center Button ──
    label: "Home",
    labelTh: "หน้าหลัก",
    href: "/",
    isCTA: true,
    icon: Icons.home,
    iconFilled: Icons.home,
  },
  {
    label: "Calendar",
    labelTh: "ปฏิทิน",
    href: "/calendar",
    icon: Icons.calendar.outline,
    iconFilled: Icons.calendar.filled,
  },
  {
    label: "Profile",
    labelTh: "โปรไฟล์",
    href: "/profile",
    icon: Icons.profile.outline,
    iconFilled: Icons.profile.filled,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Safe area spacer — ป้องกัน content ถูกบังด้วย nav bar */}
      <div className="md:hidden h-20" />

      <nav className="
        md:hidden fixed bottom-0 left-0 right-0 z-30
        bg-white/95 backdrop-blur-xl border-t border-gray-100
        shadow-[0_-4px_24px_rgba(0,0,0,0.08)]
      ">
        <div className="flex items-end justify-around px-2 pt-2 pb-[env(safe-area-inset-bottom,16px)]">
          {BOTTOM_NAV.map((item) => {
            const isActive = pathname === item.href;

            // ── CTA Center Button (Home) ──────────────────────────────────
            if (item.isCTA) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex flex-col items-center -mt-6 pb-1"
                >
                  <div className={`
                    relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg
                    transition-all duration-200 active:scale-90
                    ${isActive
                      ? "bg-sky-500 shadow-sky-300/50"
                      : "bg-slate-900 shadow-slate-400/30"
                    }
                  `}>
                    <span className="w-6 h-6 text-white">{item.icon}</span>

                    {/* Badge (optional) */}
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-semibold ${isActive ? "text-sky-500" : "text-slate-500"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            }

            // ── Regular Nav Items ─────────────────────────────────────────
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center gap-1 px-3 py-1 min-w-[44px] active:scale-90 transition-transform duration-150"
              >
                {/* Active dot indicator */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 w-1 h-1 rounded-full bg-sky-500" />
                )}

                {/* Icon */}
                <span className={`
                  w-6 h-6 transition-colors duration-200
                  ${isActive ? "text-sky-500" : "text-slate-400"}
                `}>
                  {isActive ? item.iconFilled : item.icon}
                </span>

                {/* Badge */}
                {item.badge && (
                  <span className="absolute top-0.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}

                {/* Label */}
                <span className={`
                  text-[10px] font-medium leading-none transition-colors duration-200
                  ${isActive ? "text-sky-500 font-semibold" : "text-slate-400"}
                `}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}