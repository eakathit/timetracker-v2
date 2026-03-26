// src/app/(dashboard)/audit/types.ts

export interface OnsiteSessionRow {
  id: string;
  site_name: string;
  status: string;
  group_check_in: string | null;
  group_check_out: string | null;
  session_code: string | null;
  projects: {
    project_no: string;
    name: string | null;
    end_users: { name: string } | null;
  } | null; 
}

export interface ReportItem {
  id: string;
  endUserName: string | null;
  projectNo: string | null;
  projectName: string | null;
  workDetail: string | null;
  periodType: string;
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
}

export interface OnsiteInfo {
  id: string;
  siteName: string;
  status: string;
  groupCheckIn: string | null;
  groupCheckOut: string | null;
  rawCheckIn: string | null;
  rawCheckOut: string | null;
  sessionCode: string | null;
  projectNo: string | null;
  projectName: string | null;
  endUserName: string | null;
}

export interface OTRequestInfo {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  hours: number | null;
  reason: string;
  actionedByName: string | null;
}

export interface TimelineEvent {
  event: string;
  timestamp: string;
  method?: string;
  location?: string;
  session_id?: string;
  site_name?: string;
  note?: string;
  checkout_type?: string;
  synced_from?: string;
}

export interface AuditEmployee {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  role: string;
  avatarUrl: string | null;

  // Attendance
  attendanceStatus: "on_time" | "late" | "absent" | "leave" | "active";
  workType: "in_factory" | "on_site" | "mixed" | null;
  checkIn: string | null;
  checkOut: string | null;
  rawCheckIn: string | null;
  rawCheckOut: string | null;
  otHours: number;
  regularHours: number;
  dayType: string;
  holidayName: string | null;
  autoCheckedOut: boolean;
  dailyAllowance: boolean;
  payMultiplier: number;

  // OT
  otStart: string | null;
  otEnd: string | null;
  otRequest: OTRequestInfo | null;

  // Timeline
  timelineEvents: TimelineEvent[];

  // Report
  reportFiled: boolean;
  reportItems: ReportItem[];

  // On-site
  onsiteSession: OnsiteInfo | null;

  // Anomalies
  anomalies: string[];
}

export interface AuditSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  onsite: number;
  factory: number;
  withOT: number;
  reportFiled: number;
}