"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BOTTOM_NAV = [
  {
    label: "Home",
    href: "/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Attendance",
    href: "/attendance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 14" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 14" />
      </svg>
    ),
  },
  {
    label: "OT",
    href: "/ot",
    isCTA: true,
    badge: 2,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
  },
  {
    label: "Reports",
    href: "/report",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    label: "Profile",
    href: "/profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    iconFilled: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Safe area spacer */}
      <div className="md:hidden h-20" />

      <nav className="
        md:hidden fixed bottom-0 left-0 right-0 z-30
        bg-white/95 backdrop-blur-xl border-t border-gray-100
        shadow-[0_-4px_24px_rgba(0,0,0,0.08)]
      ">
        <div className="flex items-end justify-around px-2 pt-2 pb-[env(safe-area-inset-bottom,8px)]">
          {BOTTOM_NAV.map((item) => {
            const isActive = pathname === item.href;

            // CTA Center button (OT)
            if (item.isCTA) {
              return (
                <Link key={item.href} href={item.href} className="relative flex flex-col items-center -mt-6 pb-1">
                  <div className={`
                    relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg
                    transition-all duration-200 active:scale-90
                    ${isActive
                      ? "bg-sky-500 shadow-sky-300/50"
                      : "bg-slate-900 shadow-slate-400/30"
                    }
                  `}>
                    <span className="w-6 h-6 text-white">{item.icon}</span>

                    {/* Badge */}
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

                {/* Label */}
                <span className={`text-[10px] font-medium leading-none transition-colors duration-200 ${isActive ? "text-sky-500 font-semibold" : "text-slate-400"}`}>
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