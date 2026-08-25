"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
type OTStatus = "pending" | "approved" | "rejected";

interface OTRequest {
  id: string;
  userId: string;
  userName: string;
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
  avatar?: string;
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
  label: string; bg: string; text: string; border: string; dot: string; lightBg: string;
}> = {
  pending:  { label:"รอพิจารณา",  bg:"bg-amber-500",   text:"text-amber-600",   border:"border-amber-200",   dot:"bg-amber-400",   lightBg:"bg-amber-50"   },
  approved: { label:"อนุมัติแล้ว",bg:"bg-emerald-500", text:"text-emerald-600", border:"border-emerald-200", dot:"bg-emerald-400", lightBg:"bg-emerald-50" },
  rejected: { label:"ไม่อนุมัติ", bg:"bg-rose-500",    text:"text-rose-600",    border:"border-rose-200",    dot:"bg-rose-400",    lightBg:"bg-rose-50"    },
};

const HOLIDAY_TYPE_CONFIG = {
  national:    { color:"bg-rose-100 text-rose-600 border-rose-200" },
  company:     { color:"bg-orange-100 text-orange-600 border-orange-200" },
  special:     { color:"bg-purple-100 text-purple-600 border-purple-200" },
  working_sat: { color:"bg-sky-100 text-sky-600 border-sky-200" },
};

// ─── Mock Data (fallback) ─────────────────────────────────────────────────────
const MOCK_OT: OTRequest[] = [
  {
    id:"ot001",userId:"1055",userName:"ช่างวิทย์ สมบูรณ์",avatar:"ว",
    date:"2026-08-25",startTime:"17:30",endTime:"21:00",hours:3.5,
    project:"Toyota Line A",projectNo:"1155",
    reason:"ทดสอบระบบ / Commissioning",status:"pending",
    submittedAt:"2026-08-24T10:30:00",
  },
  {
    id:"ot002",userId:"1055",userName:"ช่างวิทย์ สมบูรณ์",avatar:"ว",
    date:"2026-08-18",startTime:"17:30",endTime:"19:00",hours:1.5,
    project:"SCG Plant",projectNo:"1172",
    reason:"เร่งส่งมอบงาน Phase 2",status:"approved",
    submittedAt:"2026-08-17T14:00:00",
    approvedBy:"นายสมชาย (Manager)",
  },
  {
    id:"ot003",userId:"1055",userName:"ช่างวิทย์ สมบูรณ์",avatar:"ว",
    date:"2026-08-11",startTime:"17:30",endTime:"20:30",hours:3,
    project:"Honda Factory",projectNo:"1160",
    reason:"งานด่วนลูกค้า",status:"rejected",
    submittedAt:"2026-08-10T16:00:00",
    approvedBy:"นายสมชาย (Manager)",
    rejectReason:"ไม่มีในแผนการทำงาน กรุณายื่นใหม่พร้อมแนบ PO",
  },
  {
    id:"ot004",userId:"1055",userName:"ช่างวิทย์ สมบูรณ์",avatar:"ว",
    date:"2026-08-05",startTime:"17:30",endTime:"21:30",hours:4,
    project:"Toyota Line B",projectNo:"1180",
    reason:"ซ่อมฉุกเฉิน",status:"approved",
    submittedAt:"2026-08-04T08:00:00",
    approvedBy:"นายสมชาย (Manager)",
  },
];

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
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()+543} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

