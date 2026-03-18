"use client";
// src/app/(dashboard)/audit/AuditClient.tsx

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type {
  AuditEmployee,
  AuditSummary,
  TimelineEvent,
  ReportItem,
} from "./types";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  on_time: {
    label: "ปกติ",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  late: {
    label: "สาย",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  absent: {
    label: "ขาดงาน",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  leave: {
    label: "ลา",
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-400",
  },
  active: {
    label: "กำลังทำงาน",
    bg: "bg-sky-50",
    text: "text-sky-700",
    dot: "bg-sky-400",
  },
};

const WORK_TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  in_factory: { label: "Factory", icon: "🏭", color: "text-slate-600" },
  on_site: { label: "On-site", icon: "🚗", color: "text-blue-600" },
  mixed: { label: "Mixed", icon: "🔀", color: "text-purple-600" },
};

const ANOMALY_CONFIG: Record<string, { label: string; color: string }> = {
  late: {
    label: "เข้าสาย",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  no_checkout: {
    label: "ไม่ได้ Check-out",
    color: "bg-red-50 text-red-600 border-red-200",
  },
  absent: { label: "ขาดงาน", color: "bg-red-50 text-red-600 border-red-200" },
  auto_checkout: {
    label: "Auto Check-out",
    color: "bg-orange-50 text-orange-600 border-orange-200",
  },
  ot_no_start: {
    label: "OT ไม่มี Log",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const TIMELINE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; dot: string }
> = {
  arrive_factory: {
    label: "Check-in (Factory)",
    icon: "✅",
    color: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  leave_factory: {
    label: "Check-out (Factory)",
    icon: "🚪",
    color: "text-slate-600",
    dot: "bg-slate-400",
  },
  onsite_checkin: {
    label: "Check-in (On-site)",
    icon: "📍",
    color: "text-blue-700",
    dot: "bg-blue-500",
  },
  onsite_checkout: {
    label: "Check-out (On-site)",
    icon: "🏁",
    color: "text-slate-600",
    dot: "bg-slate-400",
  },
  onsite_early_leave: {
    label: "Early Leave",
    icon: "⚡",
    color: "text-amber-700",
    dot: "bg-amber-500",
  },
  transit_start: {
    label: "เริ่มเดินทางกลับ",
    icon: "🚌",
    color: "text-purple-700",
    dot: "bg-purple-400",
  },
  ot_start: {
    label: "เริ่ม OT",
    icon: "⏰",
    color: "text-orange-700",
    dot: "bg-orange-500",
  },
  ot_end: {
    label: "สิ้นสุด OT",
    icon: "🏆",
    color: "text-orange-700",
    dot: "bg-orange-400",
  },
  break_start: {
    label: "พักเที่ยง",
    icon: "☕",
    color: "text-slate-500",
    dot: "bg-slate-300",
  },
  break_end: {
    label: "กลับมาทำงาน",
    icon: "▶️",
    color: "text-slate-600",
    dot: "bg-slate-400",
  },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+07:00");
  return d.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function prevDate(d: string): string {
  const dt = new Date(d + "T12:00:00Z");
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().split("T")[0];
}

function nextDate(d: string): string {
  const dt = new Date(d + "T12:00:00Z");
  dt.setDate(dt.getDate() + 1);
  return dt.toISOString().split("T")[0];
}

function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url: string | null;
  size?: "sm" | "md";
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sz} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sz} rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center font-bold text-white flex-shrink-0`}
    >
      {initials || "?"}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.absent;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function AnomalyBadge({ code }: { code: string }) {
  const cfg = ANOMALY_CONFIG[code];
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${cfg.color}`}
    >
      ⚠ {cfg.label}
    </span>
  );
}

