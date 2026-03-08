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

    // ✅ fetch profile + counts พร้อมกันเลย ประหยัดได้ 1 round-trip
    const [profileRes, otRes, leaveRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single(),
      supabase
        .from("ot_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const isManager =
      profileRes.data?.role === "manager" ||
      profileRes.data?.role === "admin";

    setCount(isManager ? (otRes.count ?? 0) + (leaveRes.count ?? 0) : 0);
  }, []);

  useEffect(() => {
    fetchCount();

    window.addEventListener(REFRESH_PENDING_EVENT, fetchCount);
    return () => window.removeEventListener(REFRESH_PENDING_EVENT, fetchCount);
  }, [fetchCount]);

  return count;
}