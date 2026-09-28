"use client";

import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type PsiThreshold } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import BaselinesClient from "./baselines-client";

export default function BaselinesPageClient() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["psi-thresholds"],
    queryFn: () => apiFetch<PsiThreshold[]>("/alerts/psi-thresholds"),
  });
  const update = useMutation({
    mutationFn: (entry: PsiThreshold) =>
      apiFetch<PsiThreshold>(`/alerts/psi-thresholds/${encodeURIComponent(entry.siteid)}`, {
        method: "PATCH",
        body: JSON.stringify({ min: entry.min, max: entry.max, active: entry.active }),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData<PsiThreshold[]>(["psi-thresholds"], (current = []) =>
        current.map((entry) => entry.siteid === saved.siteid ? saved : entry),
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <BaselinesClient
      entries={query.data ?? []}
      loadFailed={query.isError}
      canEdit={isAdmin}
      onSave={(entry) => update.mutateAsync(entry)}
    />
  );
}