function TimeChip({
  label,
  time,
  variant,
}: {
  label: string;
  time: string | null;
  variant: "green" | "red" | "orange" | "slate";
}) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-red-50 text-red-600 border-red-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    slate: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <div
      className={`flex flex-col items-center px-3 py-2 rounded-xl border ${colors[variant]}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-0.5">
        {label}
      </span>
      <span className="font-mono font-bold text-sm">{time ?? "—"}</span>
    </div>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) {
    return (
      <p className="text-xs text-slate-400 italic py-2">ไม่มีข้อมูล Timeline</p>
    );
  }
  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
      <div className="flex flex-col gap-4">
        {events.map((ev, i) => {
          const cfg = TIMELINE_CONFIG[ev.event] ?? {
            label: ev.event,
            icon: "•",
            color: "text-slate-600",
            dot: "bg-slate-300",
          };
          const time = new Date(ev.timestamp).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Asia/Bangkok",
          });
          return (
            <div key={i} className="flex items-start gap-3 relative">
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 border-white flex-shrink-0 mt-0.5 ${cfg.dot} shadow-sm z-10`}
                style={{ marginLeft: "-7px" }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${cfg.color}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {time}
                  </span>
                </div>
                {ev.note && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{ev.note}</p>
                )}
                {ev.site_name && (
                  <p className="text-[11px] text-blue-600 mt-0.5">
                    📍 {ev.site_name}
                  </p>
                )}
                {ev.checkout_type && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {ev.checkout_type === "early"
                      ? "Early Leave"
                      : "Group Checkout"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportTable({ items }: { items: ReportItem[] }) {
  if (!items.length) {
    return <p className="text-xs text-slate-400 italic py-2">ยังไม่มีรายการ</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-0.5 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {item.endUserName && (
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                {item.endUserName}
              </span>
            )}
            {item.projectNo && (
              <span className="text-[11px] text-slate-500 font-mono">
                #{item.projectNo}
              </span>
            )}
            {item.projectName && (
              <span className="text-[11px] text-slate-600 font-medium">
                {item.projectName}
              </span>
            )}
          </div>
          {item.workDetail && (
            <p className="text-xs text-slate-700 mt-0.5">
              📋 {item.workDetail}
            </p>
          )}
          {(item.periodStart || item.periodLabel) && (
            <p className="text-[11px] text-slate-400 font-mono">
              {item.periodLabel ??
                `${item.periodStart ?? ""} – ${item.periodEnd ?? ""}`}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Google Maps link helper ──────────────────────────────────────────────────

function OnsiteMapLink({ checkInEvent }: { checkInEvent?: TimelineEvent }) {
  // In future, GPS coords might be in the event payload
  // For now show a search link with site name
  return null;
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function EmployeeCard({ emp }: { emp: AuditEmployee }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"timeline" | "report" | "onsite">(
    "timeline",
  );

  const fullName = `${emp.firstName} ${emp.lastName}`.trim() || "—";
  const workCfg = emp.workType ? WORK_TYPE_CONFIG[emp.workType] : null;

  const hasReport = emp.reportFiled;
  const hasOnsite = !!emp.onsiteSession;
  const isAbsent = !emp.checkIn && emp.attendanceStatus !== "leave";

  // ── Work duration bar ──────────────────────────────────────────────────
  const workBarPercent = useMemo(() => {
    if (!emp.rawCheckIn) return 0;
    const start = new Date(emp.rawCheckIn).getTime();
    const end = emp.rawCheckOut
      ? new Date(emp.rawCheckOut).getTime()
      : Date.now();
    const minutes = (end - start) / 60000;
    return Math.min(100, (minutes / 480) * 100); // 8 hours = 100%
  }, [emp.rawCheckIn, emp.rawCheckOut]);

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200
      ${expanded ? "border-sky-200 shadow-sky-50/50" : "border-slate-100 hover:border-slate-200"}`}
    >
      {/* ── Card Header ─────────────────────────────────────────────────── */}
      <button
        onClick={() => !isAbsent && setExpanded((v) => !v)}
        className={`w-full text-left p-4 ${isAbsent ? "cursor-default" : "cursor-pointer"}`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative">
            <Avatar name={fullName} url={emp.avatarUrl} />
            {workCfg && (
              <span
                className="absolute -bottom-0.5 -right-0.5 text-sm leading-none"
                title={workCfg.label}
              >
                {workCfg.icon}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800 text-sm">
                {fullName}
              </span>
              <StatusBadge status={emp.attendanceStatus} />
              {emp.anomalies.map((a) => (
                <AnomalyBadge key={a} code={a} />
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {emp.department}
              {emp.onsiteSession && (
                <span className="ml-2 text-blue-500">
                  📍 {emp.onsiteSession.siteName}
                </span>
              )}
            </p>

            {/* Time row */}
            {!isAbsent && emp.attendanceStatus !== "leave" && (
              <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">เข้า</span>
                  <span className="font-mono font-semibold text-emerald-600">
                    {emp.checkIn ?? "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">ออก</span>
                  <span className="font-mono font-semibold text-slate-500">
                    {emp.checkOut ?? "—"}
                  </span>
                </div>
                {emp.otHours > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">OT</span>
                    <span className="font-mono font-semibold text-orange-600">
                      {emp.otHours}h
                    </span>
                  </div>
                )}
                <div
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                  ${hasReport ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                >
                  {hasReport ? "✅ รายงาน" : "📝 ยังไม่รายงาน"}
                </div>
              </div>
            )}

            {/* Work duration bar */}
            {emp.rawCheckIn && (
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      emp.otHours > 0
                        ? "bg-gradient-to-r from-emerald-400 via-blue-400 to-orange-400"
                        : "bg-gradient-to-r from-emerald-400 to-blue-400"
                    }`}
                    style={{ width: `${workBarPercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 w-6 text-right">
                  {workBarPercent < 100
                    ? `${Math.round(workBarPercent)}%`
                    : "✓"}
                </span>
              </div>
            )}
          </div>

          {/* Chevron */}
          {!isAbsent && (
            <span
              className={`text-slate-300 text-lg mt-1 transition-transform duration-200 flex-shrink-0
              ${expanded ? "rotate-180" : ""}`}
            >
              ▾
            </span>
          )}
        </div>

        {/* Leave / Absent note */}
        {emp.attendanceStatus === "leave" && (
          <p className="mt-2 text-xs text-violet-500 bg-violet-50 px-3 py-1.5 rounded-lg">
            💜 พนักงานลาวันนี้
          </p>
        )}
        {isAbsent && (
          <p className="mt-2 text-xs text-red-400 bg-red-50 px-3 py-1.5 rounded-lg">
            ❌ ไม่มีข้อมูลการเข้างาน
          </p>
        )}
      </button>

      {/* ── Expanded Detail ──────────────────────────────────────────────── */}
      {expanded && !isAbsent && (
        <div className="border-t border-slate-100">
          {/* Time Summary Row */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex gap-2 flex-wrap">
              <TimeChip label="Check-in" time={emp.checkIn} variant="green" />
              <TimeChip label="Check-out" time={emp.checkOut} variant="red" />
              {(emp.otStart || emp.otHours > 0) && (
                <>
                  <TimeChip
                    label="OT Start"
                    time={emp.otStart}
                    variant="orange"
                  />
                  <TimeChip label="OT End" time={emp.otEnd} variant="orange" />
                </>
              )}
            </div>

            {/* OT Request info */}
            {emp.otRequest && (
              <div className="mt-2.5 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-orange-700">
                    📋 OT Request
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium
                    ${
                      emp.otRequest.status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : emp.otRequest.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-600"
                    }`}
                  >
                    {emp.otRequest.status === "approved"
                      ? "✓ Approved"
                      : emp.otRequest.status === "pending"
                        ? "⏳ Pending"
                        : "✗ Rejected"}
                  </span>
                  <span className="font-mono text-orange-600">
                    {emp.otRequest.startTime} – {emp.otRequest.endTime}
                  </span>
                  {emp.otRequest.hours && (
                    <span className="text-orange-700 font-semibold">
                      {emp.otRequest.hours}h
                    </span>
                  )}
                </div>
                {emp.otRequest.reason && (
                  <p className="text-slate-500 mt-1">{emp.otRequest.reason}</p>
                )}
              </div>
            )}

            {/* Allowance / Pay info */}
            <div className="mt-2.5 flex gap-2 flex-wrap text-[11px]">
              {emp.dailyAllowance && (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                  💰 Daily Allowance
                </span>
              )}
              {emp.payMultiplier > 1 && (
                <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                  ✕{emp.payMultiplier} Pay
                  {emp.holidayName ? ` (${emp.holidayName})` : ""}
                </span>
              )}
              {emp.autoCheckedOut && (
                <span className="bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full">
                  🤖 Auto Checked-out
                </span>
              )}
              {emp.regularHours > 0 && (
                <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                  ⏱ {emp.regularHours}h ปกติ
                </span>
              )}
              {emp.otHours > 0 && (
                <span className="bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">
                  ⚡ {emp.otHours}h OT
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 bg-white">
            {(
              ["timeline", "report", ...(hasOnsite ? ["onsite"] : [])] as const
            ).map((tab) => {
              const labels: Record<string, string> = {
                timeline: "📅 Timeline",
                report: "📝 Report",
                onsite: "📍 On-site",
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-all
                    ${
                      activeTab === tab
                        ? "text-sky-600 border-b-2 border-sky-500 bg-sky-50/30"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                >
                  {labels[tab]}
                  {tab === "report" && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px]
                      ${hasReport ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                    >
                      {hasReport ? emp.reportItems.length : "0"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === "timeline" && (
              <Timeline events={emp.timelineEvents} />
            )}

            {activeTab === "report" &&
              (hasReport ? (
                <ReportTable items={emp.reportItems} />
              ) : (
                <div className="text-center py-6">
                  <div className="text-3xl mb-2">📝</div>
                  <p className="text-sm text-slate-400">
                    ยังไม่ได้กรอก Daily Report
                  </p>
                </div>
              ))}

            {activeTab === "onsite" && emp.onsiteSession && (
              <div className="space-y-3">
                {/* Site info */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">📍</span>
                    <div>
                      <p className="font-semibold text-blue-800 text-sm">
                        {emp.onsiteSession.siteName}
                      </p>
                      {emp.onsiteSession.endUserName && (
                        <p className="text-xs text-blue-600 mt-0.5">
                          👤 {emp.onsiteSession.endUserName}
                          {emp.onsiteSession.projectNo &&
                            ` · #${emp.onsiteSession.projectNo}`}
                          {emp.onsiteSession.projectName &&
                            ` · ${emp.onsiteSession.projectName}`}
                        </p>
                      )}
                      {emp.onsiteSession.sessionCode && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Code: {emp.onsiteSession.sessionCode}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session times */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">
                      Group Check-in
                    </p>
                    <p className="font-mono font-bold text-emerald-700 text-sm">
                      {emp.onsiteSession.groupCheckIn ?? "—"}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1">
                      Group Check-out
                    </p>
                    <p className="font-mono font-bold text-slate-600 text-sm">
                      {emp.onsiteSession.groupCheckOut ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Session status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">สถานะ Session:</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${
                      emp.onsiteSession.status === "closed"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {emp.onsiteSession.status === "closed"
                      ? "✓ ปิดแล้ว"
                      : "🟢 กำลังทำงาน"}
                  </span>
                </div>

                {/* Google Maps link (if site name available) */}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(emp.onsiteSession.siteName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl px-3 py-2.5 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  ดูแผนที่บน Google Maps
                  <span className="ml-auto text-blue-400">↗</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function AuditClient({
  employees,
  summary,
  auditDate,
}: {
  employees: AuditEmployee[];
  summary: AuditSummary;
  auditDate: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const today = todayBangkok();
  const isToday = auditDate === today;

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const fullName =
        `${emp.firstName} ${emp.lastName} ${emp.department}`.toLowerCase();
      const matchSearch = !search || fullName.includes(search.toLowerCase());
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "present" &&
          (emp.attendanceStatus === "on_time" ||
            emp.attendanceStatus === "late")) ||
        (filterStatus === "absent" &&
          !emp.checkIn &&
          emp.attendanceStatus !== "leave") ||
        (filterStatus === "onsite" && emp.workType === "on_site") ||
        (filterStatus === "ot" && emp.otHours > 0) ||
        (filterStatus === "no_report" && emp.checkIn && !emp.reportFiled);
      return matchSearch && matchStatus;
    });
  }, [employees, search, filterStatus]);

  function navigate(date: string) {
    router.push(`/audit?date=${date}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm">
        <div className="px-6 py-3">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-base font-bold text-slate-800">
                Daily Audit
              </h1>
              <p className="text-xs text-slate-400">
                {fmtDisplayDate(auditDate)}
              </p>
            </div>
            {/* Date navigation */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate(prevDate(auditDate))}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-sm"
              >
                ‹
              </button>
              <input
                type="date"
                value={auditDate}
                onChange={(e) => navigate(e.target.value)}
                className="text-xs font-mono border border-slate-200 rounded-xl px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
              <button
                onClick={() => navigate(nextDate(auditDate))}
                disabled={auditDate >= today}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-sm disabled:opacity-30"
              >
                ›
              </button>
              {!isToday && (
                <button
                  onClick={() => navigate(today)}
                  className="text-xs px-2.5 py-1.5 rounded-xl bg-sky-100 text-sky-700 hover:bg-sky-200 font-medium transition-colors"
                >
                  วันนี้
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="ค้นหาพนักงาน..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100 rounded-xl border-transparent focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition-all"
            />
          </div>
        </div>
      </div>

      <div className="px-6 pt-4 space-y-4">
        {/* ── Summary Grid ──────────────────────────────────────────────── */}
        <div className="flex gap-3">
          {[
            {
              label: "ทั้งหมด",
              value: summary.total,
              sub: "คน",
              color: "text-slate-700",
            },
            {
              label: "เข้างาน",
              value: summary.present,
              sub: `สาย ${summary.late}`,
              color: "text-emerald-600",
            },
            {
              label: "ขาดงาน",
              value: summary.absent,
              sub: "คน",
              color: "text-red-500",
            },
            {
              label: "On-site",
              value: summary.onsite,
              sub: "คน",
              color: "text-blue-600",
            },
            {
              label: "มี OT",
              value: summary.withOT,
              sub: "คน",
              color: "text-orange-600",
            },
            {
              label: "รายงาน",
              value: `${summary.reportFiled}/${summary.total}`,
              sub: "ส่งแล้ว",
              color: "text-sky-600",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex-1 bg-white rounded-2xl border border-slate-100 p-3 shadow-sm"
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {item.label}
              </p>
              <p className={`text-2xl font-bold mt-1 ${item.color}`}>
                {item.value}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Filter Pills ───────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {[
            { key: "all", label: `ทั้งหมด (${employees.length})` },
            { key: "present", label: `เข้างาน (${summary.present})` },
            { key: "absent", label: `ขาดงาน (${summary.absent})` },
            { key: "onsite", label: `On-site (${summary.onsite})` },
            { key: "ot", label: `มี OT (${summary.withOT})` },
            { key: "no_report", label: "ยังไม่รายงาน" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all
                ${
                  filterStatus === f.key
                    ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Employee List ──────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm">ไม่พบข้อมูลตามที่ค้นหา</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((emp) => (
              <EmployeeCard key={emp.id} emp={emp} />
            ))}
          </div>
        )}

        <p className="text-[10px] text-slate-300 pt-2">
          Time Tracker V2 · Daily Audit · {filtered.length} คน
        </p>
      </div>
    </div>
  );
}
