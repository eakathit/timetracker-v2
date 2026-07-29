"use client";

import { useState, useEffect, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { isManagerRole } from "@/lib/roles";
import { LEAVE_TYPE_CONFIG } from "@/types/leave";
import * as XLSX from "xlsx";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  department: string;
}

interface LeaveReqJoined {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  hours: number | null;
  period_label: string | null;
  reason: string;
  status: string;
  approved_by: string | null;
  actioned_at: string | null;
  profile?: Profile;
  approver_profile?: Profile;
}

export default function LeaveReportPage() {
  const [role, setRole] = useState<string>("employee");
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveReqJoined[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  
  // Filters
  const [searchName, setSearchName] = useState("");
  const [selectedDept, setSelectedDept] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchName, selectedDept, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const userRole = profile?.role || "employee";
      setRole(userRole);

      if (isManagerRole(userRole)) {
        // Fetch approved leave requests
        const { data: leaveData } = await supabase
          .from("leave_requests")
          .select("*")
          .eq("status", "approved")
          .order("start_date", { ascending: false });

        // Fetch all profiles to join data
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, department");

        if (leaveData && profilesData) {
          const profilesMap = new Map<string, Profile>();
          const depts = new Set<string>();
          
          profilesData.forEach((p) => {
            profilesMap.set(p.id, p);
            if (p.department) depts.add(p.department);
          });

          setDepartments(Array.from(depts).sort());

          const joinedData = leaveData.map((req) => ({
            ...req,
            profile: profilesMap.get(req.user_id),
            approver_profile: req.approved_by ? profilesMap.get(req.approved_by) : undefined,
          }));

          setRequests(joinedData);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Name filter
      if (searchName) {
        const fullName = `${req.profile?.first_name || ""} ${req.profile?.last_name || ""}`.toLowerCase();
        if (!fullName.includes(searchName.toLowerCase())) return false;
      }
      
      // Department filter
      if (selectedDept !== "All" && req.profile?.department !== selectedDept) {
        return false;
      }

      // Date filter (Check if start_date or end_date falls in the selected month/year)
      const startDate = new Date(req.start_date);
      const endDate = new Date(req.end_date);
      
      // If we select a month and year, we check if the leave overlaps with that month
      // For simplicity, we check if start_date OR end_date month/year matches
      const startMatches = startDate.getMonth() === selectedMonth && startDate.getFullYear() === selectedYear;
      const endMatches = endDate.getMonth() === selectedMonth && endDate.getFullYear() === selectedYear;
      
      if (!startMatches && !endMatches) {
        // Also check if the leave spans across the selected month completely
        const targetDate = new Date(selectedYear, selectedMonth, 15);
        if (!(startDate <= targetDate && endDate >= targetDate)) {
          return false;
        }
      }

      return true;
    });
  }, [requests, searchName, selectedDept, selectedMonth, selectedYear]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredRequests, currentPage]);

  const handleExport = () => {
    if (filteredRequests.length === 0) return;

    const dataToExport = filteredRequests.map((req) => {
      const typeConfig = LEAVE_TYPE_CONFIG[req.leave_type as keyof typeof LEAVE_TYPE_CONFIG];
      return {
        "ชื่อพนักงาน": `${req.profile?.first_name || "-"} ${req.profile?.last_name || "-"}`,
        "แผนก": req.profile?.department || "-",
        "ประเภทการลา": typeConfig?.label || req.leave_type,
        "วันที่เริ่ม": req.start_date,
        "วันที่สิ้นสุด": req.end_date,
        "จำนวนวัน": req.days,
        "ช่วงเวลา": req.period_label || "-",
        "เหตุผล": req.reason || "-",
        "ผู้อนุมัติ": req.approver_profile ? `${req.approver_profile.first_name} ${req.approver_profile.last_name}` : "-",
        "วันที่อนุมัติ": req.actioned_at ? new Date(req.actioned_at).toLocaleString('th-TH') : "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "LeaveReport");
    XLSX.writeFile(workbook, `Leave_Report_${selectedYear}_${String(selectedMonth + 1).padStart(2, '0')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!isManagerRole(role)) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-gray-500">หน้านี้สงวนไว้สำหรับ Manager และ Admin เท่านั้น</p>
        </div>
      </div>
    );
  }

  const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">📋</span>
            รายงานประวัติการลา
          </h1>
          <p className="text-gray-500 text-sm mt-1">ตรวจสอบและดาวน์โหลดประวัติการลาที่อนุมัติแล้วของพนักงาน</p>
        </div>
        
        <button
          onClick={handleExport}
          disabled={filteredRequests.length === 0}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            เดือน / ปี
          </label>
          <div className="flex gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5 outline-none transition-all"
            >
              {months.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-24 bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-sky-500 focus:border-sky-500 block p-2.5 outline-none transition-all"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y + 543}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            แผนก
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5 outline-none transition-all"
          >
            <option value="All">ทุกแผนก</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            ค้นหาชื่อพนักงาน
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="พิมพ์ชื่อ..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-sky-500 focus:border-sky-500 block w-full pl-10 p-2.5 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats (Optional - Cute addition) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-100 text-sky-500 rounded-full flex items-center justify-center flex-shrink-0 text-xl">
            📊
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium">รายการทั้งหมด</p>
            <p className="text-xl font-bold text-gray-800">{filteredRequests.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-100 text-violet-500 rounded-full flex items-center justify-center flex-shrink-0 text-xl">
            🌴
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium">ลาพักร้อน</p>
            <p className="text-xl font-bold text-gray-800">
              {filteredRequests.filter(r => r.leave_type === 'vacation').length}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center flex-shrink-0 text-xl">
            💊
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium">ลาป่วย</p>
            <p className="text-xl font-bold text-gray-800">
              {filteredRequests.filter(r => r.leave_type === 'sick').length}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center flex-shrink-0 text-xl">
            📋
          </div>
          <div>
            <p className="text-gray-500 text-xs font-medium">ลากิจ</p>
            <p className="text-xl font-bold text-gray-800">
              {filteredRequests.filter(r => ['personal', 'special_personal'].includes(r.leave_type)).length}
            </p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold">พนักงาน</th>
                <th className="px-6 py-4 font-semibold">ประเภท</th>
                <th className="px-6 py-4 font-semibold">วันที่ลา</th>
                <th className="px-6 py-4 font-semibold">ระยะเวลา</th>
                <th className="px-6 py-4 font-semibold">เหตุผล</th>
                <th className="px-6 py-4 font-semibold text-right">ผู้อนุมัติ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRequests.length > 0 ? (
                paginatedRequests.map((req) => {
                  const typeConfig = LEAVE_TYPE_CONFIG[req.leave_type as keyof typeof LEAVE_TYPE_CONFIG];
                  const isOneDay = req.start_date === req.end_date;
                  
                  return (
                    <tr key={req.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800">
                          {req.profile?.first_name} {req.profile?.last_name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{req.profile?.department || "ไม่มีแผนก"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${typeConfig?.bg} ${typeConfig?.color} ${typeConfig?.border}`}>
                          <span>{typeConfig?.icon}</span>
                          {typeConfig?.label || req.leave_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-800">
                          {isOneDay 
                            ? new Date(req.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
                            : `${new Date(req.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${new Date(req.end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
                          }
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(req.start_date).getFullYear() + 543}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-700">
                          {req.days} วัน {req.hours ? `(${req.hours} ชม.)` : ""}
                        </div>
                        {req.period_label && (
                          <div className="text-xs text-gray-400 mt-0.5">{req.period_label}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-600 line-clamp-2 max-w-[200px]" title={req.reason}>
                          {req.reason || "-"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-gray-800">
                          {req.approver_profile?.first_name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {req.actioned_at ? new Date(req.actioned_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : "-"}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl opacity-50">🍃</span>
                    </div>
                    <p className="text-gray-500 font-medium">ไม่พบประวัติการลาในเดือนนี้</p>
                    <p className="text-gray-400 text-sm mt-1">ลองเปลี่ยนเดือน/ปี หรือเงื่อนไขการค้นหาอื่น</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              หน้า {currentPage} จาก {totalPages} ({filteredRequests.length} รายการ)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
