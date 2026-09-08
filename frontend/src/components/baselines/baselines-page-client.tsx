"use client";

import { apiFetch, type PsiThreshold } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import BaselinesClient from "./baselines-client";

export default function BaselinesPageClient() {
  const query = useQuery({
    queryKey: ["psi-thresholds"],
    queryFn: () => apiFetch<PsiThreshold[]>("/alerts/psi-thresholds"),
  });

  return <BaselinesClient entries={query.data ?? []} loadFailed={query.isError} />;
}
