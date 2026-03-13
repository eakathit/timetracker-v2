"use client";

// src/app/(dashboard)/onsite/page.tsx
// หน้าหลัก On-site Hub
// - Leader: เห็น session วันนี้ที่สร้าง + ปุ่มสร้างใหม่
// - Member: เห็น session วันนี้ที่ถูกเพิ่มเข้า
// - ทุกคน: เห็นประวัติ sessions ที่ผ่านมา

import { useState, useEffect, useCallback } from "react";
import { useRouter }                         from "next/navigation";
import { supabase }                          from "@/lib/supabase";
import { getSessionHistory }                 from "@/app/actions/onsite";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionSummary {
  id:              string;
  site_name:       string;
  session_date:    string;
  status:          "open" | "checked_in" | "closed";
  group_check_in:  string | null;
  group_check_out: string | null;
  session_code:    string | null;
  project:         { project_no: string; name: string | null } | null;
  members:         { user_id: string; role: string; checkout_type: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "–";

const fmtDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
};

const getLocalToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const STATUS_CONFIG = {
  open:       { label: "รอ Check-in",  dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  checked_in: { label: "กำลังทำงาน",  dot: "bg-emerald-400 animate-pulse", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  closed:     { label: "เสร็จสิ้น",    dot: "bg-gray-400",    text: "text-gray-600",    bg: "bg-gray-50 border-gray-200" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionCard({
  session,
  currentUserId,
  isToday,
  onClick,
}: {
  session:       SessionSummary;
  currentUserId: string;
  isToday:       boolean;
  onClick:       () => void;
}) {
  const st       = STATUS_CONFIG[session.status];
  const isLeader = session.members.find((m) => m.user_id === currentUserId)?.role === "leader";
  const myCheckout = session.members.find((m) => m.user_id === currentUserId)?.checkout_type;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-sky-200 hover:shadow-md transition-all active:scale-[0.99]"
    >
      {/* Top strip สำหรับ active session */}
      {session.status === "checked_in" && (
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
      )}
      {session.status === "open" && (
        <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
      )}

      <div className="px-4 py-4">
        {/* Row 1: Site name + Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isLeader && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">
                  👑 Leader
                </span>
              )}
              {!isLeader && myCheckout === "early" && (
                <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full flex-shrink-0">
                  ออกก่อน
                </span>
              )}
            </div>
            <h3 className="text-base font-extrabold text-gray-800 truncate">{session.site_name}</h3>
            {session.project && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                Project {session.project.project_no}
                {session.project.name ? ` · ${session.project.name}` : ""}
              </p>
            )}
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-bold border px-2.5 py-1 rounded-full flex-shrink-0 ${st.bg} ${st.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </div>

        {/* Row 2: Time info */}
        <div className="flex items-center gap-4 text-sm">
          {session.group_check_in ? (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-emerald-500">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="font-semibold text-emerald-600">{fmtTime(session.group_check_in)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">ยังไม่ได้ Check-in</span>
          )}

          {session.group_check_out && (
            <>
              <span className="text-gray-300">→</span>
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-sky-500">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="font-semibold text-sky-600">{fmtTime(session.group_check_out)}</span>
              </div>
            </>
          )}

          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span>{session.members.length} คน</span>
          </div>
        </div>

        {/* Row 3: วันที่ (ถ้าไม่ใช่วันนี้) + Code */}
        {!isToday && (
  <div className="mt-3 pt-3 border-t border-gray-50">
    <span className="text-xs text-gray-400">{fmtDate(session.session_date)}</span>
  </div>
)}
      </div>
    </button>
  );
}

function EmptyState({ isToday }: { isToday: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-400">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/>
          <path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-500">
        {isToday ? "ยังไม่มี Session วันนี้" : "ยังไม่มีประวัติ"}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {isToday ? "กด + สร้างห้องเพื่อเริ่ม On-site" : "Sessions ที่ผ่านมาจะแสดงที่นี่"}
      </p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function OnsitePageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-32 animate-pulse">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-20 bg-gray-200 rounded-lg" />
            <div className="h-3 w-36 bg-gray-100 rounded-lg" />
          </div>
          <div className="h-9 w-28 bg-gray-100 rounded-xl" />
        </div>
      </header>

      <div className="px-4 py-5 space-y-6">
        {/* Today section */}
        <div>
          <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
              </div>
              <div className="h-6 w-16 bg-gray-100 rounded-full" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="flex-1 h-10 bg-gray-100 rounded-xl" />
              <div className="flex-1 h-10 bg-sky-100 rounded-xl" />
            </div>
          </div>
        </div>

        {/* History section */}
        <div>
          <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-28 bg-gray-200 rounded" />
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                  </div>
                  <div className="h-5 w-14 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OnsitePage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sessions, setSessions]           = useState<SessionSummary[]>([]);
  const [loading, setLoading]             = useState(true);

  const today = getLocalToday();

  // ── โหลดข้อมูล ────────────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    setCurrentUserId(user.id);

    const res = await getSessionHistory(20);
    if (res.success && res.data) setSessions(res.data as unknown as SessionSummary[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  if (loading) return <OnsitePageSkeleton />;
  
  // ── แยก today vs history ──────────────────────────────────────────────────
  const todaySessions   = sessions.filter((s) => s.session_date === today);
  const historySessions = sessions.filter((s) => s.session_date !== today);

  // ── Active session วันนี้ (open หรือ checked_in) ─────────────────────────
  const activeSession = todaySessions.find((s) => s.status !== "closed");

  return (
    <div className="min-h-screen bg-gray-50 pb-32">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-gray-800">On-site</h1>
            <p className="text-xs text-gray-400">บันทึกเวลางานนอกสถานที่</p>
          </div>

          {/* ปุ่มสร้างห้อง — แสดงเสมอ แต่ถ้ามี active session ให้ disable */}
          <button
            onClick={() => router.push("/onsite/create")}
            disabled={!!activeSession}
            title={activeSession ? "มี Session ที่ยังเปิดอยู่" : "สร้างห้องใหม่"}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeSession
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-200 active:scale-95"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            สร้างห้อง
          </button>
        </div>
      </header>

      <div className="px-4 py-5 space-y-6">

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ── Section: วันนี้ ─────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider">
                  วันนี้
                </h2>
                {todaySessions.length > 0 && (
                  <span className="text-xs text-gray-400">{todaySessions.length} session</span>
                )}
              </div>

              {todaySessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200">
                  <EmptyState isToday />
                </div>
              ) : (
                <div className="space-y-3">
                  {todaySessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      currentUserId={currentUserId ?? ""}
                      isToday
                      onClick={() => router.push(`/onsite/${s.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* ── Banner: มี Active Session ────────────────────────────────── */}
            {activeSession && (
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-4 flex items-center gap-4 cursor-pointer shadow-lg shadow-emerald-100"
                onClick={() => router.push(`/onsite/${activeSession.id}`)}
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-extrabold text-sm truncate">{activeSession.site_name}</p>
                  <p className="text-emerald-100 text-xs">
                    {activeSession.status === "open"
                      ? "รอ Leader กด Check-in"
                      : `Check-in ${fmtTime(activeSession.group_check_in)} · กำลังทำงาน`}
                  </p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5 flex-shrink-0">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            )}

            {/* ── Section: ประวัติ ────────────────────────────────────────── */}
            {historySessions.length > 0 && (
              <section>
                <h2 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider mb-3">
                  ประวัติ
                </h2>
                <div className="space-y-3">
                  {historySessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      currentUserId={currentUserId ?? ""}
                      isToday={false}
                      onClick={() => router.push(`/onsite/${s.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Empty state ทั้งหมด ─────────────────────────────────────── */}
            {sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-sky-50 rounded-3xl flex items-center justify-center mb-5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-sky-400">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <h3 className="text-base font-extrabold text-gray-700 mb-1">ยังไม่เคยทำ On-site</h3>
                <p className="text-sm text-gray-400 mb-6 max-w-xs">
                  กด "สร้างห้อง" เพื่อเริ่ม Check-in งานนอกสถานที่พร้อมทีม
                </p>
                <button
                  onClick={() => router.push("/onsite/create")}
                  className="bg-sky-500 hover:bg-sky-600 text-white font-bold px-6 py-3 rounded-2xl text-sm transition-colors shadow-lg shadow-sky-200"
                >
                  + สร้างห้อง On-site แรก
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}