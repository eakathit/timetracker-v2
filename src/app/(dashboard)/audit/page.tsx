export default function AuditPage() {
  return null;
}
// "use client"; 

// import { useState } from "react";

// // ─── Mock Data ────────────────────────────────────────────────────────────────
// const MOCK_DATE = "2025-03-06";

// const MOCK_EMPLOYEES = [
//   {
//     id: "u1",
//     name: "สมชาย ใจดี",
//     avatar: "สช",
//     role: "Developer",
//     status: "checked_out",
//     checkIn: "08:52",
//     checkOut: "18:05",
//     totalHours: "9h 13m",
//     overtime: "1h 13m",
//     checkInLocation: { lat: 13.7563, lng: 100.5018, address: "อาคาร A ชั้น 3, ถ.สุขุมวิท, กรุงเทพฯ" },
//     checkOutLocation: { lat: 13.7563, lng: 100.5018, address: "อาคาร A ชั้น 3, ถ.สุขุมวิท, กรุงเทพฯ" },
//     timelineEvents: [
//       { time: "08:52", action: "check_in", note: "เริ่มงาน" },
//       { time: "12:01", action: "break_start", note: "พักเที่ยง" },
//       { time: "13:02", action: "break_end", note: "กลับมาทำงาน" },
//       { time: "18:05", action: "check_out", note: "เลิกงาน" },
//     ],
//     dailyReport: [
//       { project: "Time Tracker V2", workDetail: "พัฒนาหน้า Dashboard", hours: 3.5 },
//       { project: "Time Tracker V2", workDetail: "Fix Bug #142 - GPS drift", hours: 2.0 },
//       { project: "Portal CRM", workDetail: "Code Review PR #88", hours: 1.5 },
//     ],
//     reportNote: "ปรับปรุง GPS accuracy และ fix edge case บน iOS",
//     anomalies: [],
//   },
//   {
//     id: "u2",
//     name: "วิภาพร รักงาน",
//     avatar: "วภ",
//     role: "Designer",
//     status: "checked_in",
//     checkIn: "09:10",
//     checkOut: null,
//     totalHours: "7h 45m",
//     overtime: null,
//     checkInLocation: { lat: 13.7448, lng: 100.5329, address: "Co-working Space, อโศก, กรุงเทพฯ" },
//     checkOutLocation: null,
//     timelineEvents: [
//       { time: "09:10", action: "check_in", note: "เริ่มงาน (Remote)" },
//       { time: "12:15", action: "break_start", note: "พักเที่ยง" },
//       { time: "13:10", action: "break_end", note: "กลับมาทำงาน" },
//     ],
//     dailyReport: [
//       { project: "Portal CRM", workDetail: "ออกแบบ UI Component Library", hours: 4.0 },
//       { project: "Portal CRM", workDetail: "Prototype หน้า Dashboard", hours: 2.5 },
//     ],
//     reportNote: "",
//     anomalies: ["check_out_missing"],
//   },
//   {
//     id: "u3",
//     name: "ธนภัทร สุขใส",
//     avatar: "ธภ",
//     role: "PM",
//     status: "absent",
//     checkIn: null,
//     checkOut: null,
//     totalHours: null,
//     overtime: null,
//     checkInLocation: null,
//     checkOutLocation: null,
//     timelineEvents: [],
//     dailyReport: [],
//     reportNote: "",
//     anomalies: ["no_checkin"],
//   },
//   {
//     id: "u4",
//     name: "นภสร ชัยมงคล",
//     avatar: "นภ",
//     role: "QA",
//     status: "checked_out",
//     checkIn: "07:45",
//     checkOut: "16:30",
//     totalHours: "8h 45m",
//     overtime: "0h 45m",
//     checkInLocation: { lat: 13.8621, lng: 100.5173, address: "บ้านพัก, ดอนเมือง, กรุงเทพฯ" },
//     checkOutLocation: { lat: 13.7563, lng: 100.5018, address: "อาคาร A ชั้น 3, ถ.สุขุมวิท, กรุงเทพฯ" },
//     timelineEvents: [
//       { time: "07:45", action: "check_in", note: "เช็คอินจากบ้าน (WFH)" },
//       { time: "11:50", action: "break_start", note: "พักเที่ยง" },
//       { time: "12:45", action: "break_end", note: "กลับมาทำงาน" },
//       { time: "16:30", action: "check_out", note: "เลิกงาน" },
//     ],
//     dailyReport: [
//       { project: "Time Tracker V2", workDetail: "Test Suite - GPS Module", hours: 3.0 },
//       { project: "Time Tracker V2", workDetail: "Regression Test Build #210", hours: 2.5 },
//       { project: "Portal CRM", workDetail: "UAT Round 2", hours: 2.0 },
//     ],
//     reportNote: "พบ Bug 3 รายการ, เปิด Issue ใน Jira แล้ว",
//     anomalies: ["early_checkin"],
//   },
// ];

