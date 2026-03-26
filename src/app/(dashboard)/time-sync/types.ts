// src/app/(dashboard)/time-sync/types.ts

export type SyncStatus = "synced" | "partial" | "no_report" | "no_log";

export interface SyncPeriod {
  id: string;
  periodLabel: string | null;
  periodStart: string; // HH:mm
  periodEnd: string;   // HH:mm
  endUserName: string | null;
  projectNo: string | null;
  workDetail: string | null;
}

export interface TimeGap {
  from: string;    // HH:mm
  to: string;      // HH:mm
  minutes: number;
}

export interface EmployeeSyncRecord {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  avatarUrl: string | null;

  // Time log
  hasLog: boolean;
  checkIn: string | null;   // HH:mm Bangkok
  checkOut: string | null;  // HH:mm Bangkok
  otStart: string | null;  // HH:mm
  otEnd:   string | null;  // HH:mm
  workMinutes: number;
  isAutoCheckout: boolean;

  // Report
  hasReport: boolean;
  reportPeriods: SyncPeriod[];
  coveredMinutes: number;

  // Analysis
  syncStatus: SyncStatus;
  coveragePercent: number; // 0–100
  gaps: TimeGap[];
  uncoveredMinutes: number;
  overclaimedMinutes: number; // นาทีที่ report อ้างก่อน check-in หรือหลัง check-out
}

export interface SyncSummary {
  total: number;
  synced: number;
  partial: number;
  noReport: number;
  noLog: number;
}