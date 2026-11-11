"use client";

import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type AlertEventSummary, type SiteAlertSettings } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BaselinesClient from "./baselines-client";

export default function BaselinesPageClient() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["alert-thresholds"],
    queryFn: () => apiFetch<SiteAlertSettings[]>("/alerts/thresholds"),
    staleTime: 60_000,
    refetchInterval: 60_000,
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
      queryClient.invalidateQueries({ queryKey: ["alert-snoozes"] });
    },
  });
  const acknowledge = useMutation({
    mutationFn: (eventId: number) => apiFetch<AlertEventSummary>(`/alerts/events/${eventId}/acknowledge`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-events"] });
      queryClient.invalidateQueries({ queryKey: ["alert-snoozes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const acknowledgeMany = useMutation({
    mutationFn: (eventIds: number[]) => apiFetch<{ ok: boolean; count: number }>("/alerts/events/acknowledge", {
      method: "PATCH",
      body: JSON.stringify({ eventIds }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-events"] });
      queryClient.invalidateQueries({ queryKey: ["alert-snoozes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const retryDelivery = useMutation({
    mutationFn: (eventId: number) => apiFetch<{ ok: boolean; eventId: number }>(`/alerts/events/${eventId}/retry`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-events"] }),
  });

  return (
    <BaselinesClient
      entries={query.data ?? []}
      loadFailed={query.isError}
      canEdit={true}
      canEditCompany={role === "PLATFORM_ADMIN" || role === "SUPER_ADMIN"}
      onToggleVisibility={(siteId, visible) => updateVisibility.mutateAsync({ siteId, visible }).then(() => undefined)}
      onToggleAlerts={(siteId, enabled) => updatePolicy.mutateAsync({ siteId, enabled }).then(() => undefined)}
      onAcknowledge={(eventId) => acknowledge.mutateAsync(eventId)}
      onAcknowledgeMany={(eventIds) => acknowledgeMany.mutateAsync(eventIds)}
      onRetryDelivery={(eventId) => retryDelivery.mutateAsync(eventId)}

    />
  );
}