// const SUMMARY = {
//   total: 4,
//   checkedIn: 1,
//   checkedOut: 2,
//   absent: 1,
//   avgHours: "8h 34m",
//   totalOvertime: "2h 58m",
// };

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// const STATUS_CONFIG = {
//   checked_in: { label: "กำลังทำงาน", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
//   checked_out: { label: "เลิกงานแล้ว", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
//   absent: { label: "ขาดงาน / ไม่เช็คอิน", color: "bg-red-100 text-red-600 border-red-200", dot: "bg-red-500" },
// };

// const ACTION_CONFIG = {
//   check_in: { label: "เช็คอิน", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: "▶" },
//   check_out: { label: "เช็คเอาท์", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", icon: "■" },
//   break_start: { label: "พักงาน", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: "⏸" },
//   break_end: { label: "กลับมาทำงาน", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: "▶" },
// };

// const ANOMALY_CONFIG = {
//   no_checkin: { label: "ไม่มีการเช็คอิน", color: "text-red-600 bg-red-50 border-red-200" },
//   check_out_missing: { label: "ยังไม่เช็คเอาท์", color: "text-amber-600 bg-amber-50 border-amber-200" },
//   early_checkin: { label: "เช็คอินก่อน 8:00", color: "text-purple-600 bg-purple-50 border-purple-200" },
//   late_checkin: { label: "เช็คอินสาย", color: "text-orange-600 bg-orange-50 border-orange-200" },
// };

// // ─── Sub-components ───────────────────────────────────────────────────────────

// function StatCard({ label, value, sub, accent }) {
//   const accents = {
//     blue: "from-blue-600 to-blue-400",
//     emerald: "from-emerald-600 to-emerald-400",
//     red: "from-red-500 to-rose-400",
//     amber: "from-amber-500 to-amber-300",
//     slate: "from-slate-600 to-slate-400",
//   };
//   return (
//     <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-1">
//       <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
//       <span className={`text-2xl font-bold bg-gradient-to-r ${accents[accent]} bg-clip-text text-transparent`}>{value}</span>
//       {sub && <span className="text-xs text-slate-400">{sub}</span>}
//     </div>
//   );
// }

// function Badge({ anomaly }) {
//   const cfg = ANOMALY_CONFIG[anomaly] || {};
//   return (
//     <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
//       ⚠ {cfg.label}
//     </span>
//   );
// }

// function GPSPin({ location }) {
//   if (!location) return <span className="text-slate-300 text-xs">—</span>;
//   return (
//     <div className="flex items-start gap-1.5">
//       <span className="text-base leading-none mt-0.5">📍</span>
//       <div>
//         <p className="text-xs text-slate-700 leading-snug">{location.address}</p>
//         <p className="text-[10px] text-slate-400 font-mono mt-0.5">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
//       </div>
//     </div>
//   );
// }

// function Timeline({ events }) {
//   if (!events.length) return <p className="text-xs text-slate-400 italic">ไม่มีข้อมูล</p>;
//   return (
//     <div className="relative pl-4">
//       <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-200" />
//       <div className="flex flex-col gap-3">
//         {events.map((ev, i) => {
//           const cfg = ACTION_CONFIG[ev.action] || {};
//           return (
//             <div key={i} className="flex items-start gap-3 relative">
//               <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 mt-0.5 ${cfg.dot || "bg-slate-300 border-slate-300"} z-10`}
//                 style={{ marginLeft: "-6px", background: ev.action === "check_in" ? "#10b981" : ev.action === "check_out" ? "#94a3b8" : ev.action === "break_start" ? "#f59e0b" : "#3b82f6" }}
//               />
//               <div className={`flex-1 rounded-lg border px-3 py-1.5 ${cfg.bg}`}>
//                 <div className="flex items-center justify-between">
//                   <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
//                   <span className="text-xs text-slate-400 font-mono">{ev.time}</span>
//                 </div>
//                 {ev.note && <p className="text-xs text-slate-500 mt-0.5">{ev.note}</p>}
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

