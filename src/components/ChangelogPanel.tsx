"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ChangelogTag = "feature" | "fix" | "improvement" | "breaking";

interface ChangelogEntry {
  version: string;
  date: string;
  items: {
    tag: ChangelogTag;
    text: string;
  }[];
}

// ─── Changelog Data (Dev/Admin) ────────────────────────────────────
const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.7.5",
    date: "2026-03-16",
    items: [
      { tag: "feature",     text: "Qr code Checkin เพิ่มรายชื่อพนักงาน Checkin factory/on-site" },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-03-16",
    items: [
      { tag: "feature",     text: "เพิ่ม Checkin สเเกน qr-code" },
      { tag: "fix",         text: "เเก้ไข Checkin qr-code ไม่ตรวจสอบเวลาให้" },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-03-13",
    items: [
      { tag: "feature",     text: "เพิ่มพนักงานมาทำงานระหว่างวัน On-site" },
      { tag: "feature",     text: "ลบ session code ออกจาก On-site" },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-03-10",
    items: [
      { tag: "feature",     text: "เพิ่ม Other Enduser ตอนสร้างห้อง On-site" },
      { tag: "fix", text: "ประเภทนงานเเละ Enduser ไม่สามารถลบได้" },
      { tag: "fix", text: "เเก้ไข Project Export excel ช่องเกินมา" },
    ],
  },
  {
    version: "1.4.5",
    date: "2026-03-10",
    items: [
      { tag: "feature",     text: "HR Attendance Export Excel รายบุคคลเพิ่มช่องรายละเอียด OT" },
      { tag: "feature",     text: "Project Summary ตัวกรองลบประเภทงานออก เเล้วใส่ EndUser เเทน" },
      { tag: "feature",     text: "เพิ่มรายละเอียดข้อมูลหน้า HR Attendance เเยกชม.เเละโอที วันปกติกับวันหยุด" },
    ],
  },
  {
    version: "1.4.1",
    date: "2026-03-09",
    items: [
      { tag: "feature",     text: "Project Summary เพิ่มช่อง Total (hrs.) ตอน Export Excel" },
      { tag: "feature",     text: "หน้า Request ใบลาเเละใบขอคำโอทีเเยกช่องตามเเผนก" },
      { tag: "feature",     text: "ตกเเต่ง Redesign  หน้า Login หน้า Webapp" },
      { tag: "fix", text: "เเก้ไขกดสร้างห้อง On-site ในมือถือไม่ได้" },
    ],
  },
    {
    version: "1.4.0", 
    date: "2026-03-09",
    items: [
      { tag: "feature",     text: "เพิ่มระบบแจ้งเตือน Changelog 🎉" },
      { tag: "fix",         text: "แก้ไขปุ่ม Check-in กดแล้ว delay นาน" },
      { tag: "improvement", text: "ปรับ UI หน้า Dashboard ให้โหลดเร็วขึ้น" },
    ],
  },
];

// ─── Tag Badge ─────────────────────────────────────────────────────────────────
const TAG_CONFIG: Record<ChangelogTag, { label: string; className: string }> = {
  feature:     { label: "Feature",     className: "bg-sky-100 text-sky-700" },
  fix:         { label: "Bug Fix",     className: "bg-rose-100 text-rose-700" },
  improvement: { label: "ปรับปรุง",    className: "bg-amber-100 text-amber-700" },
  breaking:    { label: "Breaking",    className: "bg-purple-100 text-purple-700" },
};

const LAST_READ_KEY = "changelog_last_read";

// ─── Props ────────────────────────────────────────────────────────────────────
interface ChangelogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangelogPanel({ isOpen, onClose }: ChangelogPanelProps) {
  if (!isOpen) return null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel (Slide-in from right) */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-sky-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-sky-500">
              {/* Bell icon */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">อัพเดทระบบ</h2>
              <p className="text-xs text-gray-400">Release Notes & Bug Fixes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {CHANGELOG.map((entry, idx) => (
            <div key={entry.version}>
              {/* Version Header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-white text-xs font-bold font-mono">
                  v{entry.version}
                </span>
                {idx === 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    ล่าสุด
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{formatDate(entry.date)}</span>
              </div>

              {/* Items */}
              <ul className="space-y-2">
                {entry.items.map((item, i) => {
                  const cfg = TAG_CONFIG[item.tag];
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold mt-0.5 ${cfg.className}`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm text-gray-600 leading-relaxed">{item.text}</span>
                    </li>
                  );
                })}
              </ul>

              {/* Divider */}
              {idx < CHANGELOG.length - 1 && (
                <div className="mt-5 border-b border-dashed border-gray-100" />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-center text-gray-400">อัพเดทโดย Dev · Time Tracker</p>
        </div>
      </div>
    </>
  );
}

// ─── Bell Button with Unread Dot ──────────────────────────────────────────────
export function ChangelogBellButton() {
  const [isOpen, setIsOpen]       = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // เช็ค version ล่าสุดกับที่ User อ่านแล้ว
  useEffect(() => {
    const lastRead = localStorage.getItem(LAST_READ_KEY);
    setHasUnread(lastRead !== CHANGELOG[0].version);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
    localStorage.setItem(LAST_READ_KEY, CHANGELOG[0].version);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-500 hover:text-sky-500 hover:border-sky-200 transition-all"
        aria-label="อัพเดทระบบ"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread Dot */}
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      <ChangelogPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}