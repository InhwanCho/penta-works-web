export type DashboardPreferences = {
  favorites: string[];
  columns: string[] | null;
};
export const defaultPreferences: DashboardPreferences = {
  favorites: [],
  columns: null,
};
export function readDashboardPreferences(userId: number): DashboardPreferences {
  try {
    const value = JSON.parse(
      localStorage.getItem(`mreyes-dashboard:${userId}`) ?? "null",
    );
    const strings = (items: unknown): items is string[] =>
      Array.isArray(items) && items.every((item) => typeof item === "string");
    return value &&
      strings(value.favorites) &&
      (value.columns === null || strings(value.columns))
      ? {
          favorites: [...new Set<string>(value.favorites)],
          columns: value.columns,
        }
      : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
}
export function writeDashboardPreferences(
  userId: number,
  value: DashboardPreferences,
) {
  try {
    localStorage.setItem(`mreyes-dashboard:${userId}`, JSON.stringify(value));
  } catch {
    /* Keep preferences for this visit. */
  }
}
