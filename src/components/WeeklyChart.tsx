"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface WeeklyChartProps {
  userId: string;
}

interface DayLog {
  log_date: string;
  first_check_in: string | null;
  last_check_out: string | null;
  ot_hours: number | null;
}

const DAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const CHART_H = 96; // px

function calcRegularHours(inTime: string | null, outTime: string | null): number {
  if (!inTime || !outTime) return 0;
  const checkIn = new Date(inTime);
  const checkOut = new Date(outTime);
  const at = (h: number, m: number) => {
    const d = new Date(checkIn);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const effStart = checkIn > at(8, 30) ? checkIn : at(8, 30);
  const effEnd = checkOut < at(17, 30) ? checkOut : at(17, 30);
  if (effEnd <= effStart) return 0;
  let ms = effEnd.getTime() - effStart.getTime();
  const bStart = effStart > at(12, 0) ? effStart : at(12, 0);
  const bEnd = effEnd < at(13, 0) ? effEnd : at(13, 0);
  if (bEnd > bStart) ms -= bEnd.getTime() - bStart.getTime();
  return Math.max(0, Number((ms / 3_600_000).toFixed(2)));
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDays(): string[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun ... 6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDateStr(d);
  });
}

export default function WeeklyChart({ userId }: WeeklyChartProps) {
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const days = useMemo(() => getWeekDays(), []);
  const todayStr = useMemo(() => localDateStr(new Date()), []);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("daily_time_logs")
      .select("log_date, first_check_in, last_check_out, ot_hours")
      .eq("user_id", userId)
      .gte("log_date", days[0])
      .lte("log_date", days[6])
      .then(({ data }) => {
        setLogs(data ?? []);
        setLoading(false);
      });
  }, [userId, days]);

  const dayData = useMemo(() => {
    return days.map((dateStr, i) => {
      const log = logs.find((l) => l.log_date === dateStr);
      const regular = calcRegularHours(
        log?.first_check_in ?? null,
        log?.last_check_out ?? null,
      );
      const ot = log?.ot_hours ?? 0;
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      return { label: DAY_LABELS[i], regular, ot, isToday, isFuture };
    });
  }, [days, logs, todayStr]);

  const maxHours = Math.max(8, ...dayData.map((d) => d.regular + d.ot));
  const totalRegular = dayData.reduce((s, d) => s + d.regular, 0);
  const totalOT = dayData.reduce((s, d) => s + d.ot, 0);

  return (
    <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">สรุปสัปดาห์นี้</h3>
        <span className="text-xs text-gray-400 font-medium">Weekly</span>
      </div>

      {/* Stat chips */}
      <div className="flex gap-3 mb-5">
        <div className="flex-1 bg-sky-50 rounded-xl px-3 py-2.5 text-center">
          <p className="text-[11px] text-sky-500 font-medium mb-0.5">ชั่วโมงปกติ</p>
          <p className="text-lg font-bold text-sky-600 leading-none">
            {totalRegular.toFixed(1)}
            <span className="text-xs font-medium ml-0.5">ชม.</span>
          </p>
        </div>
        {totalOT > 0 && (
          <div className="flex-1 bg-amber-50 rounded-xl px-3 py-2.5 text-center">
            <p className="text-[11px] text-amber-500 font-medium mb-0.5">OT</p>
            <p className="text-lg font-bold text-amber-600 leading-none">
              {totalOT.toFixed(1)}
              <span className="text-xs font-medium ml-0.5">ชม.</span>
            </p>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5" style={{ height: CHART_H + 20 }}>
        {loading
          ? Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-gray-100 rounded-t-md animate-pulse"
                  style={{ height: [48, 72, 60, 80, 56, 32, 20][i] }}
                />
                <div className="w-4 h-2.5 bg-gray-100 rounded animate-pulse" />
              </div>
            ))
          : dayData.map(({ label, regular, ot, isToday, isFuture }) => {
              const regularH = Math.round((regular / maxHours) * CHART_H);
              const otH = Math.round((ot / maxHours) * CHART_H);
              const hasData = regular > 0 || ot > 0;

              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  {/* Bar */}
                  <div
                    className="w-full flex flex-col justify-end overflow-hidden rounded-t-md"
                    style={{ height: CHART_H }}
                  >
                    {ot > 0 && (
                      <div
                        className="w-full bg-amber-400"
                        style={{ height: otH }}
                      />
                    )}
                    {regular > 0 ? (
                      <div
                        className={`w-full ${isToday ? "bg-sky-500" : "bg-sky-400"}`}
                        style={{ height: regularH }}
                      />
                    ) : !isFuture && !hasData ? (
                      <div className="w-full bg-gray-100" style={{ height: 3 }} />
                    ) : null}
                  </div>
                  {/* Day label */}
                  <span
                    className={`text-[11px] font-medium ${
                      isToday ? "text-sky-600 font-bold" : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" />
          ชั่วโมงปกติ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
          OT
        </span>
      </div>
    </div>
  );
}
