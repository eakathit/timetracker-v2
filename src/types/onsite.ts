// ============================================================
// types/onsite.ts
// TypeScript Types สำหรับระบบ On-site Group Check-in/Out
// ============================================================

// ─── Enums / Literals ─────────────────────────────────────────────────────────

export type OnsiteSessionStatus = "open" | "checked_in" | "closed";
export type MemberRole          = "leader" | "member";
export type CheckoutType        = "pending" | "group" | "early";

// ─── Database Row Types ────────────────────────────────────────────────────────

/** แถวใน onsite_sessions */
export interface OnsiteSession {
  id:               string;
  leader_id:        string;
  site_name:        string;
  project_id:       string | null;
  status:           OnsiteSessionStatus;
  group_check_in:   string | null;   // ISO timestamp
  group_check_out:  string | null;   // ISO timestamp
  session_code:     string | null;
  session_date:     string;          // "YYYY-MM-DD"
  created_at:       string;
  closed_at:        string | null;
}

/** แถวใน onsite_session_members */
export interface OnsiteSessionMember {
  id:                   string;
  session_id:           string;
  user_id:              string;
  role:                 MemberRole;
  checkout_type:        CheckoutType;
  early_checkout_at:    string | null;
  early_checkout_note:  string | null;
  joined_at:            string;
  /** เวลา check-in จริงของคนนี้
   *  - สมาชิกเดิม  → copy มาจาก group_check_in ตอน groupCheckIn()
   *  - เพิ่มกลางวัน → now() ณ เวลาที่ leader ดึงเข้า
   *  - null         → session ยัง open (ยังไม่ได้ group check-in)
   */
  checkin_at: string | null;
}

// ─── Joined / Enriched Types ──────────────────────────────────────────────────

/** Profile พนักงานที่ join มาจากตาราง profiles */
export interface MemberProfile {
  id:         string;
  first_name: string | null;
  last_name:  string | null;
  department: string | null;
  role:       string;
  avatar_url?: string | null;
}

/** Member พร้อมข้อมูล Profile (ใช้ render รายชื่อในห้อง) */
export interface OnsiteSessionMemberWithProfile extends OnsiteSessionMember {
  profile: MemberProfile | null;
}

/** Session พร้อมข้อมูล Members + Project (ใช้หน้า Session Detail) */
export interface OnsiteSessionWithMembers extends OnsiteSession {
  members:  OnsiteSessionMemberWithProfile[];
  project?: {
    id:         string;
    project_no: string;
    name:       string | null;
  } | null;
}

// ─── Timeline Events ──────────────────────────────────────────────────────────
// เหล่านี้จะถูก append ลง daily_time_logs.timeline_events (JSONB)

export type OnsiteTimelineEvent =
  | {
      event:      "onsite_checkin";
      timestamp:  string;
      session_id: string;
      site_name:  string;
      synced_from: "leader" | "leader_mid_session"; 
    }
  | {
      event:           "onsite_early_leave";
      timestamp:       string;
      session_id:      string;
      note:            string | null;
    }
  | {
    event:          "onsite_checkout";
    timestamp:      string;
    session_id:     string;
    checkout_type:  "group" | "early";
    break_minutes:  number;        // ← เพิ่ม
    raw_ot_hours:   number;        // ← เพิ่ม (OT ก่อนหักเบรค)
    net_ot_hours:   number;        // ← เพิ่ม (OT หลังหักเบรค)
    ot_starts_from: string;        // ← เพิ่ม เช่น "17:30"
  }
  | {
      event:      "transit_start";   // เริ่มเดินทางกลับ (ไม่นับ OT)
      timestamp:  string;
      session_id: string;
    };

// ─── Form / Input Types ───────────────────────────────────────────────────────

/** ฟอร์มสร้าง Session ใหม่ */
export interface CreateSessionInput {
  site_name:  string;
  project_id: string | null;
  member_ids: string[];   // UUID ของพนักงานที่ Leader เลือก
}

/** ฟอร์ม Early Leave */
export interface EarlyLeaveInput {
  session_id: string;
  note:       string;
}

// ─── Response Types ────────────────────────────────────────────────────────────

export interface ActionResult<T = void> {
  success: boolean;
  data?:   T;
  error?:  string;
}