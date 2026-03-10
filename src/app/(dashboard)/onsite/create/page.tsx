// src/app/(dashboard)/onsite/create/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createOnsiteSession } from "@/app/actions/onsite";
import type { MemberProfile, CreateSessionInput } from "@/types/onsite";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const getFullName = (p: MemberProfile) =>
  [p.first_name, p.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";

const getInitials = (p: MemberProfile) =>
  ((p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")).toUpperCase() || "?";

const AVATAR_COLORS = [
  "bg-sky-500","bg-violet-500","bg-emerald-500","bg-amber-500",
  "bg-rose-500","bg-indigo-500","bg-teal-500","bg-orange-500",
];
const avatarColor = (id: string) =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

// ─── Types ─────────────────────────────────────────────────────────────────────
interface EndUser { id: string; name: string; }
interface Project { id: string; project_no: string; name: string | null; end_user_id: string; }

// ─── Member Row ────────────────────────────────────────────────────────────────
function MemberRow({
  profile,
  selected,
  onToggle,
}: {
  profile: MemberProfile;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(profile.id)}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
        selected ? "bg-sky-50" : "hover:bg-gray-50"
      }`}
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={getFullName(profile)}
          referrerPolicy="no-referrer"
          className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <span
          className={`w-9 h-9 rounded-xl ${avatarColor(profile.id)} text-white text-sm font-bold flex items-center justify-center flex-shrink-0`}
        >
          {getInitials(profile)}
        </span>
      )}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold text-gray-800 truncate">{getFullName(profile)}</p>
        <p className="text-xs text-gray-400 truncate">{profile.department || "ไม่ระบุแผนก"}</p>
      </div>
      <span
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          selected ? "bg-sky-500 border-sky-500" : "border-gray-300"
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

  // ── Project / EndUser state ──────────────────────────────────────────────────
  const [endUsers, setEndUsers]     = useState<EndUser[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [endUserId, setEndUserId]   = useState("");
  const [projectId, setProjectId]   = useState("");
  const [customEndUserName, setCustomEndUserName] = useState("");
  const [customProjectNo, setCustomProjectNo]     = useState("");

  const OTHER_EU_VALUE = "__other__";
  const isOtherEndUser = endUserId === OTHER_EU_VALUE;

  // ── Member state ─────────────────────────────────────────────────────────────
  const [search, setSearch]             = useState("");
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [employees, setEmployees]       = useState<MemberProfile[]>([]);
  const [loadingEmps, setLoadingEmps]   = useState(true);
  const [loadingMaster, setLoadingMaster] = useState(true);

  // ── Submission state ─────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [step, setStep]                 = useState<"form" | "success">("form");
  const [sessionCode, setSessionCode]   = useState("");
  const [createdSessionId, setCreatedSessionId] = useState("");

  // ─── โหลด Master data (EndUsers + Projects) ──────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingMaster(true);
      const [uRes, pRes] = await Promise.all([
        supabase.from("end_users").select("id, name").order("name"),
        supabase.from("projects").select("id, project_no, name, end_user_id").order("project_no"),
      ]);
      if (uRes.data) setEndUsers(uRes.data);
      if (pRes.data) setProjects(pRes.data);
      setLoadingMaster(false);
    })();
  }, []);

  // ─── โหลด Employees ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadEmployees = async () => {
      setLoadingEmps(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error: err } = await supabase
        .from("profiles_with_avatar")
        .select("id, first_name, last_name, department, role, avatar_url")
        .neq("id", user?.id ?? "")
        .order("first_name", { ascending: true });

      if (err) {
        setError("โหลดรายชื่อพนักงานไม่สำเร็จ: " + err.message);
      } else {
        setEmployees((data as MemberProfile[]) ?? []);
      }
      setLoadingEmps(false);
    };
    loadEmployees();
  }, []);

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const filteredProjects = useMemo(
    () => (endUserId ? projects.filter((p) => p.end_user_id === endUserId) : projects),
    [projects, endUserId]
  );

  const filteredEmps = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        getFullName(e).toLowerCase().includes(q) ||
        (e.department ?? "").toLowerCase().includes(q)
    );
  }, [employees, search]);

  const toggle = (uid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  // ─── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isOtherEndUser) {
  if (!customEndUserName.trim()) { setError("กรุณากรอกชื่อ End User"); return; }
  if (!customProjectNo.trim())   { setError("กรุณากรอก Project No."); return; }
} else if (!projectId) {
  setError("กรุณาเลือกโปรเจกต์");
  return;
}
    if (selectedIds.size === 0) {
      setError("กรุณาเลือกสมาชิกอย่างน้อย 1 คน");
      return;
    }

    // สร้าง site_name อัตโนมัติจาก EndUser + Project No.
    const selectedEndUser = endUsers.find((u) => u.id === endUserId);
    const selectedProject = projects.find((p) => p.id === projectId);
    const siteName = isOtherEndUser
  ? `${customEndUserName.trim()} · #${customProjectNo.trim()}`
  : [selectedEndUser?.name, selectedProject ? `#${selectedProject.project_no}` : null]
      .filter(Boolean).join(" · ");

    setError(null);
    setIsSubmitting(true);

    try {
      const input: CreateSessionInput = {
  site_name:  siteName,
  project_id: isOtherEndUser ? null : projectId,
  member_ids: Array.from(selectedIds),
};

      const res = await createOnsiteSession(input);

      if (res.success && res.data) {
        setSessionCode(res.data.session_code ?? "");
        setCreatedSessionId(res.data.session_id);
        setStep("success");
      } else {
        setError(res.error ?? "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด: " + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
  (isOtherEndUser
    ? customEndUserName.trim().length > 0 && customProjectNo.trim().length > 0
    : !!projectId) &&
  selectedIds.size > 0 &&
  !isSubmitting;

  // ─── Success Screen ───────────────────────────────────────────────────────────
  if (step === "success") {
    const selectedProject = projects.find((p) => p.id === projectId);
    const selectedEndUser = endUsers.find((u) => u.id === endUserId);
    const displaySite = isOtherEndUser
  ? `${customEndUserName} · #${customProjectNo}`
  : [selectedEndUser?.name, selectedProject ? `#${selectedProject.project_no}` : null]
      .filter(Boolean).join(" · ");

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
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="truncate font-medium">{displaySite}</span>
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

  // ─── Form Screen ──────────────────────────────────────────────────────────────
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
          <p className="text-xs text-gray-400">เลือกโปรเจกต์และสมาชิกทีม</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-52 md:pb-36">

        {/* ── EndUser + Project ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            รายละเอียด On-site <span className="text-rose-400">*</span>
          </label>

          {loadingMaster ? (
            <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <>
              {/* End User */}
              <div className="relative">
                <select
                  value={endUserId}
                  onChange={(e) => {
  setEndUserId(e.target.value);
  setProjectId("");
  setCustomProjectNo("");
  setCustomEndUserName("");
  setError(null);
}}
                  className="w-full appearance-none px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition pr-9"
                >
                  <option value="">Select End User...</option>
                  {endUsers.map((u) => (
    <option key={u.id} value={u.id}>{u.name}</option>
  ))}
  <option value="__other__">Other</option>
</select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </span>
              </div>

              {/* Custom End User Name (แสดงเฉพาะตอนเลือก Other) */}
{isOtherEndUser && (
  <input
    type="text"
    value={customEndUserName}
    onChange={(e) => { setCustomEndUserName(e.target.value); setError(null); }}
    placeholder="กรอกชื่อ End User"
    className="w-full px-4 py-3 bg-gray-50 border border-sky-300 rounded-xl text-sm font-medium text-gray-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition placeholder-gray-400"
  />
)}

{/* Project No. */}
{isOtherEndUser ? (
  <input
    type="text"
    value={customProjectNo}
    onChange={(e) => { setCustomProjectNo(e.target.value); setError(null); }}
    placeholder="กรอก Project No. (เช่น H1-0551)"
    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition placeholder-gray-400"
  />
) : (
  <div className="relative">
    <select
      value={projectId}
      onChange={(e) => { setProjectId(e.target.value); setError(null); }}
      disabled={!endUserId || filteredProjects.length === 0}
      className="w-full appearance-none px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition pr-9 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">Select Project No....</option>
      {filteredProjects.map((p) => (
        <option key={p.id} value={p.id}>
          #{p.project_no}{p.name ? ` — ${p.name}` : ""}
        </option>
      ))}
    </select>
    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </span>
  </div>
)}

              {/* Preview badge */}
              {projectId && (
                <div className="flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-100 rounded-xl">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-sky-500 flex-shrink-0">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span className="text-xs font-semibold text-sky-700 truncate">
                    {[endUsers.find((u) => u.id === endUserId)?.name, `#${projects.find((p) => p.id === projectId)?.project_no}`]
                      .filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── เลือก Members ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-gray-50">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                สมาชิกทีม <span className="text-rose-400">*</span>
              </label>
              {selectedIds.size > 0 && (
                <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                  {selectedIds.size} คนที่เลือก
                </span>
              )}
            </div>
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อหรือแผนก..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
              />
            </div>
          </div>

          {loadingEmps ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400 animate-pulse">โหลดรายชื่อ...</div>
          ) : filteredEmps.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">ไม่พบพนักงาน</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {filteredEmps.map((emp) => (
                <MemberRow
                  key={emp.id}
                  profile={emp}
                  selected={selectedIds.has(emp.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600 font-medium">
            {error}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-20 md:bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-4 py-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span>
            โปรเจกต์:{" "}
            <strong className={projectId ? "text-sky-600" : "text-gray-400"}>
              {projectId ? projects.find((p) => p.id === projectId)?.project_no ?? "—" : "ยังไม่เลือก"}
            </strong>
          </span>
          <span>
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

        {!canSubmit && !isSubmitting && (
          <p className="text-center text-xs text-gray-400">
            {!projectId && selectedIds.size === 0
              ? "เลือกโปรเจกต์ และ สมาชิก ก่อนสร้างห้อง"
              : !projectId
              ? "กรุณาเลือกโปรเจกต์"
              : "กรุณาเลือกสมาชิกอย่างน้อย 1 คน"}
          </p>
        )}
      </div>
    </div>
  );
}