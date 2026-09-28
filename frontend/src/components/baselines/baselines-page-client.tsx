"use client";

import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type AlertEventSummary, type SiteAlertSettings } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BaselinesClient from "./baselines-client";

export default function BaselinesPageClient() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["alert-thresholds"],
    queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"),
  });
  const events = useQuery({
    queryKey: ["alert-events"],
    queryFn: () => apiFetch<AlertEventSummary[]>("/alerts/events?limit=200"),
    refetchInterval: 60_000,
  });
  const update = useMutation({
    mutationFn: (entry: SiteAlertSettings) =>
      apiFetch<SiteAlertSettings>(`/alerts/thresholds/${encodeURIComponent(entry.siteid)}`, {
        method: "PATCH",
        body: JSON.stringify({ thresholds: entry.thresholds.map(({ key, min, max, active }) => ({ key, min, max, active })) }),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData<SiteAlertSettings[]>(["alert-thresholds"], (current = []) =>
        current.map((entry) => entry.siteid === saved.siteid ? saved : entry),
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const acknowledge = useMutation({
    mutationFn: (eventId: number) => apiFetch<AlertEventSummary>(`/alerts/events/${eventId}/acknowledge`, { method: "PATCH" }),
    onSuccess: (saved) => queryClient.setQueryData<AlertEventSummary[]>(["alert-events"], (current = []) =>
      current.map((event) => event.id === saved.id ? saved : event),
    ),
  });

  return (
    <BaselinesClient
      entries={query.data ?? []}
      loadFailed={query.isError}
      canEdit={isAdmin}
      onSave={(entry) => update.mutateAsync(entry)}
      events={events.data ?? []}
      eventsLoading={events.isLoading}
      eventsFailed={events.isError}
      onAcknowledge={(eventId) => acknowledge.mutateAsync(eventId)}
    />
  );
}
