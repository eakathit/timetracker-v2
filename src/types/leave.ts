// types/leave.ts

export type LeaveType =
  | "sick"
  | "vacation"
  | "personal"
  | "special_personal"
  | "other"
  | "holiday_swap"

export type LeaveStatus = "pending" | "approved" | "rejected";

// ─── leave_policies ───────────────────────────────────────────
export interface LeavePolicy {
  id: string;
  leave_type: LeaveType;
  label_th: string;
  days_per_year: number;       // 0 = ไม่จำกัด
  max_carry_over: number;      // 0 = ไม่สะสม
  sick_paid_limit: number;     // เฉพาะ sick: วันที่ได้รับเงิน
  allow_hourly: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── leave_balances ───────────────────────────────────────────
export interface LeaveBalance {
  id: string;
  user_id: string;
  year: number;
  leave_type: LeaveType;
  entitled_days: number;
  carried_over_days: number;
  total_days: number;          // generated: entitled + carried_over
  used_days: number;
  pending_days: number;
  remaining_days: number;      // generated: total - used
  created_at: string;
  updated_at: string;
}

// View รวม policy + balance
export interface LeaveBalanceWithPolicy extends LeaveBalance {
  label_th: string;
  allow_hourly: boolean;
  sick_paid_limit: number;
  used_pct: number;
}

// ─── leave_requests (updated) ─────────────────────────────────
export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;          // "YYYY-MM-DD"
  end_date: string;            // "YYYY-MM-DD"
  days: number;                // generated
  hours: number | null;        // ใช้เมื่อ allow_hourly = true
  period_label: string | null; // "ทั้งวัน" | "ครึ่งเช้า" | "ครึ่งบ่าย"
  is_paid: boolean;            // set by trigger อัตโนมัติ
  reason: string;
  status: LeaveStatus;
  approved_by: string | null;
  reject_reason: string | null;
  actioned_at: string | null;
  created_at: string;
}

// ─── Admin settings form ──────────────────────────────────────
export interface LeavePolicyFormValues {
  days_per_year: number;
  max_carry_over: number;
  sick_paid_limit: number;
  allow_hourly: boolean;
  is_active: boolean;
}

// ─── Constants: UI config per leave type ─────────────────────
type LeaveTypeConfig = { label: string; icon: string; color: string; bg: string; border: string };

export const LEAVE_TYPE_CONFIG: Record<LeaveType, LeaveTypeConfig> = {
  vacation:         { label: "ลาพักร้อน",   icon: "🌴", color: "text-violet-600", bg: "bg-violet-100", border: "border-violet-200" },
  sick:             { label: "ลาป่วย",      icon: "🤒", color: "text-rose-500",   bg: "bg-rose-100",   border: "border-rose-200"   },
  personal:         { label: "ลากิจ",       icon: "📋", color: "text-amber-600",  bg: "bg-amber-100",  border: "border-amber-200"  },
  special_personal: { label: "ลากิจพิเศษ",  icon: "⭐", color: "text-sky-600",    bg: "bg-sky-100",    border: "border-sky-200"    },
  other:            { label: "ลาอื่นๆ",     icon: "📝", color: "text-gray-500",   bg: "bg-gray-200",   border: "border-gray-200"   },
  holiday_swap:     { label: "แลกวันหยุด",  icon: "🔄", color: "text-teal-600",   bg: "bg-teal-100",   border: "border-teal-200"   },
};