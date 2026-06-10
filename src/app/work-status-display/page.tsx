"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type PersonProfile = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type WorkItem = {
  id: string;
  period: string | null;
  customer: string | null;
  projectNo: string | null;
  detail: string;
};

type StatusEntry = {
  id: string;
  user_id: string;
  work_type: string;
  first_check_in: string;
  last_check_out: string | null;
  onsite_location: string | null;
  onsite_status: string | null;
  onsite_group_check_in: string | null;
  onsite_group_check_out: string | null;
  onsite_exit_time: string | null;
  onsite_exit_label: string | null;
  onsite_map_url: string | null;
  report_id: string | null;
  profiles: PersonProfile | null;
  work_items: WorkItem[];
};

type LeaveEntry = {
  id: string;
  user_id: string;
  leave_label: string;
  period_label: string | null;
  hours: number | null;
  reason: string | null;
  profiles: PersonProfile | null;
};

type DisplayStatusResponse = {
  date: string;
  checkins: StatusEntry[];
  leaves: LeaveEntry[];
  summary: {
    total_checkins: number;
    factory: number;
    onsite: number;
    leave: number;
  };
};

const AVATAR_COLORS = [
  "bg-slate-700", "bg-blue-600", "bg-emerald-600", "bg-sky-600",
  "bg-rose-500", "bg-indigo-600", "bg-teal-600", "bg-amber-500",
];

const avatarColor = (id: string) =>
  AVATAR_COLORS[id.charCodeAt(0) % AVATAR_COLORS.length];

const fullName = (profile: PersonProfile | null) =>
  [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";

const initials = (profile: PersonProfile | null) =>
  ((profile?.first_name?.[0] ?? "") + (profile?.last_name?.[0] ?? "")).toUpperCase() || "?";

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      })
    : null;

const fmtNum = (value: number) =>
  Number.isInteger(value) ? value.toString() : parseFloat(value.toFixed(2)).toString();

const cleanProjectNo = (projectNo: string) => projectNo.replace(/^#\s*/, "");
const FALLBACK_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const REALTIME_REFRESH_DEBOUNCE_MS = 1500;

function getDisplayDate() {
  return new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
}

function leaveDetail(entry: LeaveEntry) {
  const rawPeriod = entry.period_label?.trim() || null;
  const isFullDay = rawPeriod === "ทั้งวัน";
  const period = rawPeriod && !isFullDay ? rawPeriod : null;
  const hours = Number(entry.hours ?? 0);
  const duration = hours > 0 && !isFullDay ? `${fmtNum(hours)} ชม.` : null;
  return {
    label: entry.leave_label,
    period: period ?? (isFullDay || !rawPeriod ? "ทั้งวัน" : null),
    duration,
  };
}

function Avatar({ userId, profile }: { userId: string; profile: PersonProfile | null }) {
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        referrerPolicy="no-referrer"
        alt={fullName(profile)}
        className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-white shadow-sm"
      />
    );
  }

  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${avatarColor(userId)} text-sm font-bold text-white shadow-sm ring-2 ring-white`}
    >
      {initials(profile)}
    </span>
  );
}

function IconFactory() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 10.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3M4 11h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6M7 3h7l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  );
}

function WorkItems({ items }: { items: WorkItem[] }) {
  if (items.length === 0) {
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
        <IconReport />
        No report
      </div>
    );
  }

  const visibleItems = items.slice(0, 2);
  const moreCount = items.length - visibleItems.length;

  return (
    <div className="mt-3 space-y-2">
      {visibleItems.map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.025)]">
          <div className="grid min-w-0 grid-cols-[1.35fr_1fr_1fr] gap-2">
            {item.period && (
              <div className="min-w-0 rounded-md bg-slate-50 px-2.5 py-1.5">
                <p className="text-[10px] font-bold tracking-wide text-slate-900">Time</p>
                <p className="mt-0.5 whitespace-nowrap font-mono text-[11px] font-semibold text-slate-600">{item.period}</p>
              </div>
            )}
            {item.projectNo && (
              <div className="min-w-0 rounded-md bg-slate-50 px-2.5 py-1.5">
                <p className="text-[10px] font-bold tracking-wide text-slate-900">Project No.</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">{cleanProjectNo(item.projectNo)}</p>
              </div>
            )}
            {item.customer && (
              <div className="min-w-0 rounded-md bg-slate-50 px-2.5 py-1.5">
                <p className="text-[10px] font-bold tracking-wide text-slate-900">End User</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">{item.customer}</p>
              </div>
            )}
          </div>
          <div className="mt-2 flex min-w-0 items-start gap-2 border-t border-slate-100 pt-2">
            <span className="shrink-0 text-[10px] font-bold tracking-wide text-slate-900">Detail</span>
            <p className="line-clamp-1 min-w-0 text-xs font-semibold leading-snug text-slate-700">{item.detail}</p>
          </div>
        </div>
      ))}
      {moreCount > 0 && (
        <p className="px-1 text-[11px] font-semibold text-slate-400">
          + {moreCount} more reports
        </p>
      )}
    </div>
  );
}

function WorkEntryCard({
  entry,
  mode,
  statusDate,
}: {
  entry: StatusEntry;
  mode: "factory" | "onsite";
  statusDate: string;
}) {
  const checkIn = fmtTime(entry.first_check_in);
  const checkOut = fmtTime(entry.last_check_out);
  const onsiteExitTime = entry.onsite_exit_time ?? entry.onsite_group_check_out;
  const tone = mode === "factory"
    ? {
        border: "border-slate-100",
        badge: "border-blue-100 bg-blue-50/80 text-blue-700",
        soft: "bg-slate-50 text-slate-700 border-slate-100",
        icon: <IconFactory />,
      }
    : {
        border: "border-slate-100",
        badge: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
        soft: "bg-emerald-50/75 text-emerald-800 border-emerald-100",
        icon: <IconPin />,
      };

  return (
    <article className={`rounded-xl border ${tone.border} bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`}>
      <div className="flex items-start gap-3">
        <Avatar userId={entry.user_id} profile={entry.profiles} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-900">
                {fullName(entry.profiles)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                เข้า {checkIn ?? "-"} น.{checkOut ? ` · ออก ${checkOut} น.` : ""}
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone.badge}`}>
              {mode === "factory" ? "Factory" : "On-site"}
            </span>
          </div>

          {mode === "onsite" && (
            <div className={`mt-3 rounded-lg border px-3 py-2.5 ${tone.soft}`}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0">{tone.icon}</span>
                <p className="truncate text-xs font-bold">
                  {entry.onsite_location?.replace(/\s*·\s*#?/, " · Project No. ") ?? "On-site"}
                </p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-emerald-700/70">
                {entry.onsite_group_check_in && <span>เริ่ม {fmtTime(entry.onsite_group_check_in) ?? "-"}</span>}
                {onsiteExitTime && (
                  <span>
                    ออก {fmtTime(onsiteExitTime) ?? "-"}
                    {entry.onsite_exit_label && (
                      <span className="ml-1 font-bold text-emerald-700">({entry.onsite_exit_label})</span>
                    )}
                  </span>
                )}
                {entry.onsite_map_url && (
                  <a
                    href={entry.onsite_map_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-white"
                  >
                    <IconPin />
                    Google Maps
                  </a>
                )}
              </div>
            </div>
          )}

          <WorkItems items={entry.work_items} />
          {entry.report_id && statusDate && (
            <a
              href={`/audit?date=${encodeURIComponent(statusDate)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:border-slate-300"
            >
              <IconReport />
              View Report
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function LeaveRow({ entry }: { entry: LeaveEntry }) {
  const detail = leaveDetail(entry);

  return (
    <article className="rounded-xl border border-slate-100 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-3">
        <Avatar userId={entry.user_id} profile={entry.profiles} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">
            {fullName(entry.profiles)}
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1 text-xs leading-none text-rose-500">
            <span className="truncate font-semibold text-rose-600">{detail.label}</span>
            <span className="text-rose-300">·</span>
            <span className="whitespace-nowrap text-rose-500">{detail.period}</span>
            {detail.duration && (
              <span className="whitespace-nowrap text-rose-400">({detail.duration})</span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}

function StatusPanel({
  title,
  count,
  accent,
  icon,
  children,
}: {
  title: string;
  count: number;
  accent: "blue" | "emerald" | "rose";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    blue: {
      bar: "bg-blue-500",
      icon: "border-blue-100 bg-blue-50 text-blue-700",
      title: "text-slate-900",
      count: "border-blue-100 bg-blue-50/80 text-blue-700",
    },
    emerald: {
      bar: "bg-emerald-500",
      icon: "border-emerald-100 bg-emerald-50 text-emerald-700",
      title: "text-slate-900",
      count: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
    },
    rose: {
      bar: "bg-rose-500",
      icon: "border-rose-100 bg-rose-50 text-rose-700",
      title: "text-slate-900",
      count: "border-rose-100 bg-rose-50/80 text-rose-700",
    },
  }[accent];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/92 shadow-[0_10px_28px_rgba(15,23,42,0.045)]">
      <div className={`h-0.5 shrink-0 ${styles.bar}`} />
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${styles.icon}`}>
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className={`truncate text-sm font-bold leading-tight ${styles.title}`}>{title}</h2>
            <p className="mt-0.5 text-xs text-slate-400">{count} คน</p>
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${styles.count}`}>
          {count}
        </span>
      </div>
      <div className="display-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        {children}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/55 px-4 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-300 shadow-sm">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-500">{text}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-300">รอข้อมูลอัปเดตจากระบบ</p>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "blue" | "emerald" | "rose";
  icon: React.ReactNode;
}) {
  const styles = {
    blue: {
      shell: "border-slate-200 bg-white text-blue-700",
      icon: "border-blue-100 bg-blue-50 text-blue-700",
    },
    emerald: {
      shell: "border-slate-200 bg-white text-emerald-700",
      icon: "border-emerald-100 bg-emerald-50 text-emerald-700",
    },
    rose: {
      shell: "border-slate-200 bg-white text-rose-700",
      icon: "border-rose-100 bg-rose-50 text-rose-700",
    },
  }[color];

  return (
    <div className={`flex min-w-28 items-center justify-between gap-3 rounded-xl border px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${styles.shell}`}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${styles.icon}`}>
          {icon}
        </span>
        <span className="truncate text-xs font-bold text-slate-500">{label}</span>
      </div>
      <span className="text-lg font-extrabold leading-none tabular-nums tracking-normal">{value}</span>
    </div>
  );
}

export default function WorkStatusDisplayPage() {
  const [data, setData] = useState<DisplayStatusResponse>({
    date: "",
    checkins: [],
    leaves: [],
    summary: { total_checkins: 0, factory: 0, onsite: 0, leave: 0 },
  });
  const [currentDate] = useState(getDisplayDate);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await fetch("/api/display-today-status", { cache: "no-store" });
      if (!res.ok) return;
      setData(await res.json());
    } catch (err) {
      console.error("fetchStatus error:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (document.visibilityState === "hidden") return;

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      void fetchStatus();
    }, REALTIME_REFRESH_DEBOUNCE_MS);
  }, [fetchStatus]);

  useEffect(() => {
    document.title = "TimeTracker Work Status Display";
  }, []);

  useEffect(() => {
    const initialFetchId = window.setTimeout(fetchStatus, 0);

    const supabaseRealtime = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    const channel = supabaseRealtime
      .channel("work-status-display")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "daily_time_logs",
        filter: `log_date=eq.${today}`,
      }, scheduleRefresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "daily_reports",
        filter: `report_date=eq.${today}`,
      }, scheduleRefresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "daily_report_items",
      }, scheduleRefresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "onsite_sessions",
      }, scheduleRefresh)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "leave_requests",
      }, scheduleRefresh)
      .subscribe();

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchStatus();
      }
    }, FALLBACK_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchStatus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(initialFetchId);
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      supabaseRealtime.removeChannel(channel);
    };
  }, [fetchStatus, scheduleRefresh]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const factoryEntries = useMemo(
    () => data.checkins.filter((entry) => entry.work_type === "in_factory"),
    [data.checkins],
  );
  const onsiteEntries = useMemo(
    () => data.checkins.filter((entry) => entry.work_type !== "in_factory"),
    [data.checkins],
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#f5f7fb] p-5 text-slate-900">
      <section className="flex shrink-0 items-end justify-between gap-5 pb-4">
        <div className="min-w-0">
          <p className="text-sm font-extrabold tracking-wide text-slate-800">Today Work Status</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <p className="truncate text-sm font-bold text-slate-700">{currentDate}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <SummaryPill label="Factory" value={factoryEntries.length} color="blue" icon={<IconFactory />} />
          <SummaryPill label="On-site" value={onsiteEntries.length} color="emerald" icon={<IconPin />} />
          <SummaryPill label="Leave" value={data.leaves.length} color="rose" icon={<IconCalendar />} />
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "ออกจาก Fullscreen" : "เปิด Fullscreen"}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-300 hover:text-slate-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={isFullscreen
                  ? "M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                  : "M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"} />
            </svg>
            <span>{isFullscreen ? "ย่อหน้าจอ" : "เต็มหน้าจอ"}</span>
          </button>
        </div>
      </section>

      <main className="grid min-h-0 flex-1 grid-cols-[0.92fr_1.22fr_0.86fr] gap-3 overflow-hidden">
        <StatusPanel title="Factory" count={factoryEntries.length} accent="blue" icon={<IconFactory />}>
          {factoryEntries.length === 0 ? (
            <EmptyState text="ยังไม่มีพนักงาน Check-in Factory" />
          ) : (
            factoryEntries.map((entry) => (
              <WorkEntryCard key={entry.id} entry={entry} mode="factory" statusDate={data.date} />
            ))
          )}
        </StatusPanel>

        <StatusPanel title="On-site" count={onsiteEntries.length} accent="emerald" icon={<IconPin />}>
          {onsiteEntries.length === 0 ? (
            <EmptyState text="ยังไม่มีทีม On-site" />
          ) : (
            onsiteEntries.map((entry) => (
              <WorkEntryCard key={entry.id} entry={entry} mode="onsite" statusDate={data.date} />
            ))
          )}
        </StatusPanel>

        <StatusPanel title="Leave" count={data.leaves.length} accent="rose" icon={<IconCalendar />}>
          {data.leaves.length === 0 ? (
            <EmptyState text="ไม่มีพนักงานลาวันนี้" />
          ) : (
            data.leaves.map((entry) => <LeaveRow key={entry.id} entry={entry} />)
          )}
        </StatusPanel>
      </main>
    </div>
  );
}
