"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { LeavePolicy } from "@/types/leave";
import type { LeaveBalanceWithPolicy } from "@/types/leave";
import { LEAVE_TYPE_CONFIG } from "@/types/leave";
// ─── Sub-nav config ───────────────────────────────────────────────────────────
const SETTINGS_TABS = [
  {
    id: "report_manage",
    label: "จัดการรายงาน",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: "permissions",
    label: "จัดการสิทธิ์",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: "holidays",
    label: "วันหยุด",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: "leave",
    label: "วันลา",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M8 18h.01M12 18h.01M16 14h.01" />
      </svg>
    ),
  },
  {
    id: "leave_balance",
    label: "วันลาพนักงาน",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
];

// ─── Reusable UI ──────────────────────────────────────────────────────────────

function SettingGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          {title}
        </h3>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  description,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-700 leading-tight">
          {label}
        </p>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? "bg-sky-500" : "bg-gray-200"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function SelectInput({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-3 pr-8 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 cursor-pointer transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="w-3.5 h-3.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-40 md:w-56 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 transition-colors"
    />
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────
const ROLE_STYLES: Record<string, string> = {
  admin: "bg-rose-50 text-rose-500 border-rose-200",
  manager: "bg-amber-50 text-amber-600 border-amber-200",
  user: "bg-sky-50 text-sky-500 border-sky-200",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "User",
};

// ─── Tab Sections ─────────────────────────────────────────────────────────────

function SystemSection() {
  const [companyName, setCompanyName] = useState("บริษัท ช่างดี จำกัด");
  const [timezone, setTimezone] = useState("asia_bangkok");
  const [language, setLanguage] = useState("th");
  const [version] = useState("2.0.1");

  return (
    <div className="space-y-4">
      <SettingGroup title="ข้อมูลบริษัท">
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
          label="ชื่อบริษัท"
          description="แสดงในรายงานและเอกสารทั้งหมด"
        >
          <TextInput
            value={companyName}
            onChange={setCompanyName}
            placeholder="ชื่อบริษัท"
          />
        </SettingRow>
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
            </svg>
          }
          label="Timezone"
        >
          <SelectInput
            value={timezone}
            onChange={setTimezone}
            options={[
              { value: "asia_bangkok", label: "Asia/Bangkok (UTC+7)" },
              { value: "asia_tokyo", label: "Asia/Tokyo (UTC+9)" },
              { value: "utc", label: "UTC+0" },
            ]}
          />
        </SettingRow>
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1" />
              <path d="M22 22l-5-10-5 10M14.5 17h5" />
            </svg>
          }
          label="ภาษา / Language"
        >
          <SelectInput
            value={language}
            onChange={setLanguage}
            options={[
              { value: "th", label: "ภาษาไทย" },
              { value: "en", label: "English" },
            ]}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="เกี่ยวกับระบบ">
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          }
          label="เวอร์ชัน"
          description="TimeTracker V2"
        >
          <span className="px-3 py-1.5 text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 rounded-full">
            v{version}
          </span>
        </SettingRow>
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          }
          label="สำรองข้อมูล"
          description="สำรองข้อมูลล่าสุด: วันนี้ 08:00"
        >
          <button className="px-4 py-2 text-xs font-bold text-white bg-sky-500 rounded-xl hover:bg-sky-600 transition-colors">
            Backup
          </button>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

