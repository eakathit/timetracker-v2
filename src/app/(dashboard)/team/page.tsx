"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Project    { id: string; project_no: string; name: string | null; end_user_id: string }
interface EndUser    { id: string; name: string }
interface WorkDetail { id: string; title: string }
interface Profile    { id: string; first_name: string | null; last_name: string | null; department: string | null }

interface ReportRow {
  item_id:     string;
  report_date: string;   // "YYYY-MM-DD"
  user_id:     string;
  project_id:  string;
  end_user_id: string;
  detail_id:   string;
  period_label: string | null;
  period_start: string | null;
  period_end:   string | null;
  period_type:  string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const DAYS_TH = ["อา","จ","อ","พ","พฤ","ศ","ส"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end   = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`;
  return { start, end };
}

function fmtDateTH(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return {
    day:   d,
    month: MONTHS_TH[m - 1].slice(0, 3),
    dow:   DAYS_TH[dow],
    full:  `${d} ${MONTHS_TH[m - 1]} ${y + 543}`,
    isSun: dow === 0,
    isSat: dow === 6,
  };
}

function getFullName(p?: Profile) {
  if (!p) return "ไม่ระบุชื่อ";
  return `${p.first_name || ""} ${p.last_name || ""}`.trim() || "ไม่ระบุชื่อ";
}

function getPeriodLabel(row: ReportRow) {
  if (row.period_type === "some_time" && row.period_start && row.period_end)
    return `${row.period_start}–${row.period_end}`;
  const lbl = row.period_label ?? "";
  if (lbl.includes("ALL"))      return "ALL DAY";
  if (lbl.includes("HALF DAY")) return "HALF DAY";
  return lbl.split(" (")[0] || "–";
}

function getPeriodStyle(row: ReportRow) {
  if (row.period_type === "some_time")     return "bg-violet-50 text-violet-600 border-violet-200";
  if ((row.period_label ?? "").includes("ALL")) return "bg-emerald-50 text-emerald-600 border-emerald-200";
  return "bg-amber-50 text-amber-600 border-amber-200";
}

// ─── Export Excel ─────────────────────────────────────────────────────────────
async function exportExcel(
  rows: ReportRow[],
  maps: { project: Record<string, Project>; eu: Record<string, EndUser>; detail: Record<string, WorkDetail>; profile: Record<string, Profile> },
  year: number, month: number,
  projectFilter: string,
) {
  const { utils, writeFile } = await import("xlsx");
  const { project, eu, detail, profile } = maps;

  const selProj = projectFilter !== "all" ? project[projectFilter] : null;
  const title   = `PROJECT SUMMARY — ${MONTHS_TH[month]} ${year + 543}${selProj ? ` | Project #${selProj.project_no}` : ""}`;

  const header = [
    [title], [],
    ["วันที่", "วัน", "ชื่อพนักงาน", "แผนก", "End User", "Project No.", "ชื่อ Project", "ประเภทงาน", "ช่วงเวลา"],
  ];
  const data = rows.map((r) => {
    const { full, dow } = fmtDateTH(r.report_date);
    const pr = project[r.project_id];
    const p  = profile[r.user_id];
    return [
      full, dow, getFullName(p), p?.department || "–",
      eu[r.end_user_id]?.name || "–",
      pr?.project_no || "–", pr?.name || "–",
      detail[r.detail_id]?.title || "–",
      getPeriodLabel(r),
    ];
  });

  const ws = utils.aoa_to_sheet([...header, ...data]);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
  ws["!cols"]   = [22, 5, 18, 12, 14, 10, 20, 22, 18].map((w) => ({ wch: w }));

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, `${MONTHS_TH[month].slice(0, 3)}_${year + 543}`);
  writeFile(wb, `project_summary_${year}_${String(month + 1).padStart(2, "0")}.xlsx`);
}

// ─── Mini components ──────────────────────────────────────────────────────────
function StatCard({ value, label, sub, bg, icon }: {
  value: string | number; label: string; sub?: string; bg: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold text-gray-800 leading-none">{value}</p>
        <p className="text-[11px] text-gray-400 font-medium mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-gray-300 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-400">{message}</p>
      {sub && <p className="text-xs text-gray-300 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Employee Avatar chip ─────────────────────────────────────────────────────
function AvatarChip({ profile, showName = false }: { profile?: Profile; showName?: boolean }) {
  const name = getFullName(profile);
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
        {initial}
      </div>
      {showName && (
        <span className="text-xs font-semibold text-gray-600 max-w-[90px] truncate">{name}</span>
      )}
    </div>
  );
}

// ─── Project Badge ────────────────────────────────────────────────────────────
function ProjectBadge({ project }: { project?: Project }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-extrabold whitespace-nowrap">
      #{project?.project_no || "?"}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const today = new Date();

  // ── View state ──────────────────────────────────────────────────────────────
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewMode,  setViewMode]  = useState<"table" | "timeline">("table");

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [filterProject, setFilterProject] = useState("all");
  const [filterUser,    setFilterUser]    = useState("all");
  const [filterDetail,  setFilterDetail]  = useState("all");

  // ── Master data ──────────────────────────────────────────────────────────────
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [endUsers,  setEndUsers]  = useState<EndUser[]>([]);
  const [details,   setDetails]   = useState<WorkDetail[]>([]);
  const [profiles,  setProfiles]  = useState<Profile[]>([]);
  const [masterReady, setMasterReady] = useState(false);

  // ── Report rows ───────────────────────────────────────────────────────────────
  const [rows,       setRows]       = useState<ReportRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // ── Load master data once ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [pRes, uRes, dRes, prRes] = await Promise.all([
        supabase.from("projects").select("id, project_no, name, end_user_id").order("project_no"),
        supabase.from("end_users").select("id, name").order("name"),
        supabase.from("work_details").select("id, title").order("title"),
        supabase.from("profiles").select("id, first_name, last_name, department").order("first_name"),
      ]);
      if (pRes.data)  setProjects(pRes.data);
      if (uRes.data)  setEndUsers(uRes.data);
      if (dRes.data)  setDetails(dRes.data);
      if (prRes.data) setProfiles(prRes.data);
      setMasterReady(true);
    })();
  }, []);

  // ── Fetch report rows (re-runs when month or master data changes) ─────────────
  const fetchRows = useCallback(async () => {
    if (!masterReady) return;
    setLoadingRows(true);
    setError(null);

    const { start, end } = getMonthRange(viewYear, viewMonth);

    try {
      // Step 1: get report headers for the month
      const { data: reports, error: rErr } = await supabase
        .from("daily_reports")
        .select("id, user_id, report_date")
        .gte("report_date", start)
        .lte("report_date", end)
        .order("report_date");

      if (rErr) throw rErr;
      if (!reports || reports.length === 0) { setRows([]); return; }

      // Build lookup: report_id -> { user_id, report_date }
      const reportMeta: Record<string, { user_id: string; report_date: string }> = {};
      reports.forEach((r) => { reportMeta[r.id] = { user_id: r.user_id, report_date: r.report_date }; });

      // Step 2: get all items for those reports
      const reportIds = reports.map((r) => r.id);
      const { data: items, error: iErr } = await supabase
        .from("daily_report_items")
        .select("id, report_id, end_user_id, project_id, detail_id, period_type, period_label, period_start, period_end")
        .in("report_id", reportIds);

      if (iErr) throw iErr;
      if (!items) { setRows([]); return; }

      const mapped: ReportRow[] = items.map((item) => ({
        item_id:     String(item.id),
        report_date: reportMeta[item.report_id]?.report_date ?? "",
        user_id:     reportMeta[item.report_id]?.user_id ?? "",
        project_id:  item.project_id,
        end_user_id: item.end_user_id,
        detail_id:   item.detail_id,
        period_label: item.period_label ?? null,
        period_start: item.period_start ?? null,
        period_end:   item.period_end   ?? null,
        period_type:  item.period_type  ?? "fixed",
      }));

      setRows(mapped);
    } catch (err: any) {
      setError(err?.message ?? "เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setLoadingRows(false);
    }
  }, [masterReady, viewYear, viewMonth]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Lookup maps ───────────────────────────────────────────────────────────────
  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const euMap      = useMemo(() => Object.fromEntries(endUsers.map((u) => [u.id, u])),  [endUsers]);
  const detailMap  = useMemo(() => Object.fromEntries(details.map((d)  => [d.id, d])),  [details]);
  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])),  [profiles]);

  // ── Filtered rows ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows
      .filter((r) => filterProject === "all" || r.project_id === filterProject)
      .filter((r) => filterUser    === "all" || r.user_id    === filterUser)
      .filter((r) => filterDetail  === "all" || r.detail_id  === filterDetail)
      .sort((a, b) => a.report_date.localeCompare(b.report_date) || a.user_id.localeCompare(b.user_id));
  }, [rows, filterProject, filterUser, filterDetail]);

  // ── Timeline grouping ──────────────────────────────────────────────────────────
  const timelineGroups = useMemo(() => {
    const map: Record<string, ReportRow[]> = {};
    filtered.forEach((r) => {
      (map[r.report_date] ??= []).push(r);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // ── Stats ──────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const uniqueDates    = new Set(filtered.map((r) => r.report_date)).size;
    const uniqueUsers    = new Set(filtered.map((r) => r.user_id)).size;
    const uniqueProjects = new Set(filtered.map((r) => r.project_id)).size;

    // project breakdown sorted by count desc
    const projBreak: Record<string, { count: number; users: Set<string>; dates: Set<string> }> = {};
    filtered.forEach((r) => {
      if (!projBreak[r.project_id]) projBreak[r.project_id] = { count: 0, users: new Set(), dates: new Set() };
      projBreak[r.project_id].count++;
      projBreak[r.project_id].users.add(r.user_id);
      projBreak[r.project_id].dates.add(r.report_date);
    });
    const projBreakSorted = Object.entries(projBreak)
      .sort(([, a], [, b]) => b.count - a.count);

    return { total: filtered.length, uniqueDates, uniqueUsers, uniqueProjects, projBreakSorted };
  }, [filtered]);

  // ── Month navigation ──────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (filtered.length === 0) return;
    setExporting(true);
    try {
      await exportExcel(filtered, { project: projectMap, eu: euMap, detail: detailMap, profile: profileMap }, viewYear, viewMonth, filterProject);
    } finally {
      setExporting(false);
    }
  };

  // ── Reset filters ─────────────────────────────────────────────────────────────
  const resetFilters = () => { setFilterProject("all"); setFilterUser("all"); setFilterDetail("all"); };
  const hasFilter = filterProject !== "all" || filterUser !== "all" || filterDetail !== "all";

  // ── Loading screen ────────────────────────────────────────────────────────────
  if (!masterReady) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
        </div>
      </main>
    );
  }

  const todayStr = today.toISOString().split("T")[0];

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ═══════════════════════════════════════════════
          STICKY HEADER
      ═══════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">

        {/* Title row */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-1 gap-3">
          <div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Admin · Management</p>
            <h1 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
              Project Summary
              {loadingRows && (
                <span className="w-3.5 h-3.5 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setViewMode("table")}
                title="Table view"
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  viewMode === "table" ? "bg-white shadow-sm text-sky-500" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
              </button>
              <button
                onClick={() => setViewMode("timeline")}
                title="Timeline view"
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  viewMode === "timeline" ? "bg-white shadow-sm text-sky-500" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={exporting || filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-sm"
            >
              {exporting ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export Excel"}</span>
            </button>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-4 md:px-6 py-2.5">
          <button onClick={prevMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="text-center">
            <h2 className="text-base font-extrabold text-gray-800">{MONTHS_TH[viewMonth]} {viewYear + 543}</h2>
            <p className="text-xs text-gray-400">
              {loadingRows ? "กำลังโหลด…" : `${stats.total} รายการ · ${stats.uniqueDates} วัน · ${stats.uniqueUsers} คน`}
            </p>
          </div>
          <button onClick={nextMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          CONTENT
      ═══════════════════════════════════════════════ */}
      <div className="px-4 md:px-6 pt-4 space-y-4">

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-600 font-semibold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
            <button onClick={fetchRows} className="ml-auto text-rose-700 hover:underline text-xs font-bold">ลองใหม่</button>
          </div>
        )}

        {/* ── Filter Panel ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ตัวกรอง</p>
            {hasFilter && (
              <button onClick={resetFilters} className="text-xs text-gray-400 hover:text-rose-500 font-semibold transition-colors">
                ล้างทั้งหมด
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Project */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Project</label>
              <div className="relative">
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className={`w-full appearance-none px-3 py-2.5 pr-8 text-sm rounded-xl border outline-none cursor-pointer transition-all
                    ${filterProject !== "all"
                      ? "border-sky-300 bg-sky-50 text-sky-700 focus:ring-2 focus:ring-sky-100"
                      : "border-gray-200 bg-gray-50 text-gray-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
                    }`}
                >
                  <option value="all">ทุก Project ({projects.length})</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.project_no}{p.name ? ` · ${p.name}` : ""}{euMap[p.end_user_id] ? ` (${euMap[p.end_user_id].name})` : ""}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </div>
            </div>

            {/* Employee */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">พนักงาน</label>
              <div className="relative">
                <select
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  className={`w-full appearance-none px-3 py-2.5 pr-8 text-sm rounded-xl border outline-none cursor-pointer transition-all
                    ${filterUser !== "all"
                      ? "border-violet-300 bg-violet-50 text-violet-700 focus:ring-2 focus:ring-violet-100"
                      : "border-gray-200 bg-gray-50 text-gray-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
                    }`}
                >
                  <option value="all">ทุกคน ({profiles.length})</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getFullName(p)}{p.department ? ` · ${p.department}` : ""}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </div>
            </div>

            {/* Work Detail */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ประเภทงาน</label>
              <div className="relative">
                <select
                  value={filterDetail}
                  onChange={(e) => setFilterDetail(e.target.value)}
                  className={`w-full appearance-none px-3 py-2.5 pr-8 text-sm rounded-xl border outline-none cursor-pointer transition-all
                    ${filterDetail !== "all"
                      ? "border-amber-300 bg-amber-50 text-amber-700 focus:ring-2 focus:ring-amber-100"
                      : "border-gray-200 bg-gray-50 text-gray-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
                    }`}
                >
                  <option value="all">ทุกประเภท ({details.length})</option>
                  {details.map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {hasFilter && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
              {filterProject !== "all" && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-bold">
                  #{projectMap[filterProject]?.project_no}
                  <button onClick={() => setFilterProject("all")} className="hover:text-sky-900">✕</button>
                </span>
              )}
              {filterUser !== "all" && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-[11px] font-bold">
                  {getFullName(profileMap[filterUser])}
                  <button onClick={() => setFilterUser("all")} className="hover:text-violet-900">✕</button>
                </span>
              )}
              {filterDetail !== "all" && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">
                  {detailMap[filterDetail]?.title}
                  <button onClick={() => setFilterDetail("all")} className="hover:text-amber-900">✕</button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard value={stats.total}          label="รายการทั้งหมด"  bg="bg-sky-50"     icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-sky-500"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />
          <StatCard value={stats.uniqueDates}    label="วันที่กรอก Report" bg="bg-emerald-50" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-emerald-500"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
          <StatCard value={stats.uniqueUsers}    label="จำนวนพนักงาน"  bg="bg-violet-50"  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-violet-500"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} />
          <StatCard value={stats.uniqueProjects} label="จำนวน Project"  bg="bg-amber-50"   icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-amber-500"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>} />
        </div>

        {/* ── Empty / Loading ── */}
        {loadingRows && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {!loadingRows && filtered.length === 0 && (
          <EmptyState
            message="ไม่พบข้อมูล Daily Report"
            sub={hasFilter ? "ลองเปลี่ยนตัวกรอง หรือล้างตัวกรองทั้งหมด" : "ไม่มีข้อมูลในเดือนนี้"}
          />
        )}

        {/* ═══════════════════════════════════════════════════
            TABLE VIEW
        ═══════════════════════════════════════════════════ */}
        {!loadingRows && filtered.length > 0 && viewMode === "table" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["วันที่", "พนักงาน", "End User", "Project", "ประเภทงาน", "ช่วงเวลา"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest whitespace-nowrap first:pl-5">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => {
                    const proj    = projectMap[row.project_id];
                    const eu      = euMap[row.end_user_id];
                    const detail  = detailMap[row.detail_id];
                    const profile = profileMap[row.user_id];
                    const { day, month, dow, isSun, isSat } = fmtDateTH(row.report_date);
                    const isToday = row.report_date === todayStr;

                    return (
                      <tr
                        key={row.item_id}
                        className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors ${isSun || isSat ? "bg-gray-50/30" : ""}`}
                      >
                        {/* Date */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border ${
                              isToday ? "bg-sky-500 border-sky-400" : "bg-white border-gray-100 shadow-sm"
                            }`}>
                              <span className={`text-sm font-extrabold leading-none ${isToday ? "text-white" : isSun ? "text-rose-500" : isSat ? "text-sky-500" : "text-gray-800"}`}>{day}</span>
                              <span className={`text-[8px] font-bold mt-0.5 ${isToday ? "text-sky-100" : "text-gray-400"}`}>{month}</span>
                            </div>
                            <span className={`text-[10px] font-bold ${isSun ? "text-rose-400" : isSat ? "text-sky-400" : "text-gray-400"}`}>{dow}</span>
                          </div>
                        </td>

                        {/* Employee */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <AvatarChip profile={profile} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate max-w-[110px]">{getFullName(profile)}</p>
                              <p className="text-[10px] text-gray-400 truncate">{profile?.department || "–"}</p>
                            </div>
                          </div>
                        </td>

                        {/* End User */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs font-semibold text-gray-700">{eu?.name || "–"}</span>
                        </td>

                        {/* Project */}
                        <td className="px-4 py-3">
                          <ProjectBadge project={proj} />
                          {proj?.name && (
                            <p className="text-[10px] text-gray-400 mt-0.5 max-w-[100px] truncate">{proj.name}</p>
                          )}
                        </td>

                        {/* Detail */}
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="text-xs font-semibold text-gray-700 line-clamp-2">{detail?.title || "–"}</span>
                        </td>

                        {/* Period */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${getPeriodStyle(row)}`}>
                            {getPeriodLabel(row)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-gray-50">
              {filtered.map((row) => {
                const proj    = projectMap[row.project_id];
                const eu      = euMap[row.end_user_id];
                const detail  = detailMap[row.detail_id];
                const profile = profileMap[row.user_id];
                const { day, month, dow, isSun, isSat } = fmtDateTH(row.report_date);
                const isToday = row.report_date === todayStr;

                return (
                  <div key={row.item_id} className="flex gap-3 px-4 py-3.5">
                    <div className={`w-10 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border ${isToday ? "bg-sky-500 border-sky-400" : "bg-white border-gray-100 shadow-sm"}`}>
                      <span className={`text-base font-extrabold leading-none ${isToday ? "text-white" : isSun ? "text-rose-500" : isSat ? "text-sky-500" : "text-gray-800"}`}>{day}</span>
                      <span className={`text-[8px] font-bold mt-0.5 ${isToday ? "text-sky-100" : "text-gray-400"}`}>{month}</span>
                      <span className={`text-[8px] mt-0.5 ${isSun ? "text-rose-400" : isSat ? "text-sky-400" : "text-gray-300"}`}>{dow}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <ProjectBadge project={proj} />
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPeriodStyle(row)}`}>
                          {getPeriodLabel(row)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{detail?.title || "–"}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{eu?.name || "–"}{proj?.name ? ` · ${proj.name}` : ""}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <AvatarChip profile={profile} showName />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50/50 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-medium">แสดง {filtered.length} รายการ</p>
              <button onClick={handleExport} disabled={exporting} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors disabled:opacity-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Excel
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════
            TIMELINE VIEW
        ═══════════════════════════════════════════════════ */}
        {!loadingRows && filtered.length > 0 && viewMode === "timeline" && (
          <div className="space-y-5">
            {timelineGroups.map(([dateStr, dayRows]) => {
              const { day, month, dow, full, isSun, isSat } = fmtDateTH(dateStr);
              const isToday = dateStr === todayStr;
              const uniqueUsersInDay = new Set(dayRows.map((r) => r.user_id)).size;

              return (
                <div key={dateStr}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className={`w-13 h-13 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm border-2 ${
                      isToday
                        ? "bg-sky-500 border-sky-400"
                        : isSun
                        ? "bg-rose-50 border-rose-200"
                        : isSat
                        ? "bg-sky-50 border-sky-200"
                        : "bg-white border-gray-200"
                    }`} style={{ width: 52, height: 52 }}>
                      <span className={`text-xl font-extrabold leading-none ${isToday ? "text-white" : isSun ? "text-rose-500" : isSat ? "text-sky-500" : "text-gray-800"}`}>{day}</span>
                      <span className={`text-[9px] font-bold mt-0.5 ${isToday ? "text-sky-100" : "text-gray-400"}`}>{month}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-extrabold leading-tight ${isToday ? "text-sky-600" : isSun ? "text-rose-600" : "text-gray-800"}`}>
                        {full}
                        {isToday && <span className="ml-2 text-[10px] bg-sky-500 text-white px-1.5 py-0.5 rounded-full font-bold">วันนี้</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {dayRows.length} รายการ · {uniqueUsersInDay} คน
                      </p>
                    </div>
                    {/* Day pill summary */}
                    <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                      {Array.from(new Set(dayRows.map((r) => r.user_id))).slice(0, 4).map((uid) => (
                        <AvatarChip key={uid} profile={profileMap[uid]} />
                      ))}
                      {new Set(dayRows.map((r) => r.user_id)).size > 4 && (
                        <span className="text-[10px] text-gray-400 font-bold">+{new Set(dayRows.map((r) => r.user_id)).size - 4}</span>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="pl-16 space-y-2">
                    {/* Group by user within day */}
                    {(() => {
                      const byUser: Record<string, ReportRow[]> = {};
                      dayRows.forEach((r) => { (byUser[r.user_id] ??= []).push(r); });
                      return Object.entries(byUser).map(([uid, userRows]) => {
                        const profile = profileMap[uid];
                        return (
                          <div key={uid} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            {/* Employee sub-header */}
                            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50/60 border-b border-gray-100">
                              <AvatarChip profile={profile} showName />
                              {profile?.department && (
                                <span className="text-[10px] text-gray-400 font-medium ml-1">· {profile.department}</span>
                              )}
                              <span className="ml-auto text-[10px] font-bold text-gray-400">{userRows.length} รายการ</span>
                            </div>
                            {/* Work items */}
                            <div className="divide-y divide-gray-50">
                              {userRows.map((row) => {
                                const proj   = projectMap[row.project_id];
                                const eu     = euMap[row.end_user_id];
                                const detail = detailMap[row.detail_id];
                                return (
                                  <div key={row.item_id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                                    <div className="w-1 self-stretch rounded-full flex-shrink-0 bg-sky-300 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <ProjectBadge project={proj} />
                                        {eu?.name && (
                                          <span className="text-[10px] text-gray-500 font-semibold">{eu.name}</span>
                                        )}
                                        <span className={`ml-auto flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPeriodStyle(row)}`}>
                                          {getPeriodLabel(row)}
                                        </span>
                                      </div>
                                      <p className="text-sm font-semibold text-gray-800 mt-1 leading-snug">{detail?.title || "–"}</p>
                                      {proj?.name && (
                                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{proj.name}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Project Breakdown ── */}
        {!loadingRows && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                    <line x1="2" y1="20" x2="22" y2="20"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-700">สรุปตาม Project</h3>
                  <p className="text-xs text-gray-400">{stats.uniqueProjects} Projects ที่ทำงานในเดือนนี้</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {stats.projBreakSorted.map(([projId, data]) => {
                const proj = projectMap[projId];
                const eu   = euMap[proj?.end_user_id ?? ""];
                const pct  = stats.total > 0 ? Math.round((data.count / stats.total) * 100) : 0;

                return (
                  <div key={projId} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex-shrink-0 min-w-[56px]">
                      <span className="block px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-xs font-extrabold text-center">
                        #{proj?.project_no || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {proj?.name || "ไม่ระบุชื่อ"}
                          {eu && <span className="text-gray-400 font-normal text-xs"> · {eu.name}</span>}
                        </p>
                        <span className="text-xs font-extrabold text-sky-600 flex-shrink-0 ml-3">{data.count} รายการ</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-gray-400">{data.dates.size} วัน</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-[10px] text-gray-400">{data.users.size} คน</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-[10px] text-gray-400 font-semibold">{pct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}