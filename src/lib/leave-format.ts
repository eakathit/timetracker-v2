/**
 * leave-format.ts
 * ─────────────────────────────────────────────────────────────────
 * Utility สำหรับแสดงค่า balance / วันลา
 *
 * Rule:
 *   allowHourly = true  → แสดงเป็นชั่วโมง (days × 8)
 *   allowHourly = false → แสดงเป็นวัน
 *
 * ตัวอย่าง:
 *   fmtLeaveHours(3.5)   → "3.5"
 *   fmtLeaveHours(4)     → "4"
 *   fmtLeaveUnit(true)   → "ชม."
 *   fmtLeaveUnit(false)  → "วัน"
 *   toDisplay(0.4375, true)  → 3.5   (3.5 ชม.)
 *   toDisplay(0.5625, true)  → 4.5   (4.5 ชม.)
 *   toDisplay(5, false)      → 5     (5 วัน)
 * ─────────────────────────────────────────────────────────────────
 */

/** แปลง days → display value (hours ถ้า allowHourly) */
export function toLeaveDisplay(days: number, allowHourly: boolean): number {
  return allowHourly ? days * 8 : days;
}

/** format ตัวเลขสะอาด — ไม่มีทศนิยมโง่ๆ เช่น 3.5 ไม่ใช่ 3.50 */
export function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : parseFloat(n.toFixed(2)).toString();
}

/** หน่วยที่แสดง */
export function leaveUnit(allowHourly: boolean): string {
  return allowHourly ? "ชม." : "วัน";
}

/**
 * สร้าง string เดียว เช่น "3.5 ชม." หรือ "5 วัน"
 * @param days   ค่าจาก DB (หน่วยวัน)
 * @param allowHourly  มาจาก leave_policies.allow_hourly
 */
export function fmtLeaveBalance(days: number, allowHourly: boolean): string {
  const val = toLeaveDisplay(days, allowHourly);
  return `${fmtNum(val)} ${leaveUnit(allowHourly)}`;
}