// ─── OT Day Panel ─────────────────────────────────────────────────────────────
function OTDayPanel({ date, otRequests, holidays, onClose }: {
  date: Date; otRequests: OTRequest[]; holidays: Holiday[]; onClose: () => void;
}) {
  const dateStr = fmt(date);
  const dayOTs = otRequests.filter(r => r.date === dateStr);
  const dayHolidays = holidays.filter(h => h.date === dateStr);
  const thDay = ["วันอาทิตย์","วันจันทร์","วันอังคาร","วันพุธ","วันพฤหัสบดี","วันศุกร์","วันเสาร์"];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full md:w-[440px] max-h-[85vh] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:fade-in duration-200">

        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-start justify-between px-5 pt-3 pb-4 flex-shrink-0 border-b border-gray-50">
          <div>
            <p className="text-xs text-gray-400 font-medium">{thDay[date.getDay()]}</p>
            <h2 className="text-2xl font-extrabold text-gray-800 leading-none">
              {date.getDate()} {MONTHS_TH[date.getMonth()]}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{date.getFullYear()+543}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors mt-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {dayHolidays.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">วันหยุด / เสาร์ทำงาน</p>
              {dayHolidays.map(h => (
                <div key={h.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold ${HOLIDAY_TYPE_CONFIG[h.type].color}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0">
                    <circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/>
                  </svg>
                  <span>{h.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              OT Request ({dayOTs.length})
            </p>

            {dayOTs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-gray-300">
                    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-400">ไม่มี OT Request</p>
                <p className="text-xs text-gray-300 mt-1">ไม่มีการขอ OT ในวันนี้</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dayOTs.map(ot => {
                  const st = STATUS_CONFIG[ot.status];
                  return (
                    <div key={ot.id} className={`rounded-2xl border-2 overflow-hidden ${st.border} ${st.lightBg}`}>
                      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`}/>
                        <span className={`text-xs font-bold ${st.text}`}>{st.label}</span>
                        <span className="flex-1"/>
                        <span className={`text-xs font-extrabold px-2 py-0.5 rounded-lg bg-white/60 ${st.text}`}>+{ot.hours}h OT</span>
                      </div>
                      <div className="px-4 pb-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {ot.avatar || ot.userName.charAt(0)}
                          </div>
                          <p className="text-sm font-bold text-gray-800 leading-tight">{ot.userName}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 flex-shrink-0 text-gray-400">
                            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
                          </svg>
                          <span className="font-semibold">{ot.startTime} – {ot.endTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="font-extrabold text-sky-500">#{ot.projectNo}</span>
                          <span className="font-medium">{ot.project}</span>
                        </div>

                        {ot.status === "rejected" && ot.rejectReason && (
                          <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                            <p className="text-[10px] text-rose-500 font-bold mb-0.5">เหตุผลที่ไม่อนุมัติ</p>
                            <p className="text-xs text-rose-700 font-semibold">{ot.rejectReason}</p>
                          </div>
                        )}
                        {ot.status === "approved" && ot.approvedBy && (
                          <p className="text-[10px] text-emerald-500 font-semibold">✓ อนุมัติโดย {ot.approvedBy}</p>
                        )}
                        <p className="text-[10px] text-gray-300">ยื่นเมื่อ {fmtDateTime(ot.submittedAt)}</p>
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
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {DAYS_SHORT.map((d, i) => (
          <div key={d} className={`text-center text-xs font-bold py-3 ${i===0?"text-rose-500":i===6?"text-sky-500":"text-gray-500"} ${i<6?"border-r border-gray-100":""}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 divide-x divide-gray-100" style={{ gridAutoRows:"1fr" }}>
        {cells.map((day, idx) => {
          const col = idx % 7;
          const rowStart = Math.floor(idx/7)*7;
          const isLastRow = rowStart+7 >= cells.length;

          if (!day) {
            return <div key={`e-${idx}`} className={`min-h-[74px] md:min-h-[100px] bg-gray-50/50 ${!isLastRow?"border-b border-gray-100":""}`}/>;
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

          const hasPending = dayOTs.some(r => r.status === "pending");
          const hasApproved = dayOTs.some(r => r.status === "approved");
          const hasRejected = dayOTs.some(r => r.status === "rejected");

          return (
            <button
              key={day}
              onClick={() => onSelectDay(new Date(year, month, day))}
              className={`
                relative min-h-[74px] md:min-h-[100px] p-1.5 md:p-2 text-left
                flex flex-col gap-1 transition-all duration-150 group
                ${!isLastRow?"border-b border-gray-100":""}
                ${isToday?"bg-sky-50":isNationalHoliday?"bg-rose-50/60":isCompanyHoliday?"bg-orange-50/50":isSun?"bg-red-50/30 hover:bg-red-50/60":isSat&&!isWorkingSat?"bg-sky-50/30 hover:bg-sky-50/60":"bg-white hover:bg-slate-50"}
                hover:z-10
              `}
            >
              {isToday && <span className="absolute top-0 left-0 right-0 h-0.5 bg-sky-500 rounded-b"/>}

              <span className={`w-6 h-6 md:w-7 md:h-7 rounded-lg flex items-center justify-center text-xs md:text-sm font-bold flex-shrink-0 transition-colors
                ${isToday?"bg-sky-500 text-white shadow-sm":isNationalHoliday?"text-rose-500":isCompanyHoliday?"text-orange-500":isSun?"text-rose-400":isSat&&!isWorkingSat?"text-sky-500":"text-gray-800"}
                group-hover:ring-2 group-hover:ring-amber-200`}>
                {day}
              </span>

              {dayHolidays.length > 0 && (
                <span className={`hidden md:block text-[9px] font-bold truncate leading-tight px-1.5 py-0.5 rounded-md w-full ${HOLIDAY_TYPE_CONFIG[dayHolidays[0].type].color}`}>
                  {dayHolidays[0].name}
                </span>
              )}

              {dayOTs.length > 0 && (
                <div className="hidden md:flex flex-col gap-0.5 w-full">
                  {dayOTs.slice(0,2).map(ot => {
                    const st = STATUS_CONFIG[ot.status];
                    return (
                      <span key={ot.id} className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-1 rounded-md truncate w-full leading-none border ${st.lightBg} ${st.text} ${st.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`}/>
                        <span className="truncate">{ot.hours}h · {ot.reason}</span>
                      </span>
                    );
                  })}
                  {dayOTs.length > 2 && (
                    <span className="text-[9px] text-gray-400 font-semibold px-1.5">+{dayOTs.length-2} อื่นๆ</span>
                  )}
                </div>
              )}

              {dayOTs.length > 0 && (
                <div className="md:hidden flex gap-0.5 mt-auto flex-wrap">
                  {hasPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>}
                  {hasApproved && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>}
                  {hasRejected && <span className="w-1.5 h-1.5 rounded-full bg-rose-400"/>}
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
  const [otRequests, setOtRequests] = useState<OTRequest[]>(MOCK_OT);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { data: holidayData } = await supabase.from("holidays").select("*");
      if (holidayData) {
        setHolidays(holidayData.map((h: any) => ({
          id: h.id.toString(), date: h.holiday_date, name: h.name,
          type: h.holiday_type as Holiday["type"],
        })));
      }

      if (user) {
        // ใช้ view ot_requests_with_profile ที่ JOIN profiles + projects ไว้แล้ว
        const { data: otData, error: otError } = await supabase
          .from("ot_requests_with_profile")
          .select("*")
          .eq("user_id", user.id)
          .order("request_date", { ascending: false });

        if (!otError && otData) {
          const mapped: OTRequest[] = otData.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            userName: r.full_name ?? r.first_name ?? "พนักงาน",
            date: r.request_date,                           // request_date ✅
            startTime: r.start_time?.slice(0, 5) ?? "",
            endTime: r.end_time?.slice(0, 5) ?? "",
            hours: r.hours ?? 0,
            project: r.project_name ?? "",                  // จาก view ✅
            projectNo: r.project_no ?? "",                  // จาก view ✅
            reason: r.reason ?? "",
            status: (r.status as OTStatus) ?? "pending",
            submittedAt: r.created_at ?? new Date().toISOString(),
            approvedBy: r.actioned_by_name ?? undefined,    // actioned_by_name ✅
            rejectReason: r.reject_reason ?? undefined,
            avatar: r.first_name?.charAt(0) ?? undefined,
          }));
          setOtRequests(mapped);
        }
        // ถ้า error → แสดง Mock data เป็น fallback ต่อไป
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const prevMonth = () => { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  const monthStr = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}`;
  const monthOTs = otRequests.filter(r => r.date.startsWith(monthStr));
  const pendingOTs = monthOTs.filter(r => r.status==="pending");
  const approvedOTs = monthOTs.filter(r => r.status==="approved");
  const approvedHours = approvedOTs.reduce((s,r) => s+r.hours, 0);
  const listDays = Array.from(new Set(monthOTs.map(r => r.date))).sort();

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3 gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-gray-800 leading-tight flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-amber-600">
                  <circle cx="12" cy="12" r="9"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="12" x2="15" y2="14"/>
                  <path d="M17 3.5L21 7"/>
                </svg>
              </span>
              ปฏิทิน OT
              {pendingOTs.length > 0 && (
                <span className="text-xs font-bold bg-amber-400 text-white px-2 py-0.5 rounded-full">
                  {pendingOTs.length}
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">ดู OT Request ของคุณในมุมมองปฏิทิน</p>
          </div>

          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setView("month")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${view==="month"?"bg-white shadow-sm text-amber-500":"text-gray-400 hover:text-gray-600"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${view==="list"?"bg-white shadow-sm text-amber-500":"text-gray-400 hover:text-gray-600"}`}
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
        </div>

        <div className="flex items-center justify-between px-4 md:px-6 pb-3">
          <button onClick={prevMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-lg font-extrabold text-gray-800 leading-tight">
              {MONTHS_TH[viewMonth]} {viewYear+543}
            </h2>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{monthOTs.length} OT Request</span>
              {pendingOTs.length > 0 && (
                <>
                  <span className="text-gray-200">·</span>
                  <span className="flex items-center gap-1 text-xs text-amber-500 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"/>
                    รอ {pendingOTs.length}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200">
              วันนี้
            </button>
            <button onClick={nextMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Legend — compact dots ใน sticky header */}
        <div className="flex items-center gap-4 px-4 md:px-6 pb-3">
          {[
            { dot:"bg-amber-400",   label:"รอพิจารณา"  },
            { dot:"bg-emerald-400", label:"อนุมัติแล้ว" },
            { dot:"bg-rose-400",    label:"ไม่อนุมัติ"  },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dot}`}/>
              <span className="text-[11px] text-gray-400 font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Calendar / List ── */}
      <div className="px-3 md:px-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-500 animate-spin"/>
          </div>
        ) : view === "month" ? (
          <OTCalendarGrid
            year={viewYear} month={viewMonth}
            otRequests={otRequests} holidays={holidays}
            onSelectDay={setSelectedDate}
          />
        ) : (
          <div className="space-y-4">
            {listDays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-gray-300">
                    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-400">ไม่มี OT Request ในเดือนนี้</p>
                <p className="text-xs text-gray-300 mt-1">ไปหน้า OT Request เพื่อยื่นคำขอ</p>
              </div>
            ) : (
              listDays.map(dateStr => {
                const d = parseDate(dateStr);
                const dayOTs = otRequests.filter(r => r.date === dateStr).sort((a,b) => a.startTime.localeCompare(b.startTime));
                const dayHolidays = holidays.filter(h => h.date === dateStr);
                const isToday = dateStr === fmt(today);

                return (
                  <div key={dateStr}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 shadow-sm ${isToday?"bg-sky-500 text-white":"bg-white text-gray-700 border border-gray-100"}`}>
                        <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
                        <span className="text-[9px] font-bold leading-none mt-0.5 opacity-70">{DAYS_SHORT[d.getDay()]}</span>
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isToday?"text-sky-600":"text-gray-700"}`}>
                          {d.getDate()} {MONTHS_TH[d.getMonth()]} {d.getFullYear()+543}
                        </p>
                        {dayHolidays.map(h => (
                          <span key={h.id} className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-md border mr-1 ${HOLIDAY_TYPE_CONFIG[h.type].color}`}>
                            {h.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2" style={{ paddingLeft:"60px" }}>
                      {dayOTs.map(ot => {
                        const st = STATUS_CONFIG[ot.status];
                        return (
                          <div key={ot.id} className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm ${st.border}`}>
                            <div className={`flex items-center gap-2 px-4 py-2 ${st.lightBg}`}>
                              <span className={`w-2 h-2 rounded-full ${st.dot}`}/>
                              <span className={`text-xs font-bold ${st.text}`}>{st.label}</span>
                              <span className="flex-1"/>
                              <span className={`text-xs font-extrabold ${st.text}`}>+{ot.hours}h</span>
                            </div>
                            <div className="px-4 py-3 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                  {ot.avatar || ot.userName.charAt(0)}
                                </div>
                                <p className="text-sm font-bold text-gray-800 leading-tight">{ot.userName}</p>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-gray-400">
                                  <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
                                </svg>
                                <span className="font-semibold">{ot.startTime} – {ot.endTime}</span>
                                <span className="text-gray-300 mx-1">·</span>
                                <span className="font-semibold text-sky-500">#{ot.projectNo}</span>
                                <span>{ot.project}</span>
                              </div>
                              <p className="text-xs text-gray-500">{ot.reason}</p>
                              {ot.status === "rejected" && ot.rejectReason && (
                                <p className="text-xs text-rose-500 font-semibold">✕ {ot.rejectReason}</p>
                              )}
                              {ot.status === "approved" && ot.approvedBy && (
                                <p className="text-xs text-emerald-500 font-semibold">✓ {ot.approvedBy}</p>
                              )}
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
          otRequests={otRequests}
          holidays={holidays}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </main>
  );
}
