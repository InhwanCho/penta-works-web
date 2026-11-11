"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ImportedSite = {
  id: number;
  mreyesSiteId: string;
  name: string;
  region: string | null;
  address: string | null;
  notes: string | null;
};

export type ImportedEquipment = {
  id: number;
  equipmentType: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  magneticFieldTesla: string | null;
  softwareVersion: string | null;
  installedAt: string | null;
  status: string;
};

export type ImportedComponent = {
  id: number;
  equipmentId: number;
  name: string;
  componentType: string | null;
  partNumber: string | null;
  serialNumber: string | null;
  installedAt: string | null;
  replacedAt: string | null;
  status: string;
  notes: string | null;
};

export type ImportedMaintenance = {
  id: number;
  equipmentName: string;
  modelName: string | null;
  serviceType: string | null;
  serviceTitle: string | null;
  engineerName: string | null;
  symptom: string | null;
  description: string | null;
  contractType: string | null;
  workDate: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  specialNotes: string | null;
  partsDetails: string | null;
  remarks: string | null;
  followUp: string | null;
  status: string;
  completedAt: string | null;
  updatedAt: string | null;
  photos: ImportedPhoto[];
};

export type ImportedPhoto = {
  id: number;
  originalName: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
};

export type ImportedHospitalAssetsResponse = {
  site: ImportedSite;
  equipment: ImportedEquipment[];
  components: ImportedComponent[];
  maintenanceHistory: ImportedMaintenance[];
  generatedAt: string;
};

export function useImportedHospitalAssetsQuery(siteId: string, enabled = true) {
  return useQuery({
    queryKey: ["importedHospitalAssets", siteId] as const,
    queryFn: () =>
      apiFetch<ImportedHospitalAssetsResponse>(
        `/sites/${encodeURIComponent(siteId)}/imported-hospital-assets`,
        { cache: "no-store" },
      ),
    staleTime: 60_000,
    retry: 1,
    enabled: enabled && Boolean(siteId),
  });
}
