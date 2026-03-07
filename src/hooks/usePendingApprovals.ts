"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";

export const REFRESH_PENDING_EVENT = "refresh-pending-approvals";

export function usePendingApprovals() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();

    const isManager = profile?.role === "manager" || profile?.role === "admin";
    if (!isManager) { setCount(0); return; }

    const [otRes, leaveRes] = await Promise.all([
      supabase.from("ot_requests")
        .select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("leave_requests")
        .select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    setCount((otRes.count ?? 0) + (leaveRes.count ?? 0));
  }, []);

  useEffect(() => {
    fetchCount();

    // ✅ ฟัง custom event ที่ยิงมาจากหน้า requests
    window.addEventListener(REFRESH_PENDING_EVENT, fetchCount);
    return () => window.removeEventListener(REFRESH_PENDING_EVENT, fetchCount);
  }, [fetchCount]);

  return count;
}