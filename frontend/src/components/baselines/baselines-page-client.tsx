"use client";

import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type AlertEventSummary, type AlertRecipient, type AlertThreshold, type SiteAlertSettings } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BaselinesClient from "./baselines-client";

export default function BaselinesPageClient() {
  const { isAdmin, role } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["alert-thresholds"],
    queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"),
  });
  const companyThresholds = useQuery({
    queryKey: ["company-alert-thresholds"],
    queryFn: () => apiFetch<AlertThreshold[]>("/alerts/company-thresholds"),
    enabled: isAdmin,
  });
  const events = useQuery({
    queryKey: ["alert-events"],
    queryFn: () => apiFetch<AlertEventSummary[]>("/alerts/events?limit=500"),
    refetchInterval: 60_000,
  });
  const recipients = useQuery({
    queryKey: ["alert-recipients"],
    queryFn: () => apiFetch<AlertRecipient[]>("/alerts/recipients"),
  });
  const update = useMutation({
    mutationFn: (entry: SiteAlertSettings) =>
      apiFetch<SiteAlertSettings>(`/alerts/thresholds/${encodeURIComponent(entry.siteid)}`, {
        method: "PATCH",
        body: JSON.stringify({
          thresholds: entry.thresholds.map(({ key, min, max, active, useAverage, tolerancePercent }) =>
            ({ key, min, max, active, useAverage, tolerancePercent })),
          noDataMinutes: entry.noDataMinutes,
          noDataActive: entry.noDataActive,
          alertsEnabled: entry.alertsEnabled,
          triggerAfterMinutes: entry.triggerAfterMinutes,
          repeatMinutes: entry.repeatMinutes,
          quietStart: entry.quietStart,
          quietEnd: entry.quietEnd,
          suppressWeekends: entry.suppressWeekends,
          holidayDates: entry.holidayDates,
          coldChillerActive: entry.coldChillerActive,
          collectionIntervalMinutes: entry.collectionIntervalMinutes,
          missingCollectionThreshold: entry.missingCollectionThreshold,
        }),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData<SiteAlertSettings[]>(["alert-thresholds"], (current = []) =>
        current.map((entry) => entry.siteid === saved.siteid ? saved : entry),
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const updateVisibility = useMutation({
    mutationFn: ({ siteId, visible }: { siteId: string; visible: boolean }) =>
      apiFetch(`/admin/accounts/sites/${encodeURIComponent(siteId)}/visibility`, {
        method: "PATCH", body: JSON.stringify({ visible }),
      }),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["alert-thresholds"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["sites"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-sites"] }),
      queryClient.invalidateQueries({ queryKey: ["alert-events"] }),
    ]),
  });
  const updatePolicy = useMutation({
    mutationFn: ({ siteId, enabled }: { siteId: string; enabled: boolean }) =>
      apiFetch<SiteAlertSettings>(`/alerts/policy/${encodeURIComponent(siteId)}`, {
        method: "PATCH", body: JSON.stringify({ enabled }),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData<SiteAlertSettings[]>(["alert-thresholds"], (current = []) =>
        current.map((entry) => entry.siteid === saved.siteid ? saved : entry));
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["alert-events"] });
    },
  });
  const updateCompanyThresholds = useMutation({
    mutationFn: (thresholds: AlertThreshold[]) => apiFetch<AlertThreshold[]>("/alerts/company-thresholds", {
      method: "PATCH",
      body: JSON.stringify(thresholds.map(({ key, min, max, active }) => ({ key, min, max, active }))),
    }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["company-alert-thresholds"], saved);
      queryClient.invalidateQueries({ queryKey: ["alert-thresholds"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const restoreCompanyThresholds = useMutation({
    mutationFn: (siteId: string) => apiFetch<SiteAlertSettings>(
      `/alerts/thresholds/${encodeURIComponent(siteId)}/restore-company`, { method: "POST" }),
    onSuccess: (saved) => {
      queryClient.setQueryData<SiteAlertSettings[]>(["alert-thresholds"], (current = []) =>
        current.map((entry) => entry.siteid === saved.siteid ? saved : entry));
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const acknowledge = useMutation({
    mutationFn: (eventId: number) => apiFetch<AlertEventSummary>(`/alerts/events/${eventId}/acknowledge`, { method: "PATCH" }),
    onSuccess: (saved) => {
      queryClient.setQueryData<AlertEventSummary[]>(["alert-events"], (current = []) =>
        current.map((event) => event.id === saved.id ? saved : event));
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
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
    mutationFn: (request: { siteId: string; channel: AlertRecipient["channel"]; destination: string; userId?: number; quietStart: string | null; quietEnd: string | null; enabled: boolean }) =>
      apiFetch<AlertRecipient>("/alerts/recipients", { method: "POST", body: JSON.stringify(request) }),
    onSuccess: (saved) => queryClient.setQueryData<AlertRecipient[]>(["alert-recipients"], (current = []) => [...current, saved]),
  });
  const updateRecipient = useMutation({
    mutationFn: ({ id, userId, destination, quietStart, quietEnd, enabled }: AlertRecipient) =>
      apiFetch<AlertRecipient>(`/alerts/recipients/${id}`, { method: "PATCH", body: JSON.stringify({ userId, destination, quietStart, quietEnd, enabled }) }),
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
      canEditCompany={role === "PLATFORM_ADMIN" || role === "SUPER_ADMIN"}
      companyThresholds={companyThresholds.data ?? []}
      onSaveCompany={(thresholds) => updateCompanyThresholds.mutateAsync(thresholds)}
      onRestoreCompany={(siteId) => restoreCompanyThresholds.mutateAsync(siteId)}
      onSave={(entry) => update.mutateAsync(entry)}
      onToggleVisibility={(siteId, visible) => updateVisibility.mutateAsync({ siteId, visible }).then(() => undefined)}
      onToggleAlerts={(siteId, enabled) => updatePolicy.mutateAsync({ siteId, enabled }).then(() => undefined)}
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
