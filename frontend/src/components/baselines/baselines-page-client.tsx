"use client";

import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type AlertEventSummary, type AlertRecipient, type SiteAlertSettings } from "@/lib/api";
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
    queryFn: () => apiFetch<AlertEventSummary[]>("/alerts/events?limit=500"),
    refetchInterval: 60_000,
  });
  const recipients = useQuery({
    queryKey: ["alert-recipients"],
    queryFn: () => apiFetch<AlertRecipient[]>("/alerts/recipients"),
    enabled: isAdmin,
  });
  const update = useMutation({
    mutationFn: (entry: SiteAlertSettings) =>
      apiFetch<SiteAlertSettings>(`/alerts/thresholds/${encodeURIComponent(entry.siteid)}`, {
        method: "PATCH",
        body: JSON.stringify({
          thresholds: entry.thresholds.map(({ key, min, max, active }) => ({ key, min, max, active })),
          noDataMinutes: entry.noDataMinutes,
          noDataActive: entry.noDataActive,
          alertsEnabled: entry.alertsEnabled,
          triggerAfterMinutes: entry.triggerAfterMinutes,
          repeatMinutes: entry.repeatMinutes,
          quietStart: entry.quietStart,
          quietEnd: entry.quietEnd,
          suppressWeekends: entry.suppressWeekends,
          holidayDates: entry.holidayDates,
        }),
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
  const acknowledgeMany = useMutation({
    mutationFn: (eventIds: number[]) => apiFetch<{ ok: boolean; count: number }>("/alerts/events/acknowledge", {
      method: "PATCH",
      body: JSON.stringify({ eventIds }),
    }),
    onSuccess: (_, eventIds) => {
      const acknowledgedAt = new Date().toISOString();
      queryClient.setQueryData<AlertEventSummary[]>(["alert-events"], (current = []) =>
        current.map((event) => eventIds.includes(event.id) ? { ...event, acknowledgedAt: event.acknowledgedAt ?? acknowledgedAt } : event),
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const retryDelivery = useMutation({
    mutationFn: (eventId: number) => apiFetch<{ ok: boolean; eventId: number }>(`/alerts/events/${eventId}/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-events"] }),
  });
  const createRecipient = useMutation({
    mutationFn: (request: { siteId: string; destination: string; quietStart: string | null; quietEnd: string | null; enabled: boolean }) =>
      apiFetch<AlertRecipient>("/alerts/recipients", { method: "POST", body: JSON.stringify(request) }),
    onSuccess: (saved) => queryClient.setQueryData<AlertRecipient[]>(["alert-recipients"], (current = []) => [...current, saved]),
  });
  const updateRecipient = useMutation({
    mutationFn: ({ id, quietStart, quietEnd, enabled }: AlertRecipient) =>
      apiFetch<AlertRecipient>(`/alerts/recipients/${id}`, { method: "PATCH", body: JSON.stringify({ quietStart, quietEnd, enabled }) }),
    onSuccess: (saved) => queryClient.setQueryData<AlertRecipient[]>(["alert-recipients"], (current = []) =>
      current.map((recipient) => recipient.id === saved.id ? saved : recipient),
    ),
  });
  const deleteRecipient = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/alerts/recipients/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => queryClient.setQueryData<AlertRecipient[]>(["alert-recipients"], (current = []) =>
      current.filter((recipient) => recipient.id !== id),
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
      onAcknowledgeMany={(eventIds) => acknowledgeMany.mutateAsync(eventIds)}
      onRetryDelivery={(eventId) => retryDelivery.mutateAsync(eventId)}
      recipients={recipients.data ?? []}
      recipientsLoading={recipients.isLoading}
      recipientsFailed={recipients.isError}
      onCreateRecipient={(request) => createRecipient.mutateAsync(request)}
      onUpdateRecipient={(recipient) => updateRecipient.mutateAsync(recipient)}
      onDeleteRecipient={(id) => deleteRecipient.mutateAsync(id)}
    />
  );
}
