"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
type OTStatus = "pending" | "approved" | "rejected";

interface OTRequest {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  project: string;
  projectNo: string;
  reason: string;
  status: OTStatus;
  submittedAt: string;
  approvedBy?: string;
  rejectReason?: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: "national" | "company" | "special" | "working_sat";
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS_TH = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน",
  "พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม",
  "กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];
const MONTHS_SHORT = [
  "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];
const DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];

const STATUS_CONFIG: Record<OTStatus, {
  label: string; bg: string; text: string; border: string; dot: string; lightBg: string; ring: string;
}> = {
  pending:  { label:"รอพิจารณา",  bg:"bg-amber-500",   text:"text-amber-700",   border:"border-amber-200",   dot:"bg-amber-400",   lightBg:"bg-amber-50/70",   ring:"ring-amber-400" },
  approved: { label:"อนุมัติแล้ว",bg:"bg-emerald-500", text:"text-emerald-700", border:"border-emerald-200", dot:"bg-emerald-400", lightBg:"bg-emerald-50/70", ring:"ring-emerald-400" },
  rejected: { label:"ไม่อนุมัติ", bg:"bg-rose-500",    text:"text-rose-700",    border:"border-rose-200",    dot:"bg-rose-400",    lightBg:"bg-rose-50/70",    ring:"ring-rose-400" },
};

const HOLIDAY_TYPE_CONFIG = {
  national:    { color:"bg-rose-100 text-rose-600 border-rose-200" },
  company:     { color:"bg-orange-100 text-orange-600 border-orange-200" },
  special:     { color:"bg-purple-100 text-purple-600 border-purple-200" },
  working_sat: { color:"bg-sky-100 text-sky-600 border-sky-200" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};
const parseDate = (s: string) => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()+543} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} น.`;
};

// ─── OT Day Panel ─────────────────────────────────────────────────────────────
function OTDayPanel({ date, otRequests, holidays, onClose }: {
  date: Date; otRequests: OTRequest[]; holidays: Holiday[]; onClose: () => void;
}) {
  const dateStr = fmt(date);
  const dayOTs = otRequests.filter(r => r.date === dateStr);
  const dayHolidays = holidays.filter(h => h.date === dateStr);
  const totalDayHours = dayOTs.reduce((acc, r) => acc + r.hours, 0);
  const thDay = ["วันอาทิตย์","วันจันทร์","วันอังคาร","วันพุธ","วันพฤหัสบดี","วันศุกร์","วันเสาร์"];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity" onClick={onClose} />
      <div className="relative w-full md:w-[480px] max-h-[85vh] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:fade-in duration-200 border border-gray-100">

        {/* Mobile handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-gray-200" />
        </div>

        {/* Panel Header */}
        <div className="flex items-start justify-between px-5 pt-3 pb-3 flex-shrink-0 border-b border-gray-100 bg-gray-50/50">
          <div>
            <p className="text-xs text-amber-600 font-bold uppercase tracking-wide">{thDay[date.getDay()]}</p>
            <h2 className="text-2xl font-extrabold text-gray-800 leading-tight">
              {date.getDate()} {MONTHS_TH[date.getMonth()]}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">พ.ศ. {date.getFullYear()+543}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors mt-0.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Holiday Tag */}
          {dayHolidays.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">วันหยุด / เสาร์ทำงาน</p>
              {dayHolidays.map(h => (
                <div key={h.id} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm font-semibold ${HOLIDAY_TYPE_CONFIG[h.type].color}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                    <circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/>
                  </svg>
                  <span>{h.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* OT Requests List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                รายการขอ OT ({dayOTs.length} คน)
              </p>
              {dayOTs.length > 0 && (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  รวม {totalDayHours} ชม.
                </span>
              )}
            </div>

            {dayOTs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center mb-2.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-gray-300">
                    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
                  </svg>
                </div>
                <p className="text-sm font-bold text-gray-600">ไม่มีรายการ OT</p>
                <p className="text-xs text-gray-400 mt-0.5">ไม่มีพนักงานขอ OT ในวันนี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dayOTs.map(ot => {
                  const st = STATUS_CONFIG[ot.status] || STATUS_CONFIG.pending;
                  return (
                    <div
                      key={ot.id}
                      className={`bg-white rounded-2xl border ${st.border} shadow-xs overflow-hidden transition-all hover:shadow-md`}
                    >
                      {/* Card Header: Profile, Name, Status & Hours */}
                      <div className={`px-4 py-3 border-b ${st.border} ${st.lightBg} flex items-center justify-between gap-3`}>
                        <div className="flex items-center gap-3 min-w-0">
                          {ot.avatarUrl ? (
                            <img
                              src={ot.avatarUrl}
                              alt={ot.userName}
                              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-xs flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-xs">
                              {ot.userName.charAt(0) || "พ"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-gray-900 leading-tight truncate">
                              {ot.userName}
                            </h3>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              ยื่นเมื่อ {fmtDateTime(ot.submittedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${st.bg} text-white shadow-xs`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {st.label}
                          </span>
                          <span className="text-xs font-extrabold text-gray-700 bg-white/90 px-2 py-0.5 rounded-md border border-gray-200/60 shadow-2xs">
                            +{ot.hours} ชม.
                          </span>
                        </div>
                      </div>

                      {/* Card Body: Clean info rows (No Reason) */}
                      <div className="p-4 space-y-2.5 bg-white text-xs text-gray-700">
                        {/* Time & Project Info Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                            <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
                              </svg>
                            </span>
                            <div>
                              <p className="text-[10px] text-gray-400 font-semibold uppercase">เวลาทำงาน OT</p>
                              <p className="font-bold text-gray-800 text-[13px]">{ot.startTime} – {ot.endTime} น.</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                            <span className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                              </svg>
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] text-gray-400 font-semibold uppercase">โปรเจกต์</p>
                              <p className="font-bold text-gray-800 text-[12px] truncate">
                                {ot.projectNo && <span className="text-sky-600 font-extrabold mr-1">#{ot.projectNo}</span>}
                                {ot.project || "-"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Approved By Note */}
                        {ot.status === "approved" && ot.approvedBy && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-emerald-600">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            <span>อนุมัติโดย {ot.approvedBy}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OT Calendar Grid ─────────────────────────────────────────────────────────
function OTCalendarGrid({ year, month, otRequests, holidays, onSelectDay }: {
  year: number; month: number; otRequests: OTRequest[]; holidays: Holiday[]; onSelectDay: (d: Date) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = new Date();
  const todayStr = fmt(today);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/90">
        {DAYS_SHORT.map((d, i) => (
          <div key={d} className={`text-center text-xs font-bold py-2 md:py-3 ${i===0?"text-rose-500":i===6?"text-sky-500":"text-gray-600"} ${i<6?"border-r border-gray-100":""}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 divide-x divide-gray-100" style={{ gridAutoRows:"1fr" }}>
        {cells.map((day, idx) => {
          const col = idx % 7;
          const rowStart = Math.floor(idx/7)*7;
          const isLastRow = rowStart+7 >= cells.length;

          if (!day) {
            return <div key={`e-${idx}`} className={`min-h-[68px] md:min-h-[105px] bg-gray-50/40 ${!isLastRow?"border-b border-gray-100":""}`}/>;
          }

          const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const isToday = dateStr === todayStr;
          const isSun = col === 0;
          const isSat = col === 6;

          const dayOTs = otRequests.filter(r => r.date === dateStr);
          const dayHolidays = holidays.filter(h => h.date === dateStr);
          const isWorkingSat = dayHolidays.some(h => h.type === "working_sat");
          const isNationalHoliday = dayHolidays.some(h => h.type === "national" || h.type === "special");
          const isCompanyHoliday = dayHolidays.some(h => h.type === "company");

          return (
            <button
              key={day}
              onClick={() => onSelectDay(new Date(year, month, day))}
              className={`
                relative min-h-[68px] md:min-h-[105px] p-1 md:p-2 text-left
                flex flex-col gap-0.5 md:gap-1 transition-all duration-150 group
                ${!isLastRow?"border-b border-gray-100":""}
                ${isToday?"bg-amber-50/50":isNationalHoliday?"bg-rose-50/60":isCompanyHoliday?"bg-orange-50/50":isSun?"bg-red-50/30 hover:bg-red-50/60":isSat&&!isWorkingSat?"bg-sky-50/30 hover:bg-sky-50/60":"bg-white hover:bg-amber-50/30"}
                hover:z-10 cursor-pointer
              `}
            >
              {isToday && <span className="absolute top-0 left-0 right-0 h-0.5 md:h-1 bg-amber-500 rounded-b shadow-xs"/>}

              {/* Day Header */}
              <span className={`w-5 h-5 md:w-7 md:h-7 rounded-md md:rounded-lg flex items-center justify-center text-xs md:text-sm font-extrabold flex-shrink-0 transition-colors
                ${isToday?"bg-amber-500 text-white shadow-sm":isNationalHoliday?"text-rose-500":isCompanyHoliday?"text-orange-500":isSun?"text-rose-400":isSat&&!isWorkingSat?"text-sky-500":"text-gray-800"}
                group-hover:ring-2 group-hover:ring-amber-300`}>
                {day}
              </span>

              {/* Holiday Name (Desktop only) */}
              {dayHolidays.length > 0 && (
                <span className={`hidden md:block text-[9px] font-bold truncate leading-tight px-1.5 py-0.5 rounded-md w-full ${HOLIDAY_TYPE_CONFIG[dayHolidays[0].type].color}`}>
                  {dayHolidays[0].name}
                </span>
              )}

              {/* OT Profile Avatars (เหมือน Calendar Leave เป๊ะ สะอาดตา) */}
              {dayOTs.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap">
                  {dayOTs.slice(0, 4).map((ot) => (
                    <div 
                      key={ot.id} 
                      title={`${ot.userName} (+${ot.hours}h OT)`}
                      className="w-4 h-4 md:w-5 md:h-5 rounded-full overflow-hidden border border-white shadow-2xs flex-shrink-0 cursor-pointer transition-transform hover:scale-115 hover:z-10 relative"
                    >
                      {ot.avatarUrl ? (
                        <img src={ot.avatarUrl} alt={ot.userName} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center text-[7px] md:text-[9px] font-bold text-white ${
                          ot.status === "approved" ? "bg-emerald-500" : ot.status === "pending" ? "bg-amber-500" : "bg-rose-500"
                        }`}>
                          {(ot.userName || "?").charAt(0)}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* +N More Bubble */}
                  {dayOTs.length > 4 && (
                    <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-gray-100 border border-white shadow-2xs flex items-center justify-center text-[8px] md:text-[9px] font-bold text-gray-600">
                      +{dayOTs.length - 4}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CalendarOTPage() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<"month" | "list">("month");
  const [otRequests, setOtRequests] = useState<OTRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userScope, setUserScope] = useState<"all" | "my">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const [holidayRes, otRes, profilesRes, projectsRes] = await Promise.all([
        supabase.from("holidays").select("*"),
        supabase
          .from("ot_requests")
          .select("id, user_id, request_date, start_time, end_time, hours, project_id, reason, status, reject_reason, created_at, approved_by, actioned_at")
          .order("request_date", { ascending: false }),
        supabase
          .from("profiles_with_avatar")
          .select("id, first_name, last_name, avatar_url"),
        supabase
          .from("projects")
          .select("id, project_no, name"),
      ]);

      if (holidayRes.data) {
        setHolidays(holidayRes.data.map((h: any) => ({
          id: h.id.toString(),
          date: h.holiday_date,
          name: h.name,
          type: h.holiday_type as Holiday["type"],
        })));
      }

      if (otRes.data) {
        const profilesMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
        const projectsMap = new Map((projectsRes.data ?? []).map((p: any) => [p.id, p]));

        const mapped: OTRequest[] = otRes.data.map((r: any) => {
          const profile = profilesMap.get(r.user_id);
          const approver = r.approved_by ? profilesMap.get(r.approved_by) : null;
          const proj = projectsMap.get(r.project_id);
          const userName = profile
            ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "พนักงาน"
            : "พนักงาน";
          const approvedBy = approver
            ? `${approver.first_name ?? ""} ${approver.last_name ?? ""}`.trim()
            : undefined;

          return {
            id: r.id,
            userId: r.user_id,
            userName,
            avatarUrl: profile?.avatar_url ?? null,
            date: r.request_date,
            startTime: r.start_time?.slice(0, 5) ?? "",
            endTime: r.end_time?.slice(0, 5) ?? "",
            hours: r.hours ?? 0,
            project: proj?.name ?? "",
            projectNo: proj?.project_no ?? "",
            reason: r.reason ?? "",
            status: (r.status as OTStatus) ?? "pending",
            submittedAt: r.created_at ?? new Date().toISOString(),
            approvedBy,
            rejectReason: r.reject_reason ?? undefined,
          };
        });

        setOtRequests(mapped);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const prevMonth = () => { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  // Filter OT requests based on user scope, status, and search query
  const filteredOTRequests = useMemo(() => {
    return otRequests.filter(r => {
      if (userScope === "my" && currentUserId && r.userId !== currentUserId) {
        return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUser = r.userName.toLowerCase().includes(q);
        const matchProject = r.project.toLowerCase().includes(q) || r.projectNo.toLowerCase().includes(q);
        if (!matchUser && !matchProject) return false;
      }
      return true;
    });
  }, [otRequests, userScope, currentUserId, statusFilter, searchQuery]);

  const monthStr = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;
  const monthOTs = filteredOTRequests.filter(r => r.date.startsWith(monthStr));
  const pendingOTs = monthOTs.filter(r => r.status==="pending");
  const approvedOTs = monthOTs.filter(r => r.status==="approved");
  const listDays = Array.from(new Set(monthOTs.map(r => r.date))).sort();

  return (
    <main className="min-h-screen bg-gray-50 pb-32 md:pb-12">

      {/* ── Compact Header ── */}
      <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-md border-b border-gray-100 px-3 md:px-6 pt-3 pb-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 shadow-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 md:w-4 md:h-4">
                <circle cx="12" cy="12" r="9"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="12" x2="15" y2="14"/>
                <path d="M17 3.5L21 7"/>
              </svg>
            </span>
            <div>
              <h1 className="text-base md:text-xl font-extrabold text-gray-800 leading-tight truncate">
                ปฏิทิน OT
              </h1>
              <p className="hidden md:block text-[11px] text-gray-500">ดู OT Request ของพนักงานทุกคนในมุมมองปฏิทิน</p>
            </div>
          </div>

          {/* Controls: Scope toggle & View mode */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Scope toggle */}
            <div className="flex items-center bg-gray-100 rounded-xl p-0.5 text-xs font-semibold">
              <button
                onClick={() => setUserScope("all")}
                className={`px-2.5 py-1 rounded-lg transition-all text-xs ${userScope === "all" ? "bg-white text-gray-800 shadow-xs" : "text-gray-500 hover:text-gray-700"}`}
              >
                ทุกคน
              </button>
              <button
                onClick={() => setUserScope("my")}
                className={`px-2.5 py-1 rounded-lg transition-all text-xs ${userScope === "my" ? "bg-white text-amber-600 shadow-xs" : "text-gray-500 hover:text-gray-700"}`}
              >
                ของฉัน
              </button>
            </div>

            {/* View Mode */}
            <div className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5">
              <button
                onClick={() => setView("month")}
                title="มุมมองปฏิทินรายเดือน"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${view==="month"?"bg-white shadow-xs text-amber-600":"text-gray-400 hover:text-gray-600"}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
              <button
                onClick={() => setView("list")}
                title="มุมมองรายการ"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${view==="list"?"bg-white shadow-xs text-amber-600":"text-gray-400 hover:text-gray-600"}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Month Navigation & Status Summary */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-base md:text-lg font-extrabold text-gray-800 leading-tight">
              {MONTHS_TH[viewMonth]} {viewYear+543}
            </h2>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200">
              วันนี้
            </button>
            <button onClick={nextMonth} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Status Filter Buttons (Horizontal compact) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${statusFilter === "all" ? "bg-gray-800 text-white font-bold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            ทั้งหมด ({monthOTs.length})
          </button>
          <button
            onClick={() => setStatusFilter("approved")}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors flex-shrink-0 ${statusFilter === "approved" ? "bg-emerald-600 text-white font-bold" : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            อนุมัติแล้ว ({approvedOTs.length})
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors flex-shrink-0 ${statusFilter === "pending" ? "bg-amber-500 text-white font-bold" : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            รอพิจารณา ({pendingOTs.length})
          </button>
        </div>
      </div>

      {/* ── Calendar / List ── */}
      <div className="px-2 md:px-6 mt-2 md:mt-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-500 animate-spin"/>
          </div>
        ) : view === "month" ? (
          <OTCalendarGrid
            year={viewYear} month={viewMonth}
            otRequests={filteredOTRequests} holidays={holidays}
            onSelectDay={setSelectedDate}
          />
        ) : (
          <div className="space-y-3">
            {listDays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300">
                    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-400">ไม่มี OT Request ในเดือนนี้</p>
                <p className="text-xs text-gray-300 mt-1">ยังไม่มีการยื่นคำขอ OT ที่ตรงกับเงื่อนไข</p>
              </div>
            ) : (
              listDays.map(dateStr => {
                const d = parseDate(dateStr);
                const dayOTs = filteredOTRequests.filter(r => r.date === dateStr).sort((a,b) => a.startTime.localeCompare(b.startTime));
                const dayHolidays = holidays.filter(h => h.date === dateStr);
                const isToday = dateStr === fmt(today);

                return (
                  <div key={dateStr} className="bg-white rounded-2xl p-3.5 md:p-4 border border-gray-100 shadow-xs space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-xs ${isToday?"bg-amber-500 text-white":"bg-gray-50 text-gray-700 border border-gray-100"}`}>
                        <span className="text-base md:text-lg font-extrabold leading-none">{d.getDate()}</span>
                        <span className="text-[8px] md:text-[9px] font-bold leading-none mt-0.5 opacity-80">{DAYS_SHORT[d.getDay()]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isToday?"text-amber-600":"text-gray-800"}`}>
                          {d.getDate()} {MONTHS_TH[d.getMonth()]} {d.getFullYear()+543}
                        </p>
                        {dayHolidays.map(h => (
                          <span key={h.id} className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-md border mr-1 ${HOLIDAY_TYPE_CONFIG[h.type].color}`}>
                            {h.name}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-gray-400">{dayOTs.length} คำขอ</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {dayOTs.map(ot => {
                        const st = STATUS_CONFIG[ot.status] || STATUS_CONFIG.pending;
                        return (
                          <div key={ot.id} className={`rounded-xl border p-3 ${st.border} ${st.lightBg} space-y-2`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {ot.avatarUrl ? (
                                  <img src={ot.avatarUrl} alt={ot.userName} className="w-7 h-7 rounded-full object-cover border border-white shadow-2xs flex-shrink-0" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-2xs">
                                    {ot.userName.charAt(0)}
                                  </div>
                                )}
                                <span className="text-xs font-bold text-gray-900 truncate">{ot.userName}</span>
                              </div>
                              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-white shadow-2xs ${st.text}`}>
                                +{ot.hours}h OT
                              </span>
                            </div>

                            <div className="text-xs text-gray-600 space-y-0.5 bg-white/70 p-2 rounded-lg border border-gray-100">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-800">{ot.startTime} – {ot.endTime} น.</span>
                                {ot.projectNo && <span className="text-sky-600 font-extrabold">#{ot.projectNo}</span>}
                              </div>
                              {ot.project && <p className="text-gray-500 truncate">{ot.project}</p>}
                            </div>

                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-gray-200/50">
                              <span className={`font-bold ${st.text}`}>{st.label}</span>
                              {ot.approvedBy && <span className="text-emerald-700 font-medium">อนุมัติ: {ot.approvedBy}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Day Detail Panel ── */}
      {selectedDate && (
        <OTDayPanel
          date={selectedDate}
          otRequests={filteredOTRequests}
          holidays={holidays}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </main>
  );
}