function PermissionsSection() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. ดึงข้อมูล User จากตาราง profiles
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles_with_avatar")
        .select("*")
        .order("first_name", { ascending: true }); // เรียงตามชื่อ

      if (data && !error) {
        setUsers(data);
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  // 2. ฟังก์ชันเปลี่ยนสิทธิ์และบันทึกลง Database ทันที
  const cycleRole = async (id: string, currentRole: string) => {
    const roles = ["user", "manager", "admin"];
    const normalizedRole =
      currentRole && currentRole !== "viewer" ? currentRole : "user";
    const currentIndex = roles.indexOf(normalizedRole);
    const nextRole =
      roles[(currentIndex !== -1 ? currentIndex + 1 : 1) % roles.length];

    // อัปเดต UI ทันที (Optimistic Update) เพื่อให้ดูไหลลื่น
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: nextRole } : u)),
    );

    // อัปเดตลง Database
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", id);

    if (error) {
      console.error("Error updating role:", error);
      alert("ไม่สามารถเปลี่ยนสิทธิ์ได้ กรุณาลองใหม่");
      // ถ้า Error ให้ย้อนกลับเป็นค่าเดิม
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: currentRole } : u)),
      );
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-gray-400 animate-pulse">
        กำลังโหลดข้อมูลพนักงาน...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SettingGroup title={`ผู้ใช้งานทั้งหมดในระบบ (${users.length} คน)`}>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          {users.map((u) => {
            // จัดการแสดงผลชื่อและแผนก
            const fullName =
              u.first_name || u.last_name
                ? `${u.first_name || ""} ${u.last_name || ""}`.trim()
                : "ยังไม่ได้ระบุชื่อ";
            const initial =
              fullName !== "ยังไม่ได้ระบุชื่อ" ? fullName.charAt(0) : "U";
            const currentRole = u.role || "user";

            return (
              <div
                key={u.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors"
              >
                {/* Avatar */}
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={fullName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-gradient-to-br from-sky-400 to-blue-500 shadow-sm">
                    {initial}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {fullName}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {u.department || "ยังไม่ระบุแผนก"}
                  </p>
                </div>

                {/* Role badge — คลิกเพื่อเปลี่ยนสิทธิ์ */}
                <button
                  onClick={() => cycleRole(u.id, currentRole)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all hover:scale-105 ${ROLE_STYLES[currentRole] || ROLE_STYLES.user}`}
                  title="คลิกเพื่อเปลี่ยนสิทธิ์ (บันทึกอัตโนมัติ)"
                >
                  {ROLE_LABELS[currentRole] || "User"}
                </button>
              </div>
            );
          })}
        </div>
      </SettingGroup>

      {/* Role legend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          ระดับสิทธิ์การใช้งาน
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { role: "admin", desc: "เข้าถึงได้ทุกส่วน และจัดการระบบได้" },
            { role: "manager", desc: "ดูรายงานภาพรวมและอนุมัติ OT/ลา" },
            { role: "user", desc: "ผู้ใช้งานระบบทั่วไป" },
          ].map((r) => (
            <div
              key={r.role}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${ROLE_STYLES[r.role]}`}
            >
              <span className="text-xs font-bold min-w-[60px]">
                {ROLE_LABELS[r.role]}
              </span>
              <span className="text-[10px] opacity-70 truncate">
                — {r.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorktimeSection() {
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [lateGrace, setLateGrace] = useState("15");
  const [otEnabled, setOtEnabled] = useState(true);
  const [otMinHours, setOtMinHours] = useState("1");
  const [workDays, setWorkDays] = useState([
    true,
    true,
    true,
    true,
    true,
    false,
    false,
  ]); // จ–ศ

  const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="space-y-4">
      <SettingGroup title="เวลาทำงานปกติ">
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          }
          label="เวลาเข้างาน"
        >
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
          />
        </SettingRow>
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 9 14" />
            </svg>
          }
          label="เวลาออกงาน"
        >
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
          />
        </SettingRow>
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          label="ระยะเวลาผ่อนผันมาสาย"
          description="นับเป็นมาสายหลังจากนาทีที่"
        >
          <div className="flex items-center gap-2">
            <SelectInput
              value={lateGrace}
              onChange={setLateGrace}
              options={["0", "5", "10", "15", "30"].map((v) => ({
                value: v,
                label: `${v} นาที`,
              }))}
            />
          </div>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="วันทำงาน">
        <div className="px-5 py-4">
          <div className="flex gap-2 flex-wrap">
            {dayLabels.map((d, i) => (
              <button
                key={d}
                onClick={() =>
                  setWorkDays((prev) =>
                    prev.map((v, idx) => (idx === i ? !v : v)),
                  )
                }
                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-150
                  ${
                    workDays[i]
                      ? "bg-sky-500 text-white shadow-md shadow-sky-200"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }
                  ${i === 0 || i === 6 ? "ring-1 " + (workDays[i] ? "ring-rose-300" : "ring-gray-200") : ""}
                `}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {workDays.filter(Boolean).length} วัน/สัปดาห์ ·{" "}
            {workDays.filter(Boolean).length * 8} ชม./สัปดาห์
          </p>
        </div>
      </SettingGroup>

      <SettingGroup title="การทำงานล่วงเวลา (OT)">
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4l3 3M17 3.5L21 7" />
            </svg>
          }
          label="เปิดใช้งาน OT"
          description="อนุญาตให้พนักงานยื่นขอทำ OT"
        >
          <Toggle
            enabled={otEnabled}
            onChange={() => setOtEnabled(!otEnabled)}
          />
        </SettingRow>
        {otEnabled && (
          <SettingRow
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-4.5 h-4.5"
                style={{ width: "18px", height: "18px" }}
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            }
            label="ขั้นต่ำชั่วโมง OT"
            description="นับ OT เมื่อทำงานเกินเวลาอย่างน้อย"
          >
            <SelectInput
              value={otMinHours}
              onChange={setOtMinHours}
              options={["0.5", "1", "2"].map((v) => ({
                value: v,
                label: `${v} ชม.`,
              }))}
            />
          </SettingRow>
        )}
      </SettingGroup>
    </div>
  );
}

function LocationSection() {
  const [gpsRequired, setGpsRequired] = useState(true);
  const [radiusMeters, setRadiusMeters] = useState("200");
  const [locations, setLocations] = useState([
    {
      id: 1,
      name: "สำนักงานใหญ่",
      address: "123 ถ.สุขุมวิท กรุงเทพฯ",
      active: true,
    },
    {
      id: 2,
      name: "โรงงาน A",
      address: "456 ถ.บางนา สมุทรปราการ",
      active: true,
    },
    {
      id: 3,
      name: "โรงพยาบาล C",
      address: "789 ถ.พระราม 9 กรุงเทพฯ",
      active: false,
    },
  ]);

  return (
    <div className="space-y-4">
      <SettingGroup title="การตรวจสอบตำแหน่ง">
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          }
          label="บังคับใช้ GPS"
          description="ต้องอยู่ในพื้นที่กำหนดจึงตอกบัตรได้"
        >
          <Toggle
            enabled={gpsRequired}
            onChange={() => setGpsRequired(!gpsRequired)}
          />
        </SettingRow>
        {gpsRequired && (
          <SettingRow
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-4.5 h-4.5"
                style={{ width: "18px", height: "18px" }}
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            }
            label="รัศมีที่อนุญาต"
          >
            <SelectInput
              value={radiusMeters}
              onChange={setRadiusMeters}
              options={["50", "100", "200", "500", "1000"].map((v) => ({
                value: v,
                label: `${v} ม.`,
              }))}
            />
          </SettingRow>
        )}
      </SettingGroup>

      <SettingGroup title={`สถานที่ทำงาน (${locations.length} แห่ง)`}>
        {locations.map((loc) => (
          <div key={loc.id} className="flex items-center gap-4 px-5 py-4">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${loc.active ? "bg-sky-100 text-sky-500" : "bg-gray-100 text-gray-400"}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-4 h-4"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">{loc.name}</p>
              <p className="text-xs text-gray-400 truncate">{loc.address}</p>
            </div>
            <button
              onClick={() =>
                setLocations((prev) =>
                  prev.map((l) =>
                    l.id === loc.id ? { ...l, active: !l.active } : l,
                  ),
                )
              }
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${loc.active ? "bg-sky-50 text-sky-500 hover:bg-sky-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4"
              >
                {loc.active ? (
                  <>
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </>
                )}
              </svg>
            </button>
          </div>
        ))}
        <div className="px-5 py-3">
          <button className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs font-bold text-gray-400 hover:border-sky-300 hover:text-sky-500 hover:bg-sky-50/50 transition-all flex items-center justify-center gap-1.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-3.5 h-3.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            เพิ่มสถานที่ใหม่
          </button>
        </div>
      </SettingGroup>
    </div>
  );
}

function NotificationsSection() {
  const [notifs, setNotifs] = useState({
    checkin: true,
    checkout: true,
    late: true,
    ot_approve: true,
    leave: false,
    report: false,
    line: false,
    email: true,
  });

  const toggle = (key: keyof typeof notifs) =>
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <SettingGroup title="การแจ้งเตือนในแอป">
        {[
          {
            key: "checkin",
            label: "เข้างาน",
            desc: "เมื่อมีการตอกบัตรเข้างาน",
          },
          { key: "checkout", label: "ออกงาน", desc: "เมื่อมีการตอกบัตรออกงาน" },
          { key: "late", label: "มาสาย", desc: "แจ้งเตือนเมื่อพนักงานมาสาย" },
          {
            key: "ot_approve",
            label: "อนุมัติ OT",
            desc: "เมื่อคำขอ OT ได้รับการอนุมัติ",
          },
          { key: "leave", label: "การลา", desc: "เมื่อมีคำขอลาใหม่" },
          {
            key: "report",
            label: "รายงานประจำวัน",
            desc: "เตือนกรอก Daily Report",
          },
        ].map((item) => (
          <SettingRow
            key={item.key}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="w-4.5 h-4.5"
                style={{ width: "18px", height: "18px" }}
              >
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            }
            label={item.label}
            description={item.desc}
          >
            <Toggle
              enabled={notifs[item.key as keyof typeof notifs]}
              onChange={() => toggle(item.key as keyof typeof notifs)}
            />
          </SettingRow>
        ))}
      </SettingGroup>

      <SettingGroup title="ช่องทางแจ้งเตือน">
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22 6 12 13 2 6" />
            </svg>
          }
          label="Email"
          description="ส่งสรุปรายวันทาง Email"
        >
          <Toggle enabled={notifs.email} onChange={() => toggle("email")} />
        </SettingRow>
        <SettingRow
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="w-4.5 h-4.5"
              style={{ width: "18px", height: "18px" }}
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          }
          label="LINE Notify"
          description="เชื่อมต่อ LINE Bot เพื่อแจ้งเตือน"
        >
          <Toggle enabled={notifs.line} onChange={() => toggle("line")} />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

// ─── Report Management Section ────────────────────────────────────────────────

interface Project {
  id: string;
  no: string;
  name: string;
  active: boolean;
}

interface EndUser {
  id: string;
  name: string;
  color: string;
  projects: Project[];
  expanded: boolean;
}

const END_USER_COLORS = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#06b6d4",
  "#a855f7",
];

function ReportManagementSection() {
  const [details, setDetails] = useState<
    { id: string; label: string; active: boolean }[]
  >([]);
  const [endUsers, setEndUsers] = useState<EndUser[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Fetch Data from Supabase ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [dRes, uRes, pRes] = await Promise.all([
        supabase
          .from("work_details")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("end_users")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: true }),
      ]);

      if (dRes.data) {
        setDetails(
          dRes.data.map((d) => ({
            id: d.id,
            label: d.title,
            active: d.is_active,
          })),
        );
      }

      if (uRes.data && pRes.data) {
        const mappedUsers: EndUser[] = uRes.data.map((eu) => ({
          id: eu.id,
          name: eu.name,
          color: eu.color || "bg-sky-500",
          expanded: false,
          projects: pRes.data
            .filter((p) => p.end_user_id === eu.id)
            .map((p) => ({
              id: p.id,
              no: p.project_no,
              name: p.name || "",
              active: p.is_active,
            })),
        }));
        setEndUsers(mappedUsers);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // ── Detail actions ────────────────────────────────────────────────────────────
  const [newDetail, setNewDetail] = useState("");
  const [detailSearch, setDetailSearch] = useState("");

  const addDetail = async () => {
    const trimmed = newDetail.trim();
    if (!trimmed) return;
    const valueKey =
      trimmed.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
    const { data, error } = await supabase
      .from("work_details")
      .insert({ title: trimmed, value_key: valueKey, is_active: true })
      .select()
      .single();
    if (!error && data) {
      setDetails((prev) => [
        ...prev,
        { id: data.id, label: data.title, active: data.is_active },
      ]);
      setNewDetail("");
    }
  };

  const removeDetail = async (id: string) => {
    if (!confirm("แน่ใจหรือไม่ที่จะลบประเภทงานนี้?")) return;
    const { error } = await supabase.from("work_details").delete().eq("id", id);
    if (error) {
      alert("ไม่สามารถลบได้: " + error.message);
      return; // ✅ หยุดทันที ไม่ update state
    }
    setDetails((prev) => prev.filter((d) => d.id !== id));
  };
  const toggleDetail = async (id: string) => {
    const target = details.find((d) => d.id === id);
    if (!target) return;
    await supabase
      .from("work_details")
      .update({ is_active: !target.active })
      .eq("id", id);
    setDetails((prev) =>
      prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d)),
    );
  };

  // ── End User + Projects actions ───────────────────────────────────────────────
  const [newEuName, setNewEuName] = useState("");
  const [newEuColor, setNewEuColor] = useState(END_USER_COLORS[0]);
  const [showEuForm, setShowEuForm] = useState(false);
  const [addProjFor, setAddProjFor] = useState<string | null>(null);
  const [newProjNo, setNewProjNo] = useState("");
  const [newProjName, setNewProjName] = useState("");

  // ── Edit End User ──────────────────────────────────────────────────────────────
  const [editEuId, setEditEuId] = useState<string | null>(null);
  const [editEuName, setEditEuName] = useState("");
  const [editEuColor, setEditEuColor] = useState(END_USER_COLORS[0]);

  // ── Edit Project ───────────────────────────────────────────────────────────────
  const [editProjId, setEditProjId] = useState<string | null>(null);
  const [editProjNo, setEditProjNo] = useState("");
  const [editProjName, setEditProjName] = useState("");

  const toggleEuExpanded = (id: string) =>
    setEndUsers((prev) =>
      prev.map((e) => (e.id === id ? { ...e, expanded: !e.expanded } : e)),
    );

  const addEndUser = async () => {
    const trimmed = newEuName.trim();
    if (!trimmed) return;
    const { data, error } = await supabase
      .from("end_users")
      .insert({ name: trimmed, color: newEuColor }) // ✅
      .select()
      .single();
    if (!error && data) {
      setEndUsers((prev) => [
        ...prev,
        {
          id: data.id, // ✅ เติม fields ให้ครบ
          name: data.name,
          color: data.color,
          expanded: true,
          projects: [],
        },
      ]);
      setNewEuName("");
      setNewEuColor(END_USER_COLORS[0]); // ✅ reset กลับ default หลัง save
      setShowEuForm(false);
    }
  };

  const removeEndUser = async (id: string) => {
    if (
      !confirm("ลบลูกค้านี้จะลบโปรเจกต์ทั้งหมดที่เกี่ยวข้องด้วย ยืนยันหรือไม่?")
    )
      return;

    const { error } = await supabase.from("end_users").delete().eq("id", id);

    if (error) {
      alert("ไม่สามารถลบได้: " + error.message);
      return;
    }

    setEndUsers((prev) => prev.filter((e) => e.id !== id));
  };

  const addProject = async (euId: string) => {
    const no = newProjNo.trim();
    const name = newProjName.trim();
    if (!no) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({
        project_no: no,
        name: name || null,
        end_user_id: euId,
        is_active: true,
      })
      .select()
      .single();
    if (!error && data) {
      setEndUsers((prev) =>
        prev.map((e) =>
          e.id !== euId
            ? e
            : {
                ...e,
                projects: [
                  ...e.projects,
                  {
                    id: data.id,
                    no: data.project_no,
                    name: data.name || "",
                    active: data.is_active,
                  },
                ],
              },
        ),
      );
      setNewProjNo("");
      setNewProjName("");
      setAddProjFor(null);
    }
  };

  const toggleProject = async (euId: string, projId: string) => {
    const targetEu = endUsers.find((e) => e.id === euId);
    const targetProj = targetEu?.projects.find((p) => p.id === projId);
    if (!targetProj) return;

    await supabase
      .from("projects")
      .update({ is_active: !targetProj.active })
      .eq("id", projId);
    setEndUsers((prev) =>
      prev.map((e) =>
        e.id !== euId
          ? e
          : {
              ...e,
              projects: e.projects.map((p) =>
                p.id === projId ? { ...p, active: !p.active } : p,
              ),
            },
      ),
    );
  };

  const removeProject = async (euId: string, projId: string) => {
    if (!confirm("แน่ใจหรือไม่ที่จะลบโปรเจกต์นี้?")) return;
    await supabase.from("projects").delete().eq("id", projId);
    setEndUsers((prev) =>
      prev.map((e) =>
        e.id !== euId
          ? e
          : {
              ...e,
              projects: e.projects.filter((p) => p.id !== projId),
            },
      ),
    );
  };

  const openEditEu = (eu: EndUser) => {
    setEditEuId(eu.id);
    setEditEuName(eu.name);
    setEditEuColor(eu.color);
    setAddProjFor(null); // ปิด form เพิ่มโปรเจคถ้าเปิดอยู่
  };

  const updateEndUser = async () => {
    const trimmed = editEuName.trim();
    if (!trimmed || !editEuId) return;
    const { error } = await supabase
      .from("end_users")
      .update({ name: trimmed, color: editEuColor })
      .eq("id", editEuId);
    if (!error) {
      setEndUsers((prev) =>
        prev.map((e) =>
          e.id === editEuId ? { ...e, name: trimmed, color: editEuColor } : e,
        ),
      );
      setEditEuId(null);
    }
  };

  const openEditProj = (proj: Project) => {
    setEditProjId(proj.id);
    setEditProjNo(proj.no);
    setEditProjName(proj.name);
  };

  const updateProject = async (euId: string) => {
    const no = editProjNo.trim();
    if (!no || !editProjId) return;
    const { error } = await supabase
      .from("projects")
      .update({ project_no: no, name: editProjName.trim() || null })
      .eq("id", editProjId);
    if (!error) {
      setEndUsers((prev) =>
        prev.map((e) =>
          e.id !== euId
            ? e
            : {
                ...e,
                projects: e.projects.map((p) =>
                  p.id === editProjId
                    ? { ...p, no, name: editProjName.trim() }
                    : p,
                ),
              },
        ),
      );
      setEditProjId(null);
    }
  };

  if (loading)
    return (
      <div className="py-10 text-center text-sm text-gray-400 animate-pulse">
        กำลังโหลดข้อมูล...
      </div>
    );

  return (
    <div className="space-y-5">
      {/* ════════════════════════════════════════════
          SECTION 1 — Detail List
      ════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div>
            <h3 className="text-sm font-bold text-gray-700">
              ประเภทงาน (Detail)
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              แสดงใน dropdown หน้า Report ·{" "}
              {details.filter((d) => d.active).length}/{details.length} เปิดอยู่
            </p>
          </div>
          <span className="text-xs font-bold text-sky-500 bg-sky-50 px-2.5 py-1 rounded-full">
            {details.filter((d) => d.active).length} รายการ
          </span>
        </div>

        {/* Search — แสดงเมื่อมีมากกว่า 6 รายการ */}
        {details.length > 6 && (
          <div className="px-5 py-2.5 border-b border-gray-50">
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder="ค้นหาประเภทงาน..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 placeholder-gray-300 transition-colors"
              />
            </div>
          </div>
        )}

        {/* List — จำกัดความสูง + scroll */}
        <div
          className="divide-y divide-gray-50 overflow-y-auto"
          style={{ maxHeight: "320px" }}
        >
          {details
            .filter((d) =>
              d.label.toLowerCase().includes(detailSearch.toLowerCase()),
            )
            .map((d) => (
              <div
                key={d.id}
                className={`flex items-center gap-3 px-5 py-3 transition-colors ${!d.active ? "bg-gray-50/60" : ""}`}
              >
                <span className="text-gray-200 cursor-grab flex-shrink-0">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4"
                  >
                    <line x1="9" y1="6" x2="15" y2="6" />
                    <line x1="9" y1="12" x2="15" y2="12" />
                    <line x1="9" y1="18" x2="15" y2="18" />
                  </svg>
                </span>
                <span
                  className={`flex-1 text-sm font-medium ${d.active ? "text-gray-700" : "text-gray-400 line-through"}`}
                >
                  {d.label}
                </span>
                <button
                  onClick={() => toggleDetail(d.id)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${d.active ? "text-sky-400 hover:bg-sky-50" : "text-gray-300 hover:bg-gray-100"}`}
                  title={d.active ? "ซ่อน" : "แสดง"}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4"
                  >
                    {d.active ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => removeDetail(d.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-200 hover:text-rose-400 hover:bg-rose-50 transition-colors"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          {/* Empty search result */}
          {detailSearch &&
            details.filter((d) =>
              d.label.toLowerCase().includes(detailSearch.toLowerCase()),
            ).length === 0 && (
              <div className="px-5 py-6 text-center text-xs text-gray-400">
                ไม่พบประเภทงาน "{detailSearch}"
              </div>
            )}
        </div>

        <div className="px-5 py-3 border-t border-gray-50 flex gap-2">
          <input
            value={newDetail}
            onChange={(e) => setNewDetail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDetail()}
            placeholder="เพิ่มประเภทงานใหม่ เช่น QUOTATION.."
            className="flex-1 px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 placeholder-gray-300 transition-colors"
          />
          <button
            onClick={addDetail}
            disabled={!newDetail.trim()}
            className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 disabled:bg-gray-100 disabled:text-gray-300 transition-colors flex-shrink-0"
          >
            เพิ่ม
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          SECTION 2 — End User + Projects
      ════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h3 className="text-sm font-bold text-gray-700">
              End User &amp; Project
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              เลือก End User → ล็อค Project ให้เฉพาะลูกค้านั้น
            </p>
          </div>
          <button
            onClick={() => setShowEuForm(!showEuForm)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-colors shadow-sm shadow-sky-200"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="w-3.5 h-3.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>{" "}
            เพิ่ม End User
          </button>
        </div>

        {showEuForm && (
          <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 mb-3 space-y-3">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">
              End User ใหม่
            </p>
            <div className="flex gap-2">
              <input
                value={newEuName}
                onChange={(e) => setNewEuName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEndUser()}
                placeholder="ชื่อลูกค้า เช่น Toyota, Honda..."
                className="flex-1 px-3 py-2.5 text-sm bg-white border border-sky-200 rounded-xl outline-none focus:border-sky-400 placeholder-gray-300 transition-colors"
              />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2">เลือกสี</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {END_USER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewEuColor(c)} // ✅ แก้จาก setEditEuColor
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${
                      newEuColor === c // ✅ แก้จาก editEuColor
                        ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                        : ""
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newEuColor} // ✅ แก้จาก editEuColor
                  onChange={(e) => setNewEuColor(e.target.value)} // ✅ แก้จาก setEditEuColor
                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                />
                <span className="text-xs text-gray-400">หรือเลือกสีเอง</span>
                <span className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                  {newEuColor} {/* ✅ แก้จาก editEuColor */}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowEuForm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={addEndUser}
                disabled={!newEuName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                บันทึก
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {endUsers.map((eu) => {
            const activeProj = eu.projects.filter((p) => p.active).length;
            return (
              <div
                key={eu.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: eu.color }}
                  >
                    {eu.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">{eu.name}</p>
                    <p className="text-xs text-gray-400">
                      {activeProj} โปรเจคเปิดอยู่ · {eu.projects.length} ทั้งหมด
                    </p>
                  </div>

                  {/* ✅ Edit EU */}
                  <button
                    onClick={() => openEditEu(eu)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-amber-400 hover:bg-amber-50 transition-colors"
                    title="แก้ไข End User"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4"
                    >
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>

                  {/* ✅ เพิ่มโปรเจค */}
                  <button
                    onClick={() => {
                      setAddProjFor(addProjFor === eu.id ? null : eu.id);
                      setNewProjNo("");
                      setNewProjName("");
                    }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sky-400 hover:bg-sky-50 transition-colors"
                    title="เพิ่มโปรเจค"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="w-4 h-4"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>

                  {/* ✅ ลบ EU */}
                  <button
                    onClick={() => removeEndUser(eu.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-200 hover:text-rose-400 hover:bg-rose-50 transition-colors"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  </button>

                  {/* ✅ Collapse — สำคัญมาก! ขาดตัวนี้ list โปรเจคจะไม่แสดง */}
                  <button
                    onClick={() => toggleEuExpanded(eu.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={`w-4 h-4 transition-transform duration-200 ${eu.expanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                {editEuId === eu.id && (
                  <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-amber-600">
                      แก้ไข End User
                    </p>
                    <input
                      value={editEuName}
                      onChange={(e) => setEditEuName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && updateEndUser()}
                      placeholder="ชื่อลูกค้า"
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-xl outline-none focus:border-amber-400 placeholder-gray-300"
                    />
                    <div>
                      <p className="text-xs text-gray-400 mb-2">เลือกสี</p>
                      {/* Preset swatches */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        {END_USER_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditEuColor(c)} // ✅
                            style={{ backgroundColor: c }}
                            className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${
                              editEuColor === c // ✅
                                ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                                : ""
                            }`}
                          />
                        ))}
                      </div>
                      {/* Custom color picker */}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editEuColor} // ✅
                          onChange={(e) => setEditEuColor(e.target.value)} // ✅
                          className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                        />
                        <span className="text-xs text-gray-400">
                          หรือเลือกสีเอง
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditEuId(null)}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={updateEndUser}
                        disabled={!editEuName.trim()}
                        className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                )}

                {addProjFor === eu.id && (
                  <div className="mx-4 mb-3 p-3 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
                    <p className="text-xs font-bold text-sky-600">
                      เพิ่มโปรเจคใหม่
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={newProjNo}
                        onChange={(e) => setNewProjNo(e.target.value)}
                        placeholder="Project No. เช่น 1122"
                        className="w-28 px-3 py-2 text-sm bg-white border border-sky-200 rounded-xl outline-none focus:border-sky-400 placeholder-gray-300"
                      />
                      <input
                        value={newProjName}
                        onChange={(e) => setNewProjName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && addProject(eu.id)
                        }
                        placeholder="ชื่อโปรเจค..."
                        className="flex-1 px-3 py-2 text-sm bg-white border border-sky-200 rounded-xl outline-none focus:border-sky-400 placeholder-gray-300"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAddProjFor(null)}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => addProject(eu.id)}
                        disabled={!newProjNo.trim()}
                        className="flex-1 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                      >
                        เพิ่มโปรเจค
                      </button>
                    </div>
                  </div>
                )}

                {eu.expanded && (
                  <div className="border-t border-gray-50">
                    {eu.projects.length === 0 ? (
                      <div className="px-5 py-4 text-center">
                        <p className="text-xs text-gray-400">
                          ยังไม่มีโปรเจค กด + เพื่อเพิ่ม
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {eu.projects.map((proj) => (
                          <div key={proj.id}>
                            {editProjId === proj.id ? (
                              /* ── Edit Project Form ── */
                              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 space-y-2">
                                <p className="text-xs font-bold text-amber-600">
                                  แก้ไขโปรเจค
                                </p>
                                <div className="flex gap-2">
                                  <input
                                    value={editProjNo}
                                    onChange={(e) =>
                                      setEditProjNo(e.target.value)
                                    }
                                    placeholder="Project No."
                                    className="w-28 px-3 py-1.5 text-sm bg-white border border-amber-200 rounded-xl outline-none focus:border-amber-400 placeholder-gray-300"
                                  />
                                  <input
                                    value={editProjName}
                                    onChange={(e) =>
                                      setEditProjName(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                      e.key === "Enter" && updateProject(eu.id)
                                    }
                                    placeholder="ชื่อโปรเจค..."
                                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-amber-200 rounded-xl outline-none focus:border-amber-400 placeholder-gray-300"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setEditProjId(null)}
                                    className="flex-1 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                                  >
                                    ยกเลิก
                                  </button>
                                  <button
                                    onClick={() => updateProject(eu.id)}
                                    disabled={!editProjNo.trim()}
                                    className="flex-1 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                                  >
                                    บันทึก
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── Project Row ปกติ (เดิม + เพิ่มปุ่ม Edit) ── */
                              <div
                                className={`flex items-center gap-3 px-5 py-3 transition-colors ${!proj.active ? "bg-gray-50/70" : ""}`}
                              >
                                <span
                                  className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors"
                                  style={
                                    proj.active
                                      ? {
                                          backgroundColor: eu.color + "25", // พื้นโปร่งแสงเล็กน้อย
                                          color: "#1f2937",
                                        }
                                      : {
                                          backgroundColor: "#f3f4f6",
                                          color: "#9ca3af",
                                        }
                                  }
                                >
                                  #{proj.no}
                                </span>
                                <span
                                  className={`flex-1 text-sm min-w-0 truncate ${proj.active ? "text-gray-700 font-medium" : "text-gray-400 line-through font-normal"}`}
                                >
                                  {proj.name}
                                </span>
                                {!proj.active && (
                                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                    สำเร็จแล้ว
                                  </span>
                                )}

                                {/* ✅ ปุ่ม Edit — เพิ่มใหม่ */}
                                <button
                                  onClick={() => openEditProj(proj)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-200 hover:text-amber-400 hover:bg-amber-50 transition-colors flex-shrink-0"
                                  title="แก้ไขโปรเจค"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="w-4 h-4"
                                  >
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>

                                {/* ปุ่ม Toggle + Delete — เดิม ไม่เปลี่ยน */}
                                <button
                                  onClick={() => toggleProject(eu.id, proj.id)}
                                  title={
                                    proj.active
                                      ? "ปิดโปรเจค (สำเร็จแล้ว)"
                                      : "เปิดโปรเจคอีกครั้ง"
                                  }
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${proj.active ? "text-emerald-400 hover:bg-emerald-50" : "text-gray-300 hover:bg-gray-100 hover:text-gray-500"}`}
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    className="w-4 h-4"
                                  >
                                    {proj.active ? (
                                      <>
                                        <polyline points="20 6 9 17 4 12" />
                                      </>
                                    ) : (
                                      <>
                                        <polyline points="20 6 9 17 4 12" />
                                      </>
                                    )}
                                  </svg>
                                </button>
                                <button
                                  onClick={() => removeProject(eu.id, proj.id)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-200 hover:text-rose-400 hover:bg-rose-50 transition-colors flex-shrink-0"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="w-4 h-4"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Holidays Section (ย้ายออกมาอยู่นอกสุด) ────────────────────────────────────────────────────────────
// ─── Holidays Section (Redesigned) ────────────────────────────────────────────
function HolidaysSection() {
  const HOLIDAY_TYPES = [
    {
      value: "national",
      label: "วันหยุด",
      color: "text-rose-600 bg-rose-50 border-rose-200",
      activeColor: "bg-rose-500 text-white border-rose-500",
      dot: "bg-rose-400",
    },
    {
      value: "working_sat",
      label: "เสาร์ทำงาน",
      color: "text-sky-600 bg-sky-50 border-sky-200",
      activeColor: "bg-sky-500 text-white border-sky-500",
      dot: "bg-sky-400",
    },
  ];

  const MONTHS_TH = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  const thisYear = new Date().getFullYear();
  const [holidays, setHolidays] = useState<any[]>([]);
  const [form, setForm] = useState({ date: "", name: "", type: "national" });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filterYear, setFilterYear] = useState(thisYear);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── years ที่มีข้อมูล (+ ปีปัจจุบัน + ปีถัดไป) ──
  const availableYears = useMemo(() => {
    const fromData = [
      ...new Set(holidays.map((h) => Number(h.holiday_date?.slice(0, 4)))),
    ];
    const base = new Set([...fromData, thisYear, thisYear + 1]);
    return [...base].sort((a, b) => a - b);
  }, [holidays, thisYear]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("holiday_date", { ascending: true });
      if (data && !error) setHolidays(data);
      setLoading(false);
    })();
  }, []);

  const handleAdd = async () => {
    if (!form.date || !form.name.trim() || adding) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("holidays")
      .insert([
        {
          holiday_date: form.date,
          name: form.name.trim(),
          holiday_type: form.type,
        },
      ])
      .select()
      .single();
    if (data && !error) {
      setHolidays((prev) => [...prev, data]);
      setForm({ date: "", name: "", type: form.type }); // คงค่า type ไว้
      nameInputRef.current?.focus();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("แน่ใจหรือไม่ที่จะลบรายการนี้?")) return;
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (!error) setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  // ── กรองตามปีที่เลือก แล้วจัดกลุ่มตามเดือน ──
  const groupedByMonth = useMemo(() => {
    const filtered = holidays.filter((h) =>
      h.holiday_date?.startsWith(String(filterYear)),
    );
    const map: Record<number, any[]> = {};
    filtered.forEach((h) => {
      const month = Number(h.holiday_date?.slice(5, 7)) - 1;
      if (!map[month]) map[month] = [];
      map[month].push(h);
    });
    return map;
  }, [holidays, filterYear]);

  const yearStats = useMemo(() => {
    const filtered = holidays.filter((h) =>
      h.holiday_date?.startsWith(String(filterYear)),
    );
    return {
      total: filtered.length,
      national: filtered.filter((h) => h.holiday_type === "national").length,
      working_sat: filtered.filter((h) => h.holiday_type === "working_sat")
        .length,
    };
  }, [holidays, filterYear]);

  if (loading)
    return (
      <div className="py-12 text-center text-sm text-gray-400 animate-pulse">
        กำลังโหลดข้อมูลวันหยุด...
      </div>
    );

  return (
    <div className="space-y-4">
      {/* ── Add Form Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            เพิ่มวันหยุด / เสาร์ทำงาน
          </h3>
        </div>

        <div className="p-4 space-y-3">
          {/* Type Selector — pill buttons */}
          <div className="flex gap-2">
            {HOLIDAY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() =>
                  setForm({
                    ...form,
                    type: t.value,
                    name:
                      t.value === "working_sat" && !form.name.trim()
                        ? "เสาร์ทำงาน"
                        : t.value === "national" && form.name === "เสาร์ทำงาน"
                          ? ""
                          : form.name,
                  })
                }
                className={`
                  flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all duration-150
                  ${form.type === t.value ? t.activeColor : t.color}
                `}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Date + Name row */}
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-40 px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all"
              />
            </div>
            <input
              ref={nameInputRef}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={
                form.type === "national"
                  ? "เช่น วันสงกรานต์, วันชาติ..."
                  : "เช่น เสาร์ทำงาน (OT)..."
              }
              className="flex-1 px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 focus:bg-white transition-all"
            />
          </div>

          {/* Add Button */}
          <button
            onClick={handleAdd}
            disabled={!form.date || !form.name.trim() || adding}
            className="
              w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-150
              bg-sky-500 text-white hover:bg-sky-600 active:scale-[.98]
              disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
            "
          >
            {adding ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".2" />
                  <path d="M21 12a9 9 0 00-9-9" />
                </svg>
                กำลังเพิ่ม...
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="w-4 h-4"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                เพิ่มวันหยุด
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Year Filter + Stats ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          {/* Year Tabs */}
          <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => setFilterYear(year)}
                className={`
                  flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-150
                  ${
                    filterYear === year
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 divide-x divide-gray-50 border-b border-gray-50">
          <div className="py-3 text-center">
            <p className="text-lg font-bold text-gray-700">{yearStats.total}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              ทั้งหมด
            </p>
          </div>
          <div className="py-3 text-center">
            <p className="text-lg font-bold text-rose-500">
              {yearStats.national}
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              วันหยุด
            </p>
          </div>
          <div className="py-3 text-center">
            <p className="text-lg font-bold text-sky-500">
              {yearStats.working_sat}
            </p>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              เสาร์ทำงาน
            </p>
          </div>
        </div>

        {/* Grouped List */}
        {Object.keys(groupedByMonth).length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-2xl mb-2">📅</p>
            <p className="text-sm text-gray-400">
              ยังไม่มีวันหยุดในปี {filterYear}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {Object.entries(groupedByMonth)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([monthIdx, items]) => (
                <div key={monthIdx}>
                  {/* Month Header */}
                  <div className="px-5 py-2 bg-gray-50/70 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">
                      {MONTHS_TH[Number(monthIdx)]}
                    </span>
                    <span className="text-xs font-bold text-gray-400">
                      {items.length} วัน
                    </span>
                  </div>

                  {/* Days in Month */}
                  {items.map((h) => {
                    const cfg =
                      HOLIDAY_TYPES.find((t) => t.value === h.holiday_type) ||
                      HOLIDAY_TYPES[0];
                    const d = new Date(h.holiday_date + "T00:00:00");
                    const dayNames = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
                    const dayName = dayNames[d.getDay()];
                    const dayNum = d.getDate();

                    return (
                      <div
                        key={h.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors"
                      >
                        {/* Date Badge */}
                        <div
                          className={`
                          w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border
                          ${cfg.color}
                        `}
                        >
                          <span className="text-[10px] font-bold leading-none opacity-70">
                            {dayName}
                          </span>
                          <span className="text-base font-bold leading-tight">
                            {dayNum}
                          </span>
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-700 truncate">
                            {h.name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {h.holiday_date}
                          </p>
                        </div>

                        {/* Type Badge */}
                        <span
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex-shrink-0 ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(h.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-rose-400 hover:bg-rose-50 transition-colors flex-shrink-0"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leave Policy Section ─────────────────────────────────────────────────────

const LEAVE_ICON: Record<string, string> = {
  vacation: "🌴",
  sick: "🤒",
  personal: "📋",
  special_personal: "⭐",
  other: "📝",
};

function LeavePolicySection() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // id ที่กำลัง save
  const [saved, setSaved] = useState<string | null>(null); // id ที่ save สำเร็จ

  useEffect(() => {
    supabase
      .from("leave_policies")
      .select("*")
      .order("days_per_year", { ascending: false })
      .then(({ data }) => {
        if (data) setPolicies(data as LeavePolicy[]);
        setLoading(false);
      });
  }, []);

  const handleSave = async (policy: LeavePolicy) => {
    setSaving(policy.id);
    await supabase
      .from("leave_policies")
      .update({
        days_per_year: policy.days_per_year,
        max_carry_over: policy.max_carry_over,
        sick_paid_limit: policy.sick_paid_limit,
        allow_hourly: policy.allow_hourly,
        is_active: policy.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", policy.id);
    setSaving(null);
    setSaved(policy.id);
    setTimeout(() => setSaved(null), 2000);
  };

  const update = (id: string, field: keyof LeavePolicy, value: unknown) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-100 h-32 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* header note */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-sky-50 border border-sky-100 rounded-2xl">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-xs text-sky-700 leading-relaxed">
          การแก้ไขจะมีผลกับพนักงานที่สมัครใหม่ในปีถัดไป · พนักงานที่มี balance
          อยู่แล้วจะไม่ถูกกระทบ
        </p>
      </div>

      {policies.map((policy) => {
        const isSaving = saving === policy.id;
        const isSaved = saved === policy.id;
        return (
          <div
            key={policy.id}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${policy.is_active ? "border-gray-100" : "border-gray-100 opacity-60"}`}
          >
            {/* card header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">
                  {LEAVE_ICON[policy.leave_type] ?? "📅"}
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-700">
                    {policy.label_th}
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {policy.leave_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* active toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <span className="text-xs text-gray-400">เปิดใช้</span>
                  <div
                    onClick={() =>
                      update(policy.id, "is_active", !policy.is_active)
                    }
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${policy.is_active ? "bg-sky-500" : "bg-gray-200"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${policy.is_active ? "left-4" : "left-0.5"}`}
                    />
                  </div>
                </label>
              </div>
            </div>

            {/* fields */}
            <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* days_per_year */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 mb-1.5">
                  วัน/ปี
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={policy.days_per_year}
                    onChange={(e) =>
                      update(policy.id, "days_per_year", Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 transition-colors"
                  />
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    วัน
                  </span>
                </div>
                {policy.days_per_year === 0 && (
                  <p className="text-[10px] text-amber-500 mt-1">
                    0 = ไม่จำกัด
                  </p>
                )}
              </div>

              {/* max_carry_over */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 mb-1.5">
                  สะสมสูงสุด
                </p>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={policy.max_carry_over}
                    onChange={(e) =>
                      update(
                        policy.id,
                        "max_carry_over",
                        Number(e.target.value),
                      )
                    }
                    className="w-full px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 transition-colors"
                  />
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    วัน
                  </span>
                </div>
                {policy.max_carry_over === 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">0 = ไม่สะสม</p>
                )}
              </div>

              {/* sick_paid_limit — hidden for now */}
              {/* allow_hourly — hidden for now */}
            </div>

            {/* save button */}
            <div className="px-5 pb-4 flex justify-end">
              <button
                onClick={() => handleSave(policy)}
                disabled={isSaving}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  isSaved
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    : "bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
                }`}
              >
                {isSaving ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        opacity=".25"
                      />
                      <path d="M21 12a9 9 0 00-9-9" />
                    </svg>
                    กำลังบันทึก...
                  </>
                ) : isSaved ? (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="w-3.5 h-3.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    บันทึกแล้ว
                  </>
                ) : (
                  "บันทึก"
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Leave Balance Admin Section ──────────────────────────────────────────────

interface UserWithBalances {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
  avatar_url: string | null;
  balances: LeaveBalanceWithPolicy[];
}

const LEAVE_ORDER = [
  "vacation",
  "sick",
  "personal",
  "special_personal",
  "other",
];

function LeaveBalanceAdminSection() {
  const currentYear = new Date().getFullYear();
  const [users, setUsers] = useState<UserWithBalances[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithBalances | null>(
    null,
  );
  const [editValues, setEditValues] = useState<
    Record<string, { used_days: number; entitled_days: number }>
  >({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  // ── โหลด users + balances ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: balances }] = await Promise.all([
        supabase
          .from("profiles_with_avatar")
          .select("id, first_name, last_name, department, avatar_url")
          .order("first_name"),
        supabase
          .from("leave_balances_with_policy")
          .select("*")
          .eq("year", currentYear),
      ]);

      if (!profiles) return;

      const balanceMap = new Map<string, LeaveBalanceWithPolicy[]>();
      (balances ?? []).forEach((b) => {
        const list = balanceMap.get(b.user_id) ?? [];
        list.push(b as LeaveBalanceWithPolicy);
        balanceMap.set(b.user_id, list);
      });

      const result: UserWithBalances[] = profiles.map((p) => ({
        ...p,
        balances: (balanceMap.get(p.id) ?? []).sort(
          (a, b) =>
            LEAVE_ORDER.indexOf(a.leave_type) -
            LEAVE_ORDER.indexOf(b.leave_type),
        ),
      }));

      setUsers(result);
      setLoading(false);
    })();
  }, []);

  // ── เปิด drawer แก้ไขพนักงาน ────────────────────────────────────────────────
  const openEdit = (user: UserWithBalances) => {
    setSelectedUser(user);
    const init: Record<string, { used_days: number; entitled_days: number }> =
      {};
    user.balances.forEach((b) => {
      init[b.leave_type] = {
        used_days: Number(b.used_days) * 8,
        entitled_days: Number(b.entitled_days) * 8,
      };
    });
    setEditValues(init);
    setSaved(false);
  };

  // ── บันทึก ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);

    const updates = selectedUser.balances.map((b) => {
      const v = editValues[b.leave_type];
      return supabase
        .from("leave_balances")
        .update({
          used_days: (v?.used_days ?? Number(b.used_days) * 8) / 8,
          entitled_days: (v?.entitled_days ?? Number(b.entitled_days) * 8) / 8,
          updated_at: new Date().toISOString(),
        })
        .eq("id", b.id);
    });

    await Promise.all(updates);

    // อัปเดต local state
    setUsers((prev) =>
      prev.map((u) =>
        u.id !== selectedUser.id
          ? u
          : {
              ...u,
              balances: u.balances.map((b) => ({
                ...b,
                used_days: (editValues[b.leave_type]?.used_days ?? Number(b.used_days) * 8) / 8,
                entitled_days: (editValues[b.leave_type]?.entitled_days ?? Number(b.entitled_days) * 8) / 8,
              })),
            },
      ),
    );

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const filtered = users.filter((u) => {
    const name = `${u.first_name} ${u.last_name}`.toLowerCase();
    return (
      name.includes(search.toLowerCase()) ||
      (u.department ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-gray-100 h-20 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* search */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาพนักงาน..."
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 transition-colors"
        />
      </div>

      {/* user list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            พนักงานทั้งหมด ({filtered.length} คน) · ปี {currentYear}
          </h3>
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.map((u) => {
            const name =
              `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
              "ไม่ระบุชื่อ";
            const initial = name.charAt(0);
            const totalUsed = u.balances.reduce(
              (s, b) => s + Number(b.used_days),
              0,
            );
            const totalDays = u.balances.reduce(
              (s, b) => s + Number(b.total_days),
              0,
            );
            const isSelected = selectedUser?.id === u.id;

            return (
              <div key={u.id}>
                {/* row */}
                <button
                  onClick={() =>
                    isSelected ? setSelectedUser(null) : openEdit(u)
                  }
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${isSelected ? "bg-sky-50/60" : "hover:bg-gray-50/50"}`}
                >
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {initial}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {u.department ?? "ไม่ระบุแผนก"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-700">
                      {totalUsed * 8}{" "}
                      <span className="text-xs font-normal text-gray-400">
                        / {totalDays * 8} ชม.
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-400">ใช้ไปแล้ว</p>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`w-4 h-4 text-gray-300 transition-transform flex-shrink-0 ${isSelected ? "rotate-90" : ""}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* inline edit panel */}
                {isSelected && (
                  <div className="px-5 pb-5 bg-sky-50/40 border-t border-sky-100">
                    <p className="text-[11px] font-bold text-sky-600 uppercase tracking-widest py-3">
                      แก้ไขสิทธิ์วันลา — {name}
                    </p>

                    <div className="space-y-3">
                      {selectedUser.balances.map((b) => {
                        const cfg =
                          LEAVE_TYPE_CONFIG[
                            b.leave_type as keyof typeof LEAVE_TYPE_CONFIG
                          ];
                        const v = editValues[b.leave_type];
                        return (
                          <div
                            key={b.leave_type}
                            className="bg-white rounded-xl border border-gray-100 px-4 py-3"
                          >
                            <p
                              className={`text-xs font-bold mb-3 ${cfg?.color ?? "text-gray-600"}`}
                            >
                              {b.label_th}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {/* entitled_days */}
                              <div>
                                <p className="text-[11px] text-gray-400 mb-1.5">
                                  สิทธิ์ (ชม./ปี)
                                </p>
                                <input
                                  type="number"
                                  min={0}
                                  value={v?.entitled_days ?? 0}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({
                                      ...prev,
                                      [b.leave_type]: {
                                        ...prev[b.leave_type],
                                        entitled_days: Number(e.target.value),
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 transition-colors"
                                />
                              </div>
                              {/* used_days */}
                              <div>
                                <p className="text-[11px] text-gray-400 mb-1.5">
                                  ใช้ไปแล้ว (ชม.)
                                </p>
                                <input
                                  type="number"
                                  min={0}
                                  value={v?.used_days ?? 0}
                                  onChange={(e) =>
                                    setEditValues((prev) => ({
                                      ...prev,
                                      [b.leave_type]: {
                                        ...prev[b.leave_type],
                                        used_days: Number(e.target.value),
                                      },
                                    }))
                                  }
                                  className="w-full px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50 transition-colors"
                                />
                              </div>
                            </div>
                            {/* remaining preview */}
                            <p className="text-[11px] text-gray-400 mt-2">
                              คงเหลือ:{" "}
                              <span className="font-bold text-emerald-600">
                                {Math.max(
                                  0,
                                  (v?.entitled_days ?? 0) +
                                    Number(b.carried_over_days) * 8 -
                                    (v?.used_days ?? 0),
                                )}{" "}
                                ชม.
                              </span>
                              {Number(b.carried_over_days) > 0 && (
                                <span className="ml-1 text-violet-500">
                                  (รวมยกยอด {Number(b.carried_over_days) * 8} ชม.)
                                </span>
                              )}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* save button */}
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
                          saved
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
                        }`}
                      >
                        {saving ? (
                          <>
                            <svg
                              className="w-3.5 h-3.5 animate-spin"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                opacity=".25"
                              />
                              <path d="M21 12a9 9 0 00-9-9" />
                            </svg>
                            กำลังบันทึก...
                          </>
                        ) : saved ? (
                          <>
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              className="w-3.5 h-3.5"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            บันทึกแล้ว
                          </>
                        ) : (
                          "บันทึก"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section map ──────────────────────────────────────────────────────────────
const SECTION_COMPONENTS: Record<string, React.ReactNode> = {
  report_manage: <ReportManagementSection />,
  holidays: <HolidaysSection />,
  permissions: <PermissionsSection />,
  leave: <LeavePolicySection />,
  leave_balance: <LeaveBalanceAdminSection />,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("report_manage");

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
        <div className="px-5 pt-5 pb-0">
          <p className="text-xs text-gray-400 font-medium">Admin · #1020</p>
          <h1 className="text-xl font-bold text-gray-800">Settings</h1>
        </div>

        {/* ── Horizontal Sub-nav ── */}
        <div
          className="flex gap-1 px-4 mt-4 overflow-x-auto
          [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-3 text-sm font-semibold
                  whitespace-nowrap transition-all duration-200 flex-shrink-0
                  ${
                    isActive
                      ? "text-sky-600"
                      : "text-gray-400 hover:text-gray-600"
                  }
                `}
              >
                {/* Icon */}
                <span
                  className={`transition-colors ${isActive ? "text-sky-500" : "text-gray-400"}`}
                >
                  {tab.icon}
                </span>
                {tab.label}

                {/* Active underline */}
                <span
                  className={`
                  absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all duration-200
                  ${isActive ? "bg-sky-500 opacity-100" : "bg-transparent opacity-0"}
                `}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 space-y-4">{SECTION_COMPONENTS[activeTab]}</div>
    </main>
  );
}
