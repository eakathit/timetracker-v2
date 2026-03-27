/**
 * src/lib/attendance.ts
 *
 * Shared attendance-status utilities
 * ใช้ร่วมกันใน factory-checkin, onsite, audit, และ leave approval
 *
 * Business rules:
 *   - ลาทั้งวัน             → status = "leave"   (ไม่นับสาย)
 *   - ลาครึ่งเช้า           → threshold = 13:00  (สายถ้า check-in หลัง 13:00)
 *   - ลาครึ่งบ่าย           → threshold = 08:30  (ปกติ ไม่กระทบเช้า)
 *   - ลารายชั่วโมง N ชม.   → threshold = 08:30 + N ชม. (สมมติเริ่มต้น 08:30)
 *   - ไม่มีใบลา             → threshold = 08:30
 */

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

export const WORK_START_MINUTES = 8 * 60 + 30; // 08:30 = 510 นาที
export const AFTERNOON_START_MINUTES = 13 * 60; // 13:00 = 780 นาที

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** แปลง ISO timestamp เป็นนาทีในวัน (Bangkok time) */
function toThaiMinutes(iso: string): number {
  const hhmm = new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ────────────────────────────────────────────────────────────────────────────
// Core: คำนวณ threshold จาก leave object โดยตรง (ไม่ query DB)
// ────────────────────────────────────────────────────────────────────────────

/**
 * คำนวณ late-threshold (นาที) จาก leave request object
 * ใช้เมื่อมี leaveReq อยู่ในมือแล้ว ไม่ต้อง query DB ซ้ำ
 *
 * period_label values:
 *   null              → ลาทั้งวัน → return null
 *   "ครึ่งเช้า"       → threshold = 13:00
 *   "ครึ่งบ่าย"       → threshold = 08:30 (ไม่กระทบเวลาเช้า)
 *   "HH:MM – HH:MM"  → ลารายชั่วโมง parse end time
 *
 * Returns:
 *   null   → ลาทั้งวัน → status = "leave"
 *   number → threshold (นาที)
 */
export function thresholdFromLeave(leave: {
  period_label?: string | null;
}): number | null {
  const label = leave.period_label;

  if (!label) return null; // ลาทั้งวัน

  if (label === "ครึ่งเช้า") return AFTERNOON_START_MINUTES; // 13:00
  if (label === "ครึ่งบ่าย") return WORK_START_MINUTES;      // 08:30

  // รูปแบบ "HH:MM – HH:MM" (ลารายชั่วโมง)
  const match = label.match(/^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})$/);
  if (match) {
    const [startH, startM] = match[1].split(":").map(Number);
    const [endH,   endM  ] = match[2].split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes   = endH   * 60 + endM;

    // ถ้าลาเริ่มตั้งแต่ต้นวัน (≤ 08:30) → threshold = เวลาสิ้นสุดลา
    if (startMinutes <= WORK_START_MINUTES) return endMinutes;
    // ลาช่วงอื่น (เช่น 10:00-12:00) → ไม่กระทบเวลาเข้างาน
    return WORK_START_MINUTES;
  }

  // unknown format → ปลอดภัยกว่าถือว่าลาทั้งวัน
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Core: คำนวณ status จาก check-in และ threshold
// ────────────────────────────────────────────────────────────────────────────

/**
 * คำนวณ attendance status
 *
 * thresholdMinutes:
 *   null   → "leave"
 *   number → เปรียบเทียบกับเวลา check-in (strict greater than = สาย)
 */
export function computeAttendanceStatus(
  checkInIso: string,
  thresholdMinutes: number | null,
): "on_time" | "late" | "leave" {
  if (thresholdMinutes === null) return "leave";
  return toThaiMinutes(checkInIso) > thresholdMinutes ? "late" : "on_time";
}

// ────────────────────────────────────────────────────────────────────────────
// Async: query approved leave แล้วคืน threshold
// ────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

/**
 * Query approved leave ของ user ในวันนั้น แล้วคืน late-threshold
 * ใช้ในจุดที่ยังไม่มี leaveReq object (เช่น check-in routes)
 */
export async function getEffectiveThreshold(
  supabase: AnySupabase,
  userId: string,
  logDate: string, // "YYYY-MM-DD"
): Promise<number | null> {
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("period_label")
    .eq("user_id", userId)
    .eq("status", "approved")
    .lte("start_date", logDate)
    .gte("end_date", logDate);

  if (!leaves || leaves.length === 0) return WORK_START_MINUTES;

  // Priority: ทั้งวัน > ครึ่งเช้า > รายชั่วโมง > ครึ่งบ่าย
  for (const leave of leaves) {
    const t = thresholdFromLeave(leave);
    if (t === null) return null;                    // ลาทั้งวัน → หยุดทันที
    if (t === AFTERNOON_START_MINUTES) return t;    // ครึ่งเช้า → หยุดทันที
  }
  for (const leave of leaves) {
    const t = thresholdFromLeave(leave);
    if (t !== null && t !== WORK_START_MINUTES) return t; // รายชั่วโมง
  }

  return WORK_START_MINUTES;
}

// ────────────────────────────────────────────────────────────────────────────
// Async: Recalculate และ UPDATE status ใน daily_time_logs
// ────────────────────────────────────────────────────────────────────────────

/**
 * Recalculate attendance status หลัง approve/reject leave
 *
 * Logic:
 * - ถ้ายังไม่ได้ check-in → ไม่ต้องทำอะไร (จะ recalc ตอน check-in)
 * - ถ้า check-in แล้ว → คำนวณ threshold ใหม่และ update status
 */
export async function recalcAttendanceStatus(
  supabase: AnySupabase,
  userId: string,
  logDate: string,
): Promise<void> {
  const { data: log } = await supabase
    .from("daily_time_logs")
    .select("first_check_in, status")
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();

  if (!log?.first_check_in) return;

  const threshold = await getEffectiveThreshold(supabase, userId, logDate);
  const newStatus = computeAttendanceStatus(log.first_check_in, threshold);

  if (newStatus !== log.status) {
    await supabase
      .from("daily_time_logs")
      .update({ status: newStatus })
      .eq("user_id", userId)
      .eq("log_date", logDate);
  }
}
