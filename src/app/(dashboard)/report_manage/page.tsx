"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkDetail { id: string; title: string; value_key: string; }
interface EndUser { id: string; name: string; }
interface Project { id: string; project_no: string; name: string | null; end_user_id: string; }

export default function ReportManagePage() {
  const [loading, setLoading] = useState(true);
  
  // States สำหรับเก็บข้อมูลที่ดึงมา
  const [details, setDetails] = useState<WorkDetail[]>([]);
  const [endUsers, setEndUsers] = useState<EndUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // States สำหรับฟอร์มเพิ่มข้อมูล
  const [newDetail, setNewDetail] = useState("");
  const [newEndUser, setNewEndUser] = useState("");
  const [newProjectNo, setNewProjectNo] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedEndUserForProject, setSelectedEndUserForProject] = useState("");

  // 1. ดึงข้อมูลทั้งหมดเมื่อเปิดหน้า
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [dRes, uRes, pRes] = await Promise.all([
      supabase.from("work_details").select("*").order("created_at", { ascending: true }),
      supabase.from("end_users").select("*").order("created_at", { ascending: true }),
      supabase.from("projects").select("*").order("created_at", { ascending: true })
    ]);
    if (dRes.data) setDetails(dRes.data);
    if (uRes.data) setEndUsers(uRes.data);
    if (pRes.data) setProjects(pRes.data);
    setLoading(false);
  };

  // ─── Functions จัดการ Work Detail ──────────────────────────────────────────
  const addDetail = async () => {
    if (!newDetail.trim()) return;
    const valueKey = newDetail.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const { data, error } = await supabase.from("work_details").insert({ title: newDetail.trim(), value_key: valueKey }).select().single();
    if (!error && data) {
      setDetails([...details, data]);
      setNewDetail("");
    }
  };

  const deleteDetail = async (id: string) => {
    if (!confirm("แน่ใจหรือไม่ที่จะลบประเภทงานนี้?")) return;
    await supabase.from("work_details").delete().eq("id", id);
    setDetails(details.filter(d => d.id !== id));
  };

  // ─── Functions จัดการ End User ─────────────────────────────────────────────
  const addEndUser = async () => {
    if (!newEndUser.trim()) return;
    const { data, error } = await supabase.from("end_users").insert({ name: newEndUser.trim() }).select().single();
    if (!error && data) {
      setEndUsers([...endUsers, data]);
      setNewEndUser("");
    }
  };

  const deleteEndUser = async (id: string) => {
    if (!confirm("ลบลูกค้านี้จะลบโปรเจกต์ที่เกี่ยวข้องด้วย แน่ใจหรือไม่?")) return;
    await supabase.from("end_users").delete().eq("id", id);
    setEndUsers(endUsers.filter(u => u.id !== id));
    setProjects(projects.filter(p => p.end_user_id !== id)); // เอาโปรเจกต์ของลูกค้านี้ออกจากหน้าจอด้วย
  };

  // ─── Functions จัดการ Project ──────────────────────────────────────────────
  const addProject = async () => {
    if (!newProjectNo.trim() || !selectedEndUserForProject) return;
    const { data, error } = await supabase.from("projects").insert({
      project_no: newProjectNo.trim(),
      name: newProjectName.trim() || null,
      end_user_id: selectedEndUserForProject
    }).select().single();
    
    if (!error && data) {
      setProjects([...projects, data]);
      setNewProjectNo("");
      setNewProjectName("");
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm("แน่ใจหรือไม่ที่จะลบโปรเจกต์นี้?")) return;
    await supabase.from("projects").delete().eq("id", id);
    setProjects(projects.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin"></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-28 md:pb-10">
      {/* ── Top Header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-sm border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-xs text-gray-400 font-medium">Admin Settings</p>
          <h1 className="text-xl font-bold text-gray-800 leading-tight">จัดการข้อมูลตัวเลือก Report</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6">

        {/* ── Section 1: ประเภทงาน (Work Details) ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-500 flex items-center justify-center">🔧</span>
            <h2 className="text-sm font-bold text-gray-700">ประเภทงาน (Work Details)</h2>
          </div>
          
          <div className="space-y-2 mb-4">
            {details.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">ยังไม่มีข้อมูล</p> : null}
            {details.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-sm font-medium text-gray-700">{idx + 1}. {item.title}</span>
                <button onClick={() => deleteDetail(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" value={newDetail} onChange={(e) => setNewDetail(e.target.value)}
              placeholder="เช่น Wiring, Testing..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none transition-all"
            />
            <button onClick={addDetail} disabled={!newDetail.trim()} className="px-4 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-200 text-white rounded-xl text-sm font-bold transition-all">
              เพิ่ม
            </button>
          </div>
        </section>

        {/* ── Section 2: ลูกค้า (End Users) ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-500 flex items-center justify-center">🏢</span>
            <h2 className="text-sm font-bold text-gray-700">รายชื่อลูกค้า (End Users)</h2>
          </div>
          
          <div className="space-y-2 mb-4">
            {endUsers.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">ยังไม่มีข้อมูล</p> : null}
            {endUsers.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-sm font-medium text-gray-700">{idx + 1}. {item.name}</span>
                <button onClick={() => deleteEndUser(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">✕</button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" value={newEndUser} onChange={(e) => setNewEndUser(e.target.value)}
              placeholder="เช่น Toyota, Honda..."
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
            <button onClick={addEndUser} disabled={!newEndUser.trim()} className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 text-white rounded-xl text-sm font-bold transition-all">
              เพิ่ม
            </button>
          </div>
        </section>

        {/* ── Section 3: โปรเจกต์ (Projects) ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-500 flex items-center justify-center">📁</span>
            <h2 className="text-sm font-bold text-gray-700">รายชื่อโปรเจกต์ (Projects)</h2>
          </div>

          <div className="space-y-2 mb-4">
            {projects.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">ยังไม่มีข้อมูล</p> : null}
            {projects.map((item, idx) => {
              const endUserName = endUsers.find(u => u.id === item.end_user_id)?.name || "ไม่ทราบลูกค้า";
              return (
                <div key={item.id} className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100 gap-1 relative">
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-bold text-gray-800">{item.project_no} <span className="text-gray-500 font-normal">{item.name ? `· ${item.name}` : ''}</span></span>
                    <button onClick={() => deleteProject(item.id)} className="text-gray-400 hover:text-red-500 transition-colors absolute top-3 right-3">✕</button>
                  </div>
                  <span className="text-xs text-emerald-600 font-medium bg-emerald-100 w-fit px-2 py-0.5 rounded-full">🏢 {endUserName}</span>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 space-y-3">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">เพิ่มโปรเจกต์ใหม่</p>
            
            <select 
              value={selectedEndUserForProject} onChange={(e) => setSelectedEndUserForProject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-amber-400 outline-none bg-white cursor-pointer"
            >
              <option value="" disabled>เลือกลูกค้า (End User)...</option>
              {endUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <div className="flex gap-2">
              <input 
                type="text" value={newProjectNo} onChange={(e) => setNewProjectNo(e.target.value)}
                placeholder="Project No. (เช่น 1155)"
                className="w-1/3 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-amber-400 outline-none"
              />
              <input 
                type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="ชื่อโปรเจกต์ (ถ้ามี)"
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-amber-400 outline-none"
              />
            </div>
            
            <button 
              onClick={addProject} 
              disabled={!newProjectNo.trim() || !selectedEndUserForProject} 
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 text-white rounded-xl text-sm font-bold transition-all"
            >
              + เพิ่มโปรเจกต์
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}