// function WorkReport({ items, note }) {
//   if (!items.length) return <p className="text-xs text-slate-400 italic">ไม่มีรายงานงาน</p>;
//   const total = items.reduce((s, r) => s + r.hours, 0);
//   const projectColors = {};
//   const palette = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500"];
//   items.forEach((r) => {
//     if (!projectColors[r.project]) {
//       projectColors[r.project] = palette[Object.keys(projectColors).length % palette.length];
//     }
//   });
//   return (
//     <div className="flex flex-col gap-2">
//       {items.map((r, i) => (
//         <div key={i} className="flex items-start gap-2.5">
//           <div className={`w-1.5 rounded-full flex-shrink-0 mt-1.5 ${projectColors[r.project]}`} style={{ height: "calc(100% - 6px)", minHeight: "32px" }} />
//           <div className="flex-1">
//             <div className="flex items-start justify-between gap-2">
//               <div>
//                 <p className="text-xs font-semibold text-slate-700">{r.workDetail}</p>
//                 <p className="text-[10px] text-slate-400">{r.project}</p>
//               </div>
//               <span className="text-xs font-mono font-bold text-slate-600 flex-shrink-0">{r.hours}h</span>
//             </div>
//           </div>
//         </div>
//       ))}
//       <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
//         <span className="text-xs text-slate-400">รวม</span>
//         <span className="text-xs font-bold text-slate-700 font-mono">{total}h</span>
//       </div>
//       {note && (
//         <div className="bg-amber-50 border border-amber-100 rounded-lg p-2">
//           <p className="text-xs text-amber-700">📝 {note}</p>
//         </div>
//       )}
//     </div>
//   );
// }

// function EmployeeCard({ emp, isExpanded, onToggle }) {
//   const statusCfg = STATUS_CONFIG[emp.status] || {};
//   return (
//     <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${emp.anomalies.length ? "border-amber-200" : "border-slate-100"}`}>
//       {/* Header */}
//       <button onClick={onToggle} className="w-full text-left p-4 hover:bg-slate-50 transition-colors">
//         <div className="flex items-center gap-3">
//           {/* Avatar */}
//           <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
//             style={{ background: emp.status === "absent" ? "#e2e8f0" : "linear-gradient(135deg,#3b82f6,#6366f1)", color: emp.status === "absent" ? "#94a3b8" : "white" }}>
//             {emp.avatar}
//           </div>

//           {/* Name + Role */}
//           <div className="flex-1 min-w-0">
//             <div className="flex items-center gap-2 flex-wrap">
//               <span className="font-semibold text-slate-800 text-sm">{emp.name}</span>
//               <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{emp.role}</span>
//             </div>
//             <div className="flex items-center gap-2 mt-0.5 flex-wrap">
//               <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${statusCfg.color}`}>
//                 <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
//                 {statusCfg.label}
//               </span>
//               {emp.anomalies.map((a) => <Badge key={a} anomaly={a} />)}
//             </div>
//           </div>

//           {/* Time Summary */}
//           <div className="text-right flex-shrink-0">
//             {emp.totalHours ? (
//               <>
//                 <p className="text-sm font-bold text-slate-700 font-mono">{emp.totalHours}</p>
//                 {emp.overtime && <p className="text-[10px] text-orange-500">+{emp.overtime} OT</p>}
//               </>
//             ) : (
//               <p className="text-sm text-slate-300">—</p>
//             )}
//           </div>

//           {/* Chevron */}
//           <span className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}>▾</span>
//         </div>

//         {/* Quick time bar */}
//         {emp.checkIn && (
//           <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
//             <span className="font-mono text-emerald-600 font-semibold">{emp.checkIn}</span>
//             <div className="flex-1 h-1 bg-slate-100 rounded-full relative overflow-hidden">
//               <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full"
//                 style={{ width: emp.checkOut ? "100%" : "65%" }} />
//             </div>
//             <span className="font-mono text-slate-500">{emp.checkOut || "—"}</span>
//           </div>
//         )}
//       </button>

//       {/* Expanded Detail */}
//       {isExpanded && (
//         <div className="border-t border-slate-100 divide-y divide-slate-100">
//           {/* GPS Section */}
//           <div className="p-4">
//             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">ตำแหน่ง GPS</p>
//             <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
//               <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
//                 <p className="text-[10px] font-semibold text-emerald-600 mb-1.5">📍 Check-in Location</p>
//                 <GPSPin location={emp.checkInLocation} />
//               </div>
//               <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
//                 <p className="text-[10px] font-semibold text-slate-500 mb-1.5">📍 Check-out Location</p>
//                 <GPSPin location={emp.checkOutLocation} />
//               </div>
//             </div>
//           </div>

