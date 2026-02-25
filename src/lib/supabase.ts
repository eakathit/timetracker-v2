// src/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// เพิ่มบรรทัดนี้เพื่อเช็คใน Console ของ Browser
console.log("Supabase Client Init:", { url: supabaseUrl, key: !!supabaseAnonKey });

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)