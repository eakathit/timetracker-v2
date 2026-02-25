DROP TABLE IF EXISTS public.daily_time_logs CASCADE;

create table daily_time_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  log_date date not null,
  
  work_type text not null,                 -- 'factory', 'on_site', 'mixed'
  first_check_in timestamp with time zone, 
  last_check_out timestamp with time zone, 
  
  timeline_events jsonb default '[]'::jsonb, -- พระเอกของเรา เก็บทุก Action
  
  allowances jsonb,                       
  ot_hours numeric(5,2) default 0,
  regular_hours numeric(5,2) default 0,
  
  status text default 'active',
  created_at timestamp with time zone default now()
);

-- 3. ป้องกัน 1 คนกด Check-in สร้างแถวใหม่ซ้ำในวันเดียวกัน (บังคับ 1 วัน = 1 แถว)
create unique index idx_user_daily_log on daily_time_logs(user_id, log_date);

-- 4. เปิดใช้งาน RLS (Row Level Security)
alter table daily_time_logs enable row level security;

-- 5. อนุญาตให้พนักงาน (ที่ Login แล้ว) ดูและแก้ไขข้อมูลของตัวเองได้
create policy "Users can manage their own logs"
on daily_time_logs for all 
to authenticated 
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ==========================================
-- 1. ตารางเก็บข้อมูล End User (เช่น Toyota)
-- ==========================================
CREATE TABLE public.end_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. ตารางเก็บข้อมูลประเภทงาน (Detail / Work Type)
-- ==========================================
CREATE TABLE public.work_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL, -- เช่น 'Wiring', 'Panel Installation'
    value_key TEXT UNIQUE NOT NULL, -- เช่น 'wiring_hr' (เอาไว้อ้างอิงในระบบ)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. ตารางเก็บข้อมูล Project (ผูกกับ End User)
-- ==========================================
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_no TEXT NOT NULL, -- เช่น '1155', '1122'
    name TEXT, -- ชื่อโปรเจกต์เต็ม (ถ้ามี)
    end_user_id UUID NOT NULL REFERENCES public.end_users(id) ON DELETE CASCADE, -- ผูกกับตาราง end_users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 4. ตารางหลักสำหรับเก็บ Daily Report ของแต่ละวัน
-- ==========================================
CREATE TABLE public.daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- หากใช้ระบบ Login ของ Supabase ให้เปิด Comment บรรทัดล่างนี้แทนบรรทัดถัดไป
    -- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, 
    user_id TEXT NOT NULL, -- ชั่วคราว: เก็บ ID พนักงานเช่น 'ช่างวิทย์ #1055'
    report_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, report_date) -- 1 คน สร้าง Report หลักได้ 1 ใบต่อวัน (รายการงานย่อยไปอยู่ตารางล่าง)
);

-- ==========================================
-- 5. ตารางย่อยเก็บรายการงาน (Items) ในแต่ละวัน
-- ==========================================
CREATE TABLE public.daily_report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.daily_reports(id) ON DELETE CASCADE,
    end_user_id UUID REFERENCES public.end_users(id),
    project_id UUID REFERENCES public.projects(id),
    detail_id UUID REFERENCES public.work_details(id),
    
    -- จัดการเรื่องเวลา (Period)
    period_type TEXT NOT NULL DEFAULT 'fixed', -- 'fixed' (เลือกจากระบบ) หรือ 'some_time' (ระบุเอง)
    period_start TIME, -- เก็บเวลาเริ่ม เช่น '08:00:00' (ใช้กรณี some_time)
    period_end TIME, -- เก็บเวลาจบ เช่น '10:30:00' (ใช้กรณี some_time)
    period_label TEXT, -- เก็บ Text ที่แสดงผล เช่น "08:00 – 10:00 น."
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- (Optional) เปิดใช้งาน Row Level Security (RLS) 
-- เพื่อความปลอดภัยเบื้องต้น (สามารถไปตั้ง Policy ต่อได้ใน Dashboard)
-- ==========================================
ALTER TABLE public.end_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_details ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.end_users ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'bg-sky-500';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;