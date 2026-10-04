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
 * หากมีเวลา check-in เข้ามาจริง ต้องไม่คืนค่าเป็น "leave" เด็ดขาด
 * ถ้า thresholdMinutes เป็น null (เดิมมาจากใบลาเต็มวัน) ให้ fallback เป็นเวลาเริ่มงานปกติ (08:30)
 */
export function computeAttendanceStatus(
  checkInIso: string,
  thresholdMinutes: number | null,
): "on_time" | "late" {
  const effectiveThreshold = thresholdMinutes ?? WORK_START_MINUTES;
  return toThaiMinutes(checkInIso) > effectiveThreshold ? "late" : "on_time";
}

// ────────────────────────────────────────────────────────────────────────────
// Async: Auto-Cancel Leave On Attendance Check-In (คืนโควตาวันลาทันที)
// ────────────────────────────────────────────────────────────────────────────

/**
 * ยกเลิกใบลาเต็มวันอัตโนมัติเมื่อพนักงานมีการ Check-in เข้าทำงานจริง
 * คืนสิทธิ์วันลา / โควต้าแลกวันหยุด (holiday_swap) ให้ทันทีผ่าน Trigger Database
 */
export async function autoCancelLeaveForAttendance(
  supabase: AnySupabase,
  userId: string,
  logDate: string,
  checkInIso: string,
  actionBy?: string,
): Promise<Array<{ cancelled_request_id: string; leave_type: string }>> {
  try {
    // 1. เรียกผ่าน RPC ของ PostgreSQL เพื่อความรวดเร็วและปลอดภัยระดับ Database
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "auto_cancel_leave_for_attendance",
      {
        p_user_id: userId,
        p_date: logDate,
        p_checkin_time: checkInIso,
        p_action_by: actionBy ?? null,
      },
    );

    if (!rpcError && Array.isArray(rpcResult)) {
      return rpcResult;
    }

    // 2. Fallback: กรณีรันบน environment ที่ยังไม่ได้ apply RPC migration
    const { data: approvedLeaves, error: selectErr } = await supabase
      .from("leave_requests")
      .select("id, leave_type, days, hours, period_label")
      .eq("user_id", userId)
      .eq("status", "approved")
      .lte("start_date", logDate)
      .gte("end_date", logDate);

    if (selectErr || !approvedLeaves || approvedLeaves.length === 0) {
      return [];
    }

    // กรองเฉพาะลาเต็มวัน (ไม่มีชั่วโมงระบุ หรือ period_label ว่าง หรือ เป็น 'ทั้งวัน')
    const fullDayLeaves = approvedLeaves.filter(
      (l: { period_label?: string | null; hours?: number | null }) =>
        (!l.hours || l.hours === 0) &&
        (!l.period_label || l.period_label === "ทั้งวัน" || !l.period_label.includes(":")),
    );

    if (fullDayLeaves.length === 0) return [];

    const thaiTime = new Date(checkInIso).toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Bangkok",
    });
    const cancelReason = `ระบบยกเลิกการลาอัตโนมัติ เนื่องจากพนักงานเข้าทำงานจริง ณ เวลา ${thaiTime} น.`;

    const cancelledList: Array<{ cancelled_request_id: string; leave_type: string }> = [];

    for (const leave of fullDayLeaves) {
      const { error: updateErr } = await supabase
        .from("leave_requests")
        .update({
          status: "cancelled",
          cancel_reason: cancelReason,
          cancel_requested_at: new Date().toISOString(),
          cancel_actioned_by: actionBy ?? userId,
          cancel_actioned_at: new Date().toISOString(),
        })
        .eq("id", leave.id);

      if (!updateErr) {
        cancelledList.push({
          cancelled_request_id: leave.id,
          leave_type: leave.leave_type,
        });
      }
    }

    return cancelledList;
  } catch (err) {
    console.error("[autoCancelLeaveForAttendance] Error:", err);
    return [];
  }
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
    .in("status", ["approved", "cancel_requested"])
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
 * - วันหยุด (holidays table หรือ เสาร์/อาทิตย์) → status = "on_time" เสมอ
 * - ถ้า check-in แล้ว → คำนวณ threshold ใหม่และ update status
 */
export async function recalcAttendanceStatus(
  supabase: AnySupabase,
  userId: string,
  logDate: string,
): Promise<void> {
  const { data: log } = await supabase
    .from("daily_time_logs")
    .select("first_check_in, status, shift_type")
    .eq("user_id", userId)
    .eq("log_date", logDate)
    .maybeSingle();

  if (!log?.first_check_in) return;

  // วันหยุดไม่นับสาย
  const isHoliday =
    log.shift_type === "holiday" ||
    (() => { const d = new Date(logDate).getDay(); return d === 0 || d === 6; })();

  const newStatus = isHoliday
    ? "on_time"
    : computeAttendanceStatus(log.first_check_in, await getEffectiveThreshold(supabase, userId, logDate));

  if (newStatus !== log.status) {
    await supabase
      .from("daily_time_logs")
      .update({ status: newStatus })
      .eq("user_id", userId)
      .eq("log_date", logDate);
  }
}
