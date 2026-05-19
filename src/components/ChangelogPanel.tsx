"use client";

import { useState, useEffect } from "react";

// ─── Types ──────────────────
type ChangelogTag = "feature" | "fix" | "improvement" | "breaking";

interface ChangelogEntry {
  version: string;
  date: string;
  items: {
    tag: ChangelogTag;
    text: string;
  }[];
}

// ─── Changelog Data (Dev/Admin) ────────────
const CHANGELOG: ChangelogEntry[] = [
  {
    version: "3.5.2",
    date: "2026-05-19",
    items: [
      { tag: "feature", text: "หน้า Daily Audit สามารถเปิดแท็บ Admin ให้พนักงานที่ขาดงาน และเพิ่มเวลา Check-in ย้อนหลังได้ เพื่อรองรับกรณีระบบล่มหรือไม่มีข้อมูลการเข้างาน" },
      { tag: "improvement", text: "ปรับค่าเริ่มต้น Force Check-in / Force Check-out เป็น 08:30 และ 17:30 พร้อมใช้วันที่ที่เลือกใน Daily Audit ให้ถูกต้อง" },
      { tag: "improvement", text: "บันทึกประวัติการแก้ไขเวลาโดย Admin พร้อมค่าเดิมและค่าใหม่ใน Timeline เพื่อใช้ตรวจสอบย้อนหลัง" },
    ],
  },
  {
    version: "3.5.1",
    date: "2026-05-13",
    items: [
      { tag: "improvement", text: "ปรับระบบยกเลิกใบลาให้พนักงานสามารถยกเลิกใบลาที่อนุมัติแล้วได้เองทันที โดยไม่ต้องรอ Admin/Manager อนุมัติคำขอยกเลิก" },
      { tag: "fix", text: "เมื่อยกเลิกใบลา ระบบจะคืนสิทธิ์วันลาและล้าง/คำนวณสถานะปฏิทินเข้างานทันทีผ่านฐานข้อมูล เพื่อให้จุดลาและ balance ตรงกัน" },
    ],
  },
  {
    version: "3.5.0",
    date: "2026-05-13",
    items: [
      { tag: "feature", text: "เพิ่ม Report On-site: Leader สามารถสร้างรายงานให้สมาชิกในห้อง On-site ได้หลัง Check-out โดยใช้เวลา Check-in/Check-out จากห้องจริง" },
      { tag: "feature", text: "เพิ่มประเภทงานสำหรับ On-site แยกจาก Daily Report ปกติในหน้า Settings > จัดการรายงาน" },
      { tag: "improvement", text: "รองรับเคส Factory + On-site ในวันเดียวกัน โดยเพิ่ม On-site เป็นรายการงานใหม่และไม่แก้รายงานเดิมของพนักงาน" },
      { tag: "improvement", text: "รองรับห้อง On-site ที่เลือก End User เป็น Other ให้ชื่อที่กรอกแสดงในรายงานได้ถูกต้อง" },
    ],
  },
  {
    version: "3.4.1",
    date: "2026-05-13",
    items: [
      { tag: "improvement", text: "เพิ่มกติกา Manager Holiday Swap: Manager ที่มาทำงานในวันหยุดสามารถเก็บสิทธิ์แลกวันหยุดได้โดยไม่ต้องครบ 8 ชั่วโมง" },
      { tag: "fix", text: "ปรับหน้า Check-out วันหยุดให้โหลดประเภทการทำงานเดิมจากบันทึกประจำวัน เพื่อไม่บังคับตรวจ GPS โรงงานผิดกรณี On-site/Mixed" },
      { tag: "improvement", text: "ปรับนโยบายสิทธิ์แลกวันหยุดให้แสดงและจัดการเป็นชั่วโมงให้ตรงกับระบบ Production" },
    ],
  },
  {
    version: "3.4.0",
    date: "2026-05-12",
    items: [
      { tag: "feature", text: "เพิ่มระบบขอยกเลิกใบลาที่อนุมัติแล้ว โดยพนักงานสามารถส่งเหตุผลขอยกเลิก และ Admin/Manager อนุมัติหรือไม่อนุมัติคำขอยกเลิกได้จากหน้า Requests" },
      { tag: "feature", text: "เพิ่มสถานะใบลาใหม่: รอยกเลิก และ ยกเลิกแล้ว พร้อมเก็บผู้ดำเนินการ เวลาอนุมัติยกเลิก และเหตุผลการขอยกเลิกเพื่อใช้ตรวจสอบย้อนหลัง" },
      { tag: "fix", text: "ปรับการคืนสิทธิ์วันลาให้เกิดเฉพาะตอนคำขอยกเลิกได้รับอนุมัติแล้ว ระหว่างรออนุมัติยกเลิกยังนับเป็นสิทธิ์ที่ใช้อยู่ตามเดิม" },
      { tag: "fix", text: "แก้การล้างปฏิทินเข้างานหลังอนุมัติยกเลิกใบลา ให้ลบจุดลาเต็มวันที่ไม่มี check-in และคำนวณสถานะกลับเป็นตรงเวลา/สายเมื่อมีเวลาเข้าออกจริง" },
      { tag: "improvement", text: "ปรับหน้า Profile ให้ refresh ข้อมูลปฏิทินเมื่อกลับมาโฟกัสหน้าเว็บ เพื่อลดโอกาสเห็นสถานะลาเก่าค้างหลังจัดการคำขอ" },
    ],
  },
  {
    version: "3.3.1",
    date: "2026-05-12",
    items: [
      { tag: "improvement", text: "ปรับหน้าแก้ไขสิทธิ์วันลาให้แยกคำว่า 'สิทธิ์ประจำปี' ออกจากยอดยกมา และแสดง 'สิทธิ์รวมปีนี้' เมื่อพนักงานมียอดยกมา" },
      { tag: "improvement", text: "ปรับตาราง preview ทบลาพักร้อนข้ามปีให้ scroll ภายในกล่อง พร้อม header sticky เพื่อไม่ให้รายชื่อพนักงานดันหน้าจอยาวเกินไป" },
    ],
  },
  {
    version: "3.3.0",
    date: "2026-05-11",
    items: [
      { tag: "feature",     text: "เพิ่มระบบทบลาพักร้อนข้ามปี โดยคำนวณจากยอดคงเหลือปีก่อนและจำกัดยอดสะสมลาพักร้อนไม่เกิน 12 วัน" },
      { tag: "feature",     text: "เพิ่มเครื่องมือ Admin สำหรับ preview และสร้างสิทธิ์วันลาปีใหม่ในหน้า Settings > วันลาพนักงาน" },
      { tag: "improvement", text: "ปรับหน้า Settings > นโยบายวันลา ให้แสดงหน่วยวันตามกติกาบริษัท พร้อมเทียบเป็นชั่วโมงสำหรับระบบ balance" },
      { tag: "improvement", text: "ปรับหน้า Requests ให้กรองคำขอของฉันตามช่วงเวลา เดือนนี้, เดือนก่อน และทั้งหมด พร้อม redesign การ์ดสรุปสถานะให้ดูอ่านง่ายขึ้น" },
      { tag: "improvement", text: "ปรับหน้า Leave Request และการ์ดใบลาให้ใช้ SVG icon ชุดเดียวกันทุกประเภทลา พร้อมปรับคำอธิบายประเภทลาให้ชัดเจนขึ้น" },
      { tag: "fix",         text: "แก้การสร้างบัญชีพนักงานใหม่ให้สร้างสิทธิ์วันลาปีปัจจุบันได้ถูกต้องหลังเข้าสู่ระบบครั้งแรก" },
    ],
  },
  {
    version: "3.2.1",
    date: "2026-05-08",
    items: [
      { tag: "improvement", text: "เพิ่มกติกาลาพักร้อนต้องยื่นล่วงหน้าอย่างน้อย 3 วัน โดยนับรวมวันที่ทำรายการ" },
      { tag: "fix",         text: "เพิ่มตัวตรวจสอบฝั่งฐานข้อมูลเพื่อกันการบันทึกใบลาพักร้อนที่ไม่ตรงตามกติกาบริษัท" },
    ],
  },
  {
    version: "3.2.0",
    date: "2026-05-07",
    items: [
      { tag: "feature",     text: "เพิ่มระบบจัดการสถานะการเข้าใช้งานพนักงาน: รออนุมัติ, ใช้งานได้, ระงับสิทธิ์" },
      { tag: "feature",     text: "Admin สามารถอนุมัติหรือระงับสิทธิ์พนักงานจากหน้า Settings > จัดการสิทธิ์ได้" },
      { tag: "improvement", text: "พนักงานใหม่ที่ Login ครั้งแรกจะเข้าสู่หน้ารอการอนุมัติ และยังใช้งานระบบไม่ได้จนกว่า Admin จะอนุมัติ" },
      { tag: "improvement", text: "พนักงานที่ถูกระงับสิทธิ์จะถูกบล็อกไม่ให้เข้าใช้งาน Web App และข้อมูลจะถูกซ่อนจากหน้ารายชื่อ/รายงานหลัก" },
      { tag: "feature",     text: "เพิ่มระบบ Calendar Plans ส่วนตัว บันทึกแผนงานลงฐานข้อมูลและแสดงเฉพาะแผนของผู้ใช้งานแต่ละคน" },
      { tag: "fix",         text: "แก้ไขปัญหาเพิ่มแผนใน Calendar แล้วข้อมูลหายหลัง Refresh หน้า" },
      { tag: "improvement", text: "เพิ่มปุ่มทางเข้า Calendar บนหน้า Profile สำหรับมือถือ และปรับ Calendar mobile ให้กระชับขึ้น" },
    ],
  },
  {
    version: "3.1.6",
    date: "2026-05-06",
    items: [
      { tag: "feature",         text: "หน้า Daily Audit เพิ่มแท็บ 'ลา' สำหรับพนักงานที่ใบลาอนุมัติแล้ว" },
    ],
  },
  {
    version: "3.1.5",
    date: "2026-04-19",
    items: [
      { tag: "fix",             text: "แก้ไขปัญหาการ Check-out ในวันหยุดแล้วระบบไม่บันทึกเวลาทำงาน" },
      { tag: "fix",             text: "แก้ไขข้อผิดพลาดการบันทึกสิทธิ์แลกวันหยุดไม่ลงในฐานข้อมูลระบบ" },
    ],
  },
  {
    version: "3.1.0",
    date: "2026-04-17",
    items: [
      { tag: "fix",             text: "เเก้ไข On-site ไม่ขึ้นเวลา OT" },
      { tag: "feature",         text: "เพิ่มปุ่มดูเเผนที่ google maps หน้า Daily audit" },
      { tag: "feature",         text: "เพิ่ม popup ปุ่มกลับโรงงานตอน Checkout On-site ก่อน 17:30" },
    ],
  },
  {
    version: "3.0.5",
    date: "2026-04-05",
    items: [
      { tag: "fix",             text: "แก้ไข Auto-checkout 17:30 ทำงานผิดพลาดในวันหยุดปฎิทิน (วันธรรมดา)" },
      { tag: "fix",             text: "แก้ไขหน้าวันลาพนักงาน เเปลงวันลาเป็นชม." },
      { tag: "improvement",     text: "แสดงปุ่ม 'แลกวันหยุด' เฉพาะผู้ที่มีสิทธิ์สะสมเเลกวันหยุด" },
    ],
  },
  {
    version: "3.0.1",
    date: "2026-04-05",
    items: [
      { tag: "fix",             text: "แก้ไข summary สิทธิ์วันลา หัวข้อแสดงเป็นชม." },
    ],
  },
  {
    version: "3.0.0",
    date: "2026-04-01",
    items: [
      { tag: "improvement",             text: "ปรับปรุง On-site สร้างห้องได้โดยไม่ต้องมีสมาชิกในห้องก่อน" },
      { tag: "feature",                 text: "On-site เพิ่มรายละเอียดคนขับรถ (ขาไป / ขากลับ) ในห้อง On-site ได้แล้ว" },
      { tag: "feature",                 text: " เพิ่มประเภทการลา 'แลกวันหยุด' ในหน้ายื่นลา" },
      { tag: "improvement",             text: "เปลี่ยนหน่วยสิทธิ์การลาจาก วัน เป็น ชม. เพื่อรองรับการลารายชั่วโมงได้อย่างแม่นยำ" },
    ],
  },
  {
    version: "2.6.0",
    date: "2026-03-25",
    items: [
      { tag: "improvement",             text: "เเก้ไข layout หน้าจัดการวันหยุด" },
    ],
  },
  {
    version: "2.5.5",
    date: "2026-03-24",
    items: [
      { tag: "feature",             text: "เพิ่มสิทธิ์วันลา" },
    ],
  },
  {
    version: "2.5.0",
    date: "2026-03-21",
    items: [
      { tag: "improvement",         text: "เเก้ไขให้สามารถสเเกน qr-code ได้ง่ายขึ้น" },
      { tag: "feature",             text: "เพิ่ม Other ในช่อง End User หน้ากรอก Report" },
      { tag: "feature",             text: "เพิ่มฟีเจอร์ Report Sync" },
    ],
  },
  {
    version: "2.0.1",
    date: "2026-03-20",
    items: [
      { tag: "fix",                 text: "เเก้ไข HR Attendance Export Excel ไม่ขึ้นเวลา OT" },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-03-20",
    items: [
      { tag: "improvement",         text: "เเก้ไขกดปุ่ม Start/End OT เเล้วเด้งไปเด้งมา" },
      { tag: "fix",                 text: "ปุ่ม Start/End OT ตรวจสอบรัศมีโรงงาน" },
      { tag: "improvement",         text: "เเก้ไข layout หน้า Qr code เเละเพิ่มปุ่มกด Fullscreen" },
    ],
  },
  {
    version: "1.9.0",
    date: "2026-03-18",
    items: [
      { tag: "feature",         text: "เพิ่มฟีเจอร์ Daily Audit" },
    ],
  },
  {
    version: "1.8.5",
    date: "2026-03-17",
    items: [
      { tag: "feature",         text: "เพิ่มชื่อผู้อนุมัติ/ไม่อนุมัติหน้ารายการ Request" },
    ],
  },
  {
    version: "1.8.0",
    date: "2026-03-17",
    items: [
      { tag: "fix",         text: "เเก้ไขเพิ่ม End User ใหม่เเล้ว default เป็นสีฟ้า" },
      { tag: "improvement", text: "สร้างห้อง On-site ลบช่องกรอก Project No. ตอนเลือก Other End User" },
      { tag: "fix",         text: "เเก้ไข On-site เพิ่มพนักงานเข้าห้องก่อน 8:30 ขึ้นว่ามาสาย" },
    ],
  },
  {
    version: "1.7.5",
    date: "2026-03-16",
    items: [
      { tag: "feature",     text: "Qr-code Check-in เพิ่มรายชื่อพนักงาน Checkin factory/on-site" },
      { tag: "improvement", text: "ลบการ์ดเนื้อหาหน้า profile ที่ไม่ได้ใช้งานออก" },
      { tag: "fix",         text: "เเก้ไขหน้า Report กรอก Daily Report เเล้วหน้าจอซูมเข้า-ออก" },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-03-16",
    items: [
      { tag: "feature",     text: "เพิ่ม Checkin สเเกน qr-code" },
      { tag: "fix",         text: "เเก้ไข Check-in qr-code ไม่ตรวจสอบเวลาให้" },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-03-13",
    items: [
      { tag: "feature",     text: "เพิ่มพนักงานมาทำงานระหว่างวัน On-site" },
      { tag: "feature",     text: "ลบ session code ออกจาก On-site" },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-03-10",
    items: [
      { tag: "feature",     text: "เพิ่ม Other Enduser ตอนสร้างห้อง On-site" },
      { tag: "fix", text: "ประเภทนงานเเละ Enduser ไม่สามารถลบได้" },
      { tag: "fix", text: "เเก้ไข Project Export excel ช่องเกินมา" },
    ],
  },
  {
    version: "1.4.5",
    date: "2026-03-10",
    items: [
      { tag: "feature",     text: "HR Attendance Export Excel รายบุคคลเพิ่มช่องรายละเอียด OT" },
      { tag: "feature",     text: "Project Summary ตัวกรองลบประเภทงานออก เเล้วใส่ EndUser เเทน" },
      { tag: "feature",     text: "เพิ่มรายละเอียดข้อมูลหน้า HR Attendance เเยกชม.เเละโอที วันปกติกับวันหยุด" },
    ],
  },
  {
    version: "1.4.1",
    date: "2026-03-09",
    items: [
      { tag: "feature",     text: "Project Summary เพิ่มช่อง Total (hrs.) ตอน Export Excel" },
      { tag: "feature",     text: "หน้า Request ใบลาเเละใบขอคำโอทีเเยกช่องตามเเผนก" },
      { tag: "feature",     text: "ตกเเต่ง Redesign  หน้า Login หน้า Webapp" },
      { tag: "fix", text: "เเก้ไขกดสร้างห้อง On-site ในมือถือไม่ได้" },
    ],
  },
    {
    version: "1.4.0", 
    date: "2026-03-09",
    items: [
      { tag: "feature",     text: "เพิ่มระบบแจ้งเตือน Changelog 🎉" },
      { tag: "fix",         text: "แก้ไขปุ่ม Check-in กดแล้ว delay นาน" },
      { tag: "improvement", text: "ปรับ UI หน้า Dashboard ให้โหลดเร็วขึ้น" },
    ],
  },
];

// ─── Tag Badge ─────────────────────────────────────────────────────────────────
const TAG_CONFIG: Record<ChangelogTag, { label: string; className: string }> = {
  feature:     { label: "Feature",     className: "bg-sky-100 text-sky-700" },
  fix:         { label: "Bug Fix",     className: "bg-rose-100 text-rose-700" },
  improvement: { label: "ปรับปรุง",    className: "bg-amber-100 text-amber-700" },
  breaking:    { label: "Breaking",    className: "bg-purple-100 text-purple-700" },
};

const LAST_READ_KEY = "changelog_last_read";

// ─── Props ────────────────────────────────────────────────────────────────────
interface ChangelogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangelogPanel({ isOpen, onClose }: ChangelogPanelProps) {
  if (!isOpen) return null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel (Slide-in from right) */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-sky-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-sky-500">
              {/* Bell icon */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">อัพเดทระบบ</h2>
              <p className="text-xs text-gray-400">Release Notes & Bug Fixes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {CHANGELOG.map((entry, idx) => (
            <div key={entry.version}>
              {/* Version Header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-white text-xs font-bold font-mono">
                  v{entry.version}
                </span>
                {idx === 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    ล่าสุด
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{formatDate(entry.date)}</span>
              </div>

              {/* Items */}
              <ul className="space-y-2">
                {entry.items.map((item, i) => {
                  const cfg = TAG_CONFIG[item.tag];
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold mt-0.5 ${cfg.className}`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm text-gray-600 leading-relaxed">{item.text}</span>
                    </li>
                  );
                })}
              </ul>

              {/* Divider */}
              {idx < CHANGELOG.length - 1 && (
                <div className="mt-5 border-b border-dashed border-gray-100" />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-center text-gray-400">อัพเดทโดย Dev · Time Tracker</p>
        </div>
      </div>
    </>
  );
}

// ─── Bell Button with Unread Dot ──────────────────────────────────────────────
export function ChangelogBellButton() {
  const [isOpen, setIsOpen]       = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // เช็ค version ล่าสุดกับที่ User อ่านแล้ว
  useEffect(() => {
    const lastRead = localStorage.getItem(LAST_READ_KEY);
    setHasUnread(lastRead !== CHANGELOG[0].version);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
    localStorage.setItem(LAST_READ_KEY, CHANGELOG[0].version);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="relative w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-500 hover:text-sky-500 hover:border-sky-200 transition-all"
        aria-label="อัพเดทระบบ"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread Dot */}
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>

      <ChangelogPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
