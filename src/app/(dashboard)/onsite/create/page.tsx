"use client";

// ============================================================
// app/(dashboard)/onsite/create/page.tsx
// หน้าสร้าง On-site Session (สำหรับ Leader)
// ============================================================

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createOnsiteSession, getAllEmployees } from "@/app/actions/onsite";
import type { MemberProfile, CreateSessionInput } from "@/types/onsite";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getFullName = (p: MemberProfile) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";

const getInitials = (p: MemberProfile) => {
  const name = getFullName(p);
  return name !== "ไม่ระบุชื่อ"
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
};

const AVATAR_COLORS = [
  "bg-sky-500", "bg-violet-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-indigo-500",
];
const avatarColor = (uid: string) =>
  AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length];

// ─── Sub-components ────────────────────────────────────────────────────────────

function MemberChip({
  profile,
  onRemove,
}: {
  profile: MemberProfile;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-1.5 text-sm">
      <span
        className={`w-6 h-6 rounded-lg ${avatarColor(profile.id)} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}
      >
        {getInitials(profile)}
      </span>
      <span className="font-medium text-sky-800 max-w-[100px] truncate">
        {getFullName(profile)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="text-sky-400 hover:text-rose-500 transition-colors ml-0.5"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function EmployeeRow({
  profile,
  selected,
  onToggle,
}: {
  profile: MemberProfile;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
        selected ? "bg-sky-50" : "hover:bg-gray-50"
      }`}
    >
      <span
        className={`w-9 h-9 rounded-xl ${avatarColor(profile.id)} text-white text-sm font-bold flex items-center justify-center flex-shrink-0`}
      >
        {getInitials(profile)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{getFullName(profile)}</p>
        <p className="text-xs text-gray-400 truncate">{profile.department || "ไม่ระบุแผนก"}</p>
      </div>
      {/* Checkbox */}
      <span
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          selected
            ? "bg-sky-500 border-sky-500"
            : "border-gray-300"
        }`}
      >
        {selected && (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CreateOnsiteSessionPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Form state
  const [siteName, setSiteName]   = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);  // TODO: เพิ่ม project picker
  const [search, setSearch]       = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Data
  const [employees, setEmployees]   = useState<MemberProfile[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);

  // Error / Result
  const [error, setError]     = useState<string | null>(null);
  const [step, setStep]       = useState<"form" | "success">("form");
  const [sessionCode, setSessionCode] = useState("");

  // ─── Load employees ────────────────────────────────────────
  useEffect(() => {
    getAllEmployees().then((res) => {
      if (res.success) setEmployees(res.data);
      setLoadingEmps(false);
    });
  }, []);

  const filteredEmps = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        getFullName(e).toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q)
    );
  }, [employees, search]);

  const selectedProfiles = useMemo(
    () => employees.filter((e) => selectedIds.has(e.id)),
    [employees, selectedIds]
  );

  // ─── Toggle ────────────────────────────────────────────────
  const toggle = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  // ─── Submit ────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!siteName.trim()) { setError("กรุณาระบุชื่อสถานที่"); return; }
    if (selectedIds.size === 0) { setError("กรุณาเลือกสมาชิกอย่างน้อย 1 คน"); return; }
    setError(null);

    const input: CreateSessionInput = {
      site_name:  siteName.trim(),
      project_id: projectId,
      member_ids: Array.from(selectedIds),
    };

    startTransition(async () => {
      const res = await createOnsiteSession(input);
      if (res.success && res.data) {
        setSessionCode(res.data.session_code);
        setStep("success");
      } else {
        setError(res.error ?? "เกิดข้อผิดพลาด");
      }
    });
  };

  // ─── Success Screen ────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-emerald-400 to-teal-500 px-6 pt-8 pb-6 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-8 h-8">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-white">สร้าง Session สำเร็จ!</h2>
            <p className="text-emerald-100 text-sm mt-1">ห้อง On-site พร้อมใช้งาน</p>
          </div>

          <div className="px-6 py-6 space-y-4">
            {/* Session Code */}
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1 font-medium">Session Code</p>
              <p className="text-3xl font-black tracking-[0.3em] text-gray-800">{sessionCode}</p>
              <p className="text-[10px] text-gray-400 mt-1">ใช้สำหรับเข้าร่วมด้วย Code (ในอนาคต)</p>
            </div>

            {/* Members count */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <span>สมาชิก <strong>{selectedIds.size + 1}</strong> คน (รวม Leader)</span>
            </div>

            {/* Site name */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="truncate">{siteName}</span>
            </div>

            {/* CTA */}
            <button
              onClick={() => router.push(`/onsite`)}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm"
            >
              ไปที่ห้อง On-site →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form Screen ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 className="text-base font-extrabold text-gray-800">สร้างห้อง On-site</h1>
          <p className="text-xs text-gray-400">เลือกสถานที่และสมาชิกทีม</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-32">

        {/* ── Section 1: ชื่อสถานที่ ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              สถานที่ทำงาน *
            </label>
          </div>
          <div className="px-4 pb-4">
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="เช่น โรงงาน Toyota สมุทรปราการ"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
            />
          </div>
        </div>

        {/* ── Section 2: เลือก Members ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-50">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                เลือกสมาชิก *
              </label>
              {selectedIds.size > 0 && (
                <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                  เลือก {selectedIds.size} คน
                </span>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ / แผนก..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
              />
            </div>
          </div>

          {/* Selected chips */}
          {selectedProfiles.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-50 flex flex-wrap gap-2">
              {selectedProfiles.map((p) => (
                <MemberChip key={p.id} profile={p} onRemove={() => toggle(p.id)} />
              ))}
            </div>
          )}

          {/* Employee list */}
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {loadingEmps ? (
              <div className="py-8 text-center text-sm text-gray-400 animate-pulse">
                กำลังโหลดรายชื่อพนักงาน...
              </div>
            ) : filteredEmps.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                ไม่พบพนักงานที่ค้นหา
              </div>
            ) : (
              filteredEmps.map((emp) => (
                <EmployeeRow
                  key={emp.id}
                  profile={emp}
                  selected={selectedIds.has(emp.id)}
                  onToggle={() => toggle(emp.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-rose-500 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm text-rose-700 font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* ── Bottom CTA ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 safe-area-pb">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500">
            สมาชิกทั้งหมด:{" "}
            <strong className="text-gray-800">{selectedIds.size + 1} คน</strong>{" "}
            (รวมคุณในฐานะ Leader)
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isPending || !siteName.trim() || selectedIds.size === 0}
          className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-4 rounded-2xl transition-colors text-sm flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              กำลังสร้างห้อง...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              สร้างห้อง On-site
            </>
          )}
        </button>
      </div>
    </div>
  );
}