//           {/* Timeline */}
//           <div className="p-4">
//             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Timeline Events</p>
//             <Timeline events={emp.timelineEvents} />
//           </div>

//           {/* Daily Report */}
//           <div className="p-4">
//             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Daily Report</p>
//             <WorkReport items={emp.dailyReport} note={emp.reportNote} />
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── Main Page ────────────────────────────────────────────────────────────────
// export default function AdminDailyAudit() {
//   const [selectedDate, setSelectedDate] = useState(MOCK_DATE);
//   const [expandedId, setExpandedId] = useState(null);
//   const [filterStatus, setFilterStatus] = useState("all");
//   const [search, setSearch] = useState("");

//   const filtered = MOCK_EMPLOYEES.filter((emp) => {
//     const matchStatus = filterStatus === "all" || emp.status === filterStatus;
//     const matchSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || emp.role.toLowerCase().includes(search.toLowerCase());
//     return matchStatus && matchSearch;
//   });

//   const anomalyCount = MOCK_EMPLOYEES.filter((e) => e.anomalies.length > 0).length;

//   return (
//     <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'IBM Plex Sans Thai', 'IBM Plex Sans', sans-serif" }}>
//       {/* Top Bar */}
//       <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
//         <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
//           <div>
//             <h1 className="text-base font-bold text-slate-800">Daily Audit</h1>
//             <p className="text-xs text-slate-400">ตรวจสอบข้อมูลรายวัน</p>
//           </div>
//           <div className="flex items-center gap-2">
//             {anomalyCount > 0 && (
//               <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 rounded-full">
//                 ⚠ {anomalyCount} รายการผิดปกติ
//               </span>
//             )}
//             <input
//               type="date"
//               value={selectedDate}
//               onChange={(e) => setSelectedDate(e.target.value)}
//               className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
//             />
//           </div>
//         </div>
//       </div>

//       <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
//         {/* Summary Cards */}
//         <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
//           <StatCard label="พนักงานทั้งหมด" value={SUMMARY.total} accent="slate" />
//           <StatCard label="กำลังทำงาน" value={SUMMARY.checkedIn} accent="emerald" />
//           <StatCard label="เลิกงานแล้ว" value={SUMMARY.checkedOut} accent="blue" />
//           <StatCard label="ขาด/ไม่เช็คอิน" value={SUMMARY.absent} accent="red" />
//           <StatCard label="OT รวม" value={SUMMARY.totalOvertime} sub={`เฉลี่ย ${SUMMARY.avgHours}/คน`} accent="amber" />
//         </div>

//         {/* Filter & Search */}
//         <div className="flex flex-col gap-2 sm:flex-row">
//           <input
//             type="text"
//             placeholder="ค้นหาชื่อหรือตำแหน่ง..."
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-300"
//           />
//           <div className="flex gap-1.5">
//             {[["all", "ทั้งหมด"], ["checked_in", "ทำงานอยู่"], ["checked_out", "เลิกงาน"], ["absent", "ขาด"]].map(([val, lbl]) => (
//               <button
//                 key={val}
//                 onClick={() => setFilterStatus(val)}
//                 className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filterStatus === val
//                   ? "bg-blue-600 text-white shadow-sm"
//                   : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
//                   }`}
//               >
//                 {lbl}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Employee Cards */}
//         <div className="flex flex-col gap-3">
//           {filtered.length === 0 && (
//             <div className="text-center py-12 text-slate-400 text-sm">ไม่พบข้อมูล</div>
//           )}
//           {filtered.map((emp) => (
//             <EmployeeCard
//               key={emp.id}
//               emp={emp}
//               isExpanded={expandedId === emp.id}
//               onToggle={() => setExpandedId(expandedId === emp.id ? null : emp.id)}
//             />
//           ))}
//         </div>

//         {/* Legend */}
//         <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
//           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">คำอธิบายสัญลักษณ์</p>
//           <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
//             {Object.entries(ANOMALY_CONFIG).map(([k, v]) => (
//               <div key={k} className={`text-xs px-2.5 py-1.5 rounded-lg border ${v.color}`}>⚠ {v.label}</div>
//             ))}
//           </div>
//         </div>

//         <p className="text-center text-[10px] text-slate-300 pb-4">Admin Daily Audit — Time Tracker V2 (Mock Data)</p>
//       </div>
//     </div>
//   );
// }