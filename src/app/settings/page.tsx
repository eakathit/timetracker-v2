"use client";

import { useState } from "react";

// ─── Sub-nav config ───────────────────────────────────────────────────────────
const SETTINGS_TABS = [
  {
    id: "system",
    label: "ข้อมูลระบบ",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
  {
    id: "permissions",
    label: "จัดการสิทธิ์",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "worktime",
    label: "เวลาทำงาน",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    ),
  },
  {
    id: "location",
    label: "สถานที่",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "การแจ้งเตือน",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    ),
  },
];

// ─── Reusable UI ──────────────────────────────────────────────────────────────

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
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
        <p className="text-sm font-semibold text-gray-700 leading-tight">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5 truncate">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? "bg-sky-500" : "bg-gray-200"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : ""}`} />
    </button>
  );
}

function SelectInput({ options, value, onChange }: {
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
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: {
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
  admin:   "bg-rose-50 text-rose-500 border-rose-200",
  manager: "bg-amber-50 text-amber-600 border-amber-200",
  user:    "bg-sky-50 text-sky-500 border-sky-200",
  viewer:  "bg-gray-50 text-gray-500 border-gray-200",
};
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", manager: "Manager", user: "User", viewer: "Viewer",
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
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
          label="ชื่อบริษัท"
          description="แสดงในรายงานและเอกสารทั้งหมด"
        >
          <TextInput value={companyName} onChange={setCompanyName} placeholder="ชื่อบริษัท" />
        </SettingRow>
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>}
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
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1"/><path d="M22 22l-5-10-5 10M14.5 17h5"/></svg>}
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
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}
          label="เวอร์ชัน"
          description="TimeTracker V2"
        >
          <span className="px-3 py-1.5 text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 rounded-full">
            v{version}
          </span>
        </SettingRow>
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>}
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
  const [users, setUsers] = useState([
    { id: 1, name: "ช่างวิทย์", code: "1055", dept: "ช่างเทคนิค", role: "user",    active: true  },
    { id: 2, name: "นายสมชาย",  code: "1010", dept: "วิศวกร",     role: "manager", active: true  },
    { id: 3, name: "นางสมศรี",  code: "1020", dept: "HR",          role: "admin",   active: true  },
    { id: 4, name: "นายสมหมาย", code: "1088", dept: "ช่างเทคนิค", role: "viewer",  active: false },
  ]);

  const cycleRole = (id: number) => {
    const roles = ["viewer", "user", "manager", "admin"];
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const next = roles[(roles.indexOf(u.role) + 1) % roles.length];
        return { ...u, role: next };
      })
    );
  };

  return (
    <div className="space-y-4">
      <SettingGroup title={`ผู้ใช้งานทั้งหมด (${users.length} คน)`}>
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-4 px-5 py-4">
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${u.active ? "bg-gradient-to-br from-sky-400 to-blue-500" : "bg-gray-300"}`}>
              {u.name[0]}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-700 truncate">{u.name}</p>
                {!u.active && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">ปิดใช้งาน</span>}
              </div>
              <p className="text-xs text-gray-400">#{u.code} · {u.dept}</p>
            </div>
            {/* Role badge — click to cycle */}
            <button
              onClick={() => cycleRole(u.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all hover:scale-105 ${ROLE_STYLES[u.role]}`}
              title="คลิกเพื่อเปลี่ยนสิทธิ์"
            >
              {ROLE_LABELS[u.role]}
            </button>
          </div>
        ))}
      </SettingGroup>

      {/* Role legend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">ระดับสิทธิ์</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { role: "admin",   desc: "เข้าถึงได้ทุกส่วน" },
            { role: "manager", desc: "ดูรายงานและอนุมัติ" },
            { role: "user",    desc: "ตอกบัตรและรายงานตัวเอง" },
            { role: "viewer",  desc: "ดูข้อมูลอย่างเดียว" },
          ].map((r) => (
            <div key={r.role} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${ROLE_STYLES[r.role]}`}>
              <span className="text-xs font-bold">{ROLE_LABELS[r.role]}</span>
              <span className="text-[10px] opacity-70">— {r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorktimeSection() {
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime]     = useState("17:00");
  const [lateGrace, setLateGrace] = useState("15");
  const [otEnabled, setOtEnabled] = useState(true);
  const [otMinHours, setOtMinHours] = useState("1");
  const [workDays, setWorkDays]   = useState([true, true, true, true, true, false, false]); // จ–ศ

  const dayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  return (
    <div className="space-y-4">
      <SettingGroup title="เวลาทำงานปกติ">
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>}
          label="เวลาเข้างาน"
        >
          <input
            type="time" value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
          />
        </SettingRow>
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 9 14"/></svg>}
          label="เวลาออกงาน"
        >
          <input
            type="time" value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
          />
        </SettingRow>
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          label="ระยะเวลาผ่อนผันมาสาย"
          description="นับเป็นมาสายหลังจากนาทีที่"
        >
          <div className="flex items-center gap-2">
            <SelectInput
              value={lateGrace}
              onChange={setLateGrace}
              options={["0","5","10","15","30"].map((v) => ({ value: v, label: `${v} นาที` }))}
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
                onClick={() => setWorkDays((prev) => prev.map((v, idx) => idx === i ? !v : v))}
                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-150
                  ${workDays[i]
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
            {workDays.filter(Boolean).length} วัน/สัปดาห์ · {workDays.filter(Boolean).length * 8} ชม./สัปดาห์
          </p>
        </div>
      </SettingGroup>

      <SettingGroup title="การทำงานล่วงเวลา (OT)">
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3M17 3.5L21 7"/></svg>}
          label="เปิดใช้งาน OT"
          description="อนุญาตให้พนักงานยื่นขอทำ OT"
        >
          <Toggle enabled={otEnabled} onChange={() => setOtEnabled(!otEnabled)} />
        </SettingRow>
        {otEnabled && (
          <SettingRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
            label="ขั้นต่ำชั่วโมง OT"
            description="นับ OT เมื่อทำงานเกินเวลาอย่างน้อย"
          >
            <SelectInput
              value={otMinHours}
              onChange={setOtMinHours}
              options={["0.5","1","2"].map((v) => ({ value: v, label: `${v} ชม.` }))}
            />
          </SettingRow>
        )}
      </SettingGroup>
    </div>
  );
}

function LocationSection() {
  const [gpsRequired, setGpsRequired]   = useState(true);
  const [radiusMeters, setRadiusMeters] = useState("200");
  const [locations, setLocations] = useState([
    { id: 1, name: "สำนักงานใหญ่", address: "123 ถ.สุขุมวิท กรุงเทพฯ", active: true },
    { id: 2, name: "โรงงาน A",      address: "456 ถ.บางนา สมุทรปราการ", active: true },
    { id: 3, name: "โรงพยาบาล C",   address: "789 ถ.พระราม 9 กรุงเทพฯ", active: false },
  ]);

  return (
    <div className="space-y-4">
      <SettingGroup title="การตรวจสอบตำแหน่ง">
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>}
          label="บังคับใช้ GPS"
          description="ต้องอยู่ในพื้นที่กำหนดจึงตอกบัตรได้"
        >
          <Toggle enabled={gpsRequired} onChange={() => setGpsRequired(!gpsRequired)} />
        </SettingRow>
        {gpsRequired && (
          <SettingRow
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>}
            label="รัศมีที่อนุญาต"
          >
            <SelectInput
              value={radiusMeters}
              onChange={setRadiusMeters}
              options={["50","100","200","500","1000"].map((v) => ({ value: v, label: `${v} ม.` }))}
            />
          </SettingRow>
        )}
      </SettingGroup>

      <SettingGroup title={`สถานที่ทำงาน (${locations.length} แห่ง)`}>
        {locations.map((loc) => (
          <div key={loc.id} className="flex items-center gap-4 px-5 py-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${loc.active ? "bg-sky-100 text-sky-500" : "bg-gray-100 text-gray-400"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-700">{loc.name}</p>
              <p className="text-xs text-gray-400 truncate">{loc.address}</p>
            </div>
            <button
              onClick={() => setLocations((prev) => prev.map((l) => l.id === loc.id ? { ...l, active: !l.active } : l))}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${loc.active ? "bg-sky-50 text-sky-500 hover:bg-sky-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                {loc.active
                  ? <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>
                  : <><rect x="3" y="3" width="18" height="18" rx="2"/></>
                }
              </svg>
            </button>
          </div>
        ))}
        <div className="px-5 py-3">
          <button className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs font-bold text-gray-400 hover:border-sky-300 hover:text-sky-500 hover:bg-sky-50/50 transition-all flex items-center justify-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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
    checkin:    true,
    checkout:   true,
    late:       true,
    ot_approve: true,
    leave:      false,
    report:     false,
    line:       false,
    email:      true,
  });

  const toggle = (key: keyof typeof notifs) =>
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <SettingGroup title="การแจ้งเตือนในแอป">
        {[
          { key: "checkin",  label: "เข้างาน",         desc: "เมื่อมีการตอกบัตรเข้างาน" },
          { key: "checkout", label: "ออกงาน",          desc: "เมื่อมีการตอกบัตรออกงาน" },
          { key: "late",     label: "มาสาย",           desc: "แจ้งเตือนเมื่อพนักงานมาสาย" },
          { key: "ot_approve", label: "อนุมัติ OT",   desc: "เมื่อคำขอ OT ได้รับการอนุมัติ" },
          { key: "leave",    label: "การลา",           desc: "เมื่อมีคำขอลาใหม่" },
          { key: "report",   label: "รายงานประจำวัน", desc: "เตือนกรอก Daily Report" },
        ].map((item) => (
          <SettingRow
            key={item.key}
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>}
            label={item.label}
            description={item.desc}
          >
            <Toggle enabled={notifs[item.key as keyof typeof notifs]} onChange={() => toggle(item.key as keyof typeof notifs)} />
          </SettingRow>
        ))}
      </SettingGroup>

      <SettingGroup title="ช่องทางแจ้งเตือน">
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>}
          label="Email"
          description="ส่งสรุปรายวันทาง Email"
        >
          <Toggle enabled={notifs.email} onChange={() => toggle("email")} />
        </SettingRow>
        <SettingRow
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
          label="LINE Notify"
          description="เชื่อมต่อ LINE Bot เพื่อแจ้งเตือน"
        >
          <Toggle enabled={notifs.line} onChange={() => toggle("line")} />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const SECTION_COMPONENTS: Record<string, React.ReactNode> = {
  system:        <SystemSection />,
  permissions:   <PermissionsSection />,
  worktime:      <WorktimeSection />,
  location:      <LocationSection />,
  notifications: <NotificationsSection />,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("system");

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100">
        <div className="px-5 pt-5 pb-0">
          <p className="text-xs text-gray-400 font-medium">Admin · #1020</p>
          <h1 className="text-xl font-bold text-gray-800">Settings</h1>
        </div>

        {/* ── Horizontal Sub-nav ── */}
        <div className="flex gap-1 px-4 mt-4 overflow-x-auto
          [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-3 text-sm font-semibold
                  whitespace-nowrap transition-all duration-200 flex-shrink-0
                  ${isActive
                    ? "text-sky-600"
                    : "text-gray-400 hover:text-gray-600"
                  }
                `}
              >
                {/* Icon */}
                <span className={`transition-colors ${isActive ? "text-sky-500" : "text-gray-400"}`}>
                  {tab.icon}
                </span>
                {tab.label}

                {/* Active underline */}
                <span className={`
                  absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full transition-all duration-200
                  ${isActive ? "bg-sky-500 opacity-100" : "bg-transparent opacity-0"}
                `} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 pt-5 space-y-4">
        {SECTION_COMPONENTS[activeTab]}

        {/* Save button */}
        <button className="w-full py-4 rounded-2xl bg-sky-500 text-white text-base font-bold shadow-lg shadow-sky-200 hover:bg-sky-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          บันทึกการตั้งค่า
        </button>
      </div>
    </main>
  );
}