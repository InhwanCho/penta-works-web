import type { DashboardResponse } from "@/hooks/use-dashboard-query";

const STORAGE_KEY = "pentaworks_dashboard_snapshot_v1";
const MAX_AGE_MS = 15 * 60 * 1000;

type Snapshot = { userId: number; savedAt: number; data: DashboardResponse };

export function readDashboardSnapshot(userId: number): DashboardResponse | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const snapshot = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Snapshot | null;
    if (!snapshot || snapshot.userId !== userId || !Number.isFinite(snapshot.savedAt) ||
        snapshot.savedAt > Date.now() || Date.now() - snapshot.savedAt > MAX_AGE_MS ||
        !snapshot.data || !Array.isArray(snapshot.data.rows) ||
        !snapshot.data.stats || !snapshot.data.ctrl || !Number.isFinite(snapshot.data.meta?.nowMs) ||
        snapshot.data.meta.nowMs > Date.now() || Date.now() - snapshot.data.meta.nowMs > MAX_AGE_MS) {
      return undefined;
    }
    return snapshot.data;
  } catch {
    return undefined;
  }
}

export function writeDashboardSnapshot(userId: number, data: DashboardResponse): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, savedAt: Date.now(), data }));
  } catch {
    // Storage may be unavailable or full; live dashboard requests still work.
  }
}

export function clearDashboardSnapshot(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage unavailable. */ }
}
