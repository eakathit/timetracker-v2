"use client";

// src/app/(dashboard)/onsite/create/page.tsx

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";  // ✅ ใช้ browser client โดยตรง ไม่ใช่ Server Action
import { createOnsiteSession } from "@/app/actions/onsite";
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
function MemberChip({ profile, onRemove }: { profile: MemberProfile; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-1.5 text-sm">
      {/* ✅ แสดงรูป Google หรือ fallback initials */}
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={getFullName(profile)}
          referrerPolicy="no-referrer"
          className="w-6 h-6 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <span className={`w-6 h-6 rounded-lg ${avatarColor(profile.id)} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>
          {getInitials(profile)}
        </span>
      )}
      <span className="font-medium text-sky-800 max-w-[100px] truncate">{getFullName(profile)}</span>
      <button type="button" onClick={onRemove} className="text-sky-400 hover:text-rose-500 transition-colors ml-0.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

function EmployeeRow({ profile, selected, onToggle }: { profile: MemberProfile; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${selected ? "bg-sky-50" : "hover:bg-gray-50"}`}
    >
      {/* ✅ แสดงรูป Google หรือ fallback initials */}
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={getFullName(profile)}
          referrerPolicy="no-referrer"
          className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <span className={`w-9 h-9 rounded-xl ${avatarColor(profile.id)} text-white text-sm font-bold flex items-center justify-center flex-shrink-0`}>
          {getInitials(profile)}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{getFullName(profile)}</p>
        <p className="text-xs text-gray-400 truncate">{profile.department || "ไม่ระบุแผนก"}</p>
      </div>
      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        selected ? "bg-sky-500 border-sky-500" : "border-gray-300"
      }`}>
        {selected && (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </span>
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CreateOnsiteSessionPage() {
  const router = useRouter();

  const [siteName, setSiteName]           = useState("");
  const [search, setSearch]               = useState("");
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [employees, setEmployees]         = useState<MemberProfile[]>([]);
  const [loadingEmps, setLoadingEmps]     = useState(true);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [step, setStep]                   = useState<"form" | "success">("form");
  const [sessionCode, setSessionCode]     = useState("");
  const [createdSessionId, setCreatedSessionId] = useState("");

  // ─── โหลดรายชื่อพนักงานด้วย browser supabase โดยตรง ────────────────────────
  // ✅ ไม่ใช้ Server Action เพราะเป็นแค่ SELECT query ที่ทุกคน auth แล้วอ่านได้
  useEffect(() => {
    const loadEmployees = async () => {
      setLoadingEmps(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error: err } = await supabase
        .from("profiles_with_avatar")
        .select("id, first_name, last_name, department, role")
        .neq("id", user?.id ?? "")        // ไม่เอาตัวเอง (Leader ถูกเพิ่มใน action อัตโนมัติ)
        .order("first_name", { ascending: true });

      if (err) {
        console.error("[loadEmployees] error:", err);
        setError("โหลดรายชื่อพนักงานไม่สำเร็จ: " + err.message);
      } else {
        setEmployees((data as MemberProfile[]) ?? []);
      }
      setLoadingEmps(false);
    };

    loadEmployees();
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

  const toggle = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  // ✅ ใช้ async/await ตรงๆ ไม่ใช้ startTransition เพื่อให้ error ชัดเจน
  const handleSubmit = async () => {
    if (!siteName.trim()) {
      setError("กรุณาระบุชื่อสถานที่");
      return;
    }
    if (selectedIds.size === 0) {
      setError("กรุณาเลือกสมาชิกอย่างน้อย 1 คน");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const input: CreateSessionInput = {
        site_name:  siteName.trim(),
        project_id: null,
        member_ids: Array.from(selectedIds),
      };

      console.log("[CreatePage] calling createOnsiteSession:", input);
      const res = await createOnsiteSession(input);
      console.log("[CreatePage] result:", res);

      if (res.success && res.data) {
        setSessionCode(res.data.session_code);
        setCreatedSessionId(res.data.session_id);
        setStep("success");
      } else {
        setError(res.error ?? "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
      }
    } catch (err) {
      console.error("[CreatePage] unexpected error:", err);
      setError("เกิดข้อผิดพลาด: " + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success Screen ────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-br from-emerald-400 to-teal-500 px-6 pt-8 pb-6 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-8 h-8">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-white">สร้าง Session สำเร็จ!</h2>
            <p className="text-emerald-100 text-sm mt-1">ห้อง On-site พร้อมใช้งาน</p>
          </div>
          <div className="px-6 py-6 space-y-4">
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1 font-medium">Session Code</p>
              <p className="text-3xl font-black tracking-[0.3em] text-gray-800">{sessionCode}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <span>สมาชิก <strong>{selectedIds.size + 1}</strong> คน (รวม Leader)</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="truncate">{siteName}</span>
            </div>
            <button
              onClick={() => router.push(`/onsite/${createdSessionId}`)}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3.5 rounded-2xl transition-colors text-sm"
            >
              เข้าห้อง On-site →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form Screen ───────────────────────────────────────────────────────────
  const canSubmit = siteName.trim().length > 0 && selectedIds.size > 0 && !isSubmitting;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
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

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-36">

        {/* ── ชื่อสถานที่ ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">
            สถานที่ทำงาน <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => { setSiteName(e.target.value); setError(null); }}
            placeholder="เช่น โรงงาน Toyota สมุทรปราการ"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 placeholder-gray-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
          />
        </div>

        {/* ── เลือก Members ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-gray-50">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                เลือกสมาชิก <span className="text-rose-400">*</span>
              </label>
              {selectedIds.size > 0 && (
                <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
                  เลือก {selectedIds.size} คน
                </span>
              )}
            </div>
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ หรือ แผนก..."
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
          <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {loadingEmps ? (
              <div className="py-10 text-center">
                <div className="w-6 h-6 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-400">กำลังโหลด...</p>
              </div>
            ) : filteredEmps.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {search ? `ไม่พบ "${search}"` : "ไม่มีพนักงานในระบบ"}
              </div>
            ) : (
              filteredEmps.map((emp) => (
                <EmployeeRow
                  key={emp.id}
                  profile={emp}
                  selected={selectedIds.has(emp.id)}
                  onToggle={() => { toggle(emp.id); setError(null); }}
                />
              ))
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm text-rose-700 font-medium">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {/* Summary */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs text-gray-500">
            สถานที่:{" "}
            <strong className="text-gray-800">
              {siteName.trim() || <span className="text-gray-400 font-normal">ยังไม่ระบุ</span>}
            </strong>
          </span>
          <span className="text-xs text-gray-500">
            สมาชิก:{" "}
            <strong className={selectedIds.size > 0 ? "text-sky-600" : "text-gray-400"}>
              {selectedIds.size > 0 ? `${selectedIds.size + 1} คน` : "ยังไม่เลือก"}
            </strong>
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full font-bold py-4 rounded-2xl transition-all text-sm flex items-center justify-center gap-2 ${
            canSubmit
              ? "bg-sky-500 hover:bg-sky-600 active:scale-[0.98] text-white shadow-lg shadow-sky-200"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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

        {/* hint เมื่อ disabled */}
        {!canSubmit && !isSubmitting && (
          <p className="text-center text-xs text-gray-400 mt-2">
            {!siteName.trim() && selectedIds.size === 0
              ? "ระบุสถานที่ และ เลือกสมาชิก ก่อนสร้างห้อง"
              : !siteName.trim()
              ? "กรุณาระบุชื่อสถานที่"
              : "กรุณาเลือกสมาชิกอย่างน้อย 1 คน"}
          </p>
        )}
      </div>
    </div>
  );
}