// src/app/(dashboard)/time-sync/page.tsx
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TimeSyncClient from "./TimeSyncClient";
import type {
  EmployeeSyncRecord,
  SyncPeriod,
  SyncStatus,
  SyncSummary,
  TimeGap,
} from "./types";

// ─── Supabase server client ────────────────────────────────────────────────────
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// ─── Time helpers ──────────────────────────────────────────────────────────────
function getBangkokDateStr(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** Convert ISO timestamp → "HH:mm" in Bangkok timezone */
function isoToHHMM(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  });
}

/** "HH:mm" or "HH:mm:ss" → minutes since midnight */
function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** minutes → "HH:mm" */
function fromMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Parse period start/end from a report item.
 * - some_time: use period_start / period_end columns directly
 * - fixed: parse from period_label e.g. "ALL (08:30 – 17:30)"
 */
function extractPeriodTimes(item: {
  period_type: string;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
}): { start: string; end: string } | null {
  if (item.period_type === "some_time") {
    const s = item.period_start?.slice(0, 5);
    const e = item.period_end?.slice(0, 5);
    if (s && e) return { start: s, end: e };
    return null;
  }
  // Parse from label: "ALL (08:30 – 17:30)" or "HALF DAY (13:00 – 17:30)"
  const match = (item.period_label ?? "").match(
    /\((\d{2}:\d{2})\s*[–\-]\s*(\d{2}:\d{2})\)/
  );
  if (match) return { start: match[1], end: match[2] };
  return null;
}

/**
 * Compute uncovered gaps within [workStart, workEnd]
 * given a list of covered [start, end] intervals.
 */

// ── Lunch break exclusion window (auto-forgiven) ───────────────────────────
const LUNCH_START = 12 * 60; // 12:00
const LUNCH_END   = 13 * 60; // 13:00

function computeGaps(
  workStartMins: number,
  workEndMins: number,
  coveredPeriods: Array<{ start: number; end: number }>
): TimeGap[] {
  if (workEndMins <= workStartMins) return [];

  // Auto-inject lunch break as "covered" if work window spans across it
  const periodsWithLunch = [...coveredPeriods];
  if (workStartMins < LUNCH_END && workEndMins > LUNCH_START) {
    periodsWithLunch.push({ start: LUNCH_START, end: LUNCH_END });
  }

  // Clamp periods to work window
  const clamped = periodsWithLunch
    .map((p) => ({
      start: Math.max(p.start, workStartMins),
      end: Math.min(p.end, workEndMins),
    }))
    .filter((p) => p.start < p.end);

  // Sort & merge overlapping intervals
  clamped.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const p of clamped) {
    if (!merged.length || p.start > merged[merged.length - 1].end) {
      merged.push({ ...p });
    } else {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        p.end
      );
    }
  }

  // Find gaps between merged intervals
  const gaps: TimeGap[] = [];
  let cursor = workStartMins;
  for (const m of merged) {
    if (m.start > cursor) {
      gaps.push({
        from: fromMins(cursor),
        to: fromMins(m.start),
        minutes: m.start - cursor,
      });
    }
    cursor = Math.max(cursor, m.end);
  }
  if (cursor < workEndMins) {
    gaps.push({
      from: fromMins(cursor),
      to: fromMins(workEndMins),
      minutes: workEndMins - cursor,
    });
  }
  return gaps;
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function TimeSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const supabase = await getSupabase();

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!me || (me.role !== "admin" && me.role !== "manager")) {
    redirect("/");
  }

  // ── Resolve date ────────────────────────────────────────────────────────────
  const syncDate = dateParam ?? getBangkokDateStr();

  // ── Fetch data in parallel ──────────────────────────────────────────────────
  const [profilesRes, timeLogsRes, reportsRes] = await Promise.all([
    supabase
      .from("profiles_with_avatar")
      .select("id, first_name, last_name, department, role, avatar_url")
      .order("first_name"),

    supabase
      .from("daily_time_logs")
      .select(
        "user_id, first_check_in, last_check_out, status, auto_checked_out, timeline_events"
      )
      .eq("log_date", syncDate),

    supabase
      .from("daily_reports")
      .select(
        `id, user_id,
         daily_report_items (
           id, period_type, period_start, period_end, period_label,
           end_users ( name ),
           projects ( project_no, name ),
           work_details ( title )
         )`
      )
      .eq("report_date", syncDate),
  ]);

  const profiles = profilesRes.data ?? [];
  const timeLogs = timeLogsRes.data ?? [];
  const reports = reportsRes.data ?? [];

  // ── Build lookup maps ───────────────────────────────────────────────────────
  const logMap = new Map(timeLogs.map((l) => [l.user_id, l]));
  const reportMap = new Map(reports.map((r) => [r.user_id, r]));

  // ── Assemble EmployeeSyncRecord list ────────────────────────────────────────
  // Only include employees who have a time log (they actually worked today)
  const workingProfiles = profiles.filter((p) => logMap.has(p.id));

  const records: EmployeeSyncRecord[] = workingProfiles.map((p) => {
    const log = logMap.get(p.id)!;
    const report = reportMap.get(p.id);

    const checkIn = isoToHHMM(log.first_check_in ?? null);
    const checkOut = isoToHHMM(log.last_check_out ?? null);
    const workStartMins = checkIn ? toMins(checkIn) : null;
    const workEndMins = checkOut ? toMins(checkOut) : null;
    const workMinutes =
      workStartMins != null && workEndMins != null
        ? Math.max(0, workEndMins - workStartMins)
        : 0;

    const hasLog = !!log.first_check_in;
    const hasReport = !!report;

    // ── Parse report periods ─────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems: any[] = report ? (report.daily_report_items as any[]) : [];
    const reportPeriods: SyncPeriod[] = rawItems
      .map((item) => {
        const times = extractPeriodTimes({
          period_type: item.period_type,
          period_start: item.period_start ?? null,
          period_end: item.period_end ?? null,
          period_label: item.period_label ?? null,
        });
        if (!times) return null;
        return {
          id: item.id,
          periodLabel: item.period_label ?? null,
          periodStart: times.start,
          periodEnd: times.end,
          endUserName: item.end_users?.name ?? null,
          projectNo: item.projects?.project_no ?? null,
          workDetail: item.work_details?.title ?? null,
        } satisfies SyncPeriod;
      })
      .filter(Boolean) as SyncPeriod[];
    
      // ── Extract OT window from timeline_events ───────────────────────────────  ← เพิ่มตรงนี้
    const timelineEvents = (log.timeline_events ?? []) as { event: string; timestamp: string }[];
    const otStartEvent = timelineEvents.find((e) => e.event === "ot_start");
    const otEndEvent   = timelineEvents.find((e) => e.event === "ot_end");
    const otStart = otStartEvent ? isoToHHMM(otStartEvent.timestamp) : null;
    const otEnd   = otEndEvent   ? isoToHHMM(otEndEvent.timestamp)   : null;

    // ── Compute coverage & gaps ──────────────────────────────────────────────
    let coveredMinutes = 0;
    let gaps: TimeGap[] = [];
    let coveragePercent = 0;

    if (workStartMins != null && workEndMins != null && workMinutes > 0) {
      const coveredIntervals = reportPeriods.map((rp) => ({
        start: toMins(rp.periodStart),
        end: toMins(rp.periodEnd),
      }));

      const coveredIntervalsWithOT = [...coveredIntervals];
      if (otStart && otEnd) {
        coveredIntervalsWithOT.push({
          start: toMins(otStart),
          end:   toMins(otEnd),
        });
      }

      gaps = computeGaps(workStartMins, workEndMins, coveredIntervalsWithOT);
      const uncovered = gaps.reduce((acc, g) => acc + g.minutes, 0);
      coveredMinutes = Math.max(0, workMinutes - uncovered);
      coveragePercent =
        workMinutes > 0
          ? Math.round((coveredMinutes / workMinutes) * 100)
          : 0;
    }

    const uncoveredMinutes = gaps.reduce((acc, g) => acc + g.minutes, 0);

    // ── คำนวณ over-claimed ──────────────────────────────────────────────────  ← เพิ่มตรงนี้
    let overclaimedMinutes = 0;
    if (workStartMins != null && workEndMins != null) {
      for (const rp of reportPeriods) {
        const rpStart = toMins(rp.periodStart);
        const rpEnd   = toMins(rp.periodEnd);
        if (rpStart < workStartMins) overclaimedMinutes += workStartMins - rpStart;
        if (rpEnd   > workEndMins)   overclaimedMinutes += rpEnd - workEndMins;
      }
    }

    // ── Determine sync status ────────────────────────────────────────────────
    let syncStatus: SyncStatus;
    if (!hasLog) {
      syncStatus = "no_log";
    } else if (!hasReport) {
      syncStatus = "no_report";
    } else if (coveragePercent >= 90) {
      syncStatus = "synced";
    } else {
      syncStatus = "partial";
    }

    return {
      id: p.id,
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      department: p.department ?? "—",
      avatarUrl: p.avatar_url ?? null,
      hasLog,
      checkIn,
      checkOut,
      workMinutes,
      isAutoCheckout: log.auto_checked_out ?? false,
      hasReport,
      reportPeriods,
      coveredMinutes,
      syncStatus,
      coveragePercent,
      gaps,
      uncoveredMinutes,
      overclaimedMinutes,
      otStart,
      otEnd,
    };
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  const summary: SyncSummary = {
    total: records.length,
    synced: records.filter((r) => r.syncStatus === "synced").length,
    partial: records.filter((r) => r.syncStatus === "partial").length,
    noReport: records.filter((r) => r.syncStatus === "no_report").length,
    noLog: records.filter((r) => r.syncStatus === "no_log").length,
  };

  return (
    <TimeSyncClient
      records={records}
      summary={summary}
      syncDate={syncDate}
    />
  );
}