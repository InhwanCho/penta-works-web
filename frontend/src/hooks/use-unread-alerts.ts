"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch } from "@/lib/api";

/** Wait for dashboard data and two paint opportunities before starting the small badge query. */
export function useUnreadAlerts() {
  const { session } = useAuth();
  const pathname = usePathname();
  const client = useQueryClient();
  const [readyUser, setReadyUser] = useState<number | null>(null);
  useEffect(() => {
    if (!session) return;
    let scheduled = false;
    let first = 0, second = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      if (scheduled || (pathname === "/" && !client.getQueryData(["dashboard", session.id]))) return;
      scheduled = true;
      first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
        timer = setTimeout(() => setReadyUser(session.id), 200);
      }); });
    };
    const unsubscribe = client.getQueryCache().subscribe(schedule);
    schedule();
    return () => { unsubscribe(); cancelAnimationFrame(first); cancelAnimationFrame(second); clearTimeout(timer); };
  }, [session, pathname, client]);
  const query = useQuery({
    queryKey: ["alert-events", "unread-badge", session?.id],
    queryFn: () => apiFetch<{total: number}>("/alerts/events/search?status=unacknowledged&page=1&size=1"),
    enabled: !!session && readyUser === session.id,
    staleTime: 30_000, refetchInterval: 60_000,
  });
  return !!session && readyUser === session.id && (query.data?.total ?? 0) > 0;
}
