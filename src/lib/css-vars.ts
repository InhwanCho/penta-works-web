export type ChartPalette = {
  brandPrimary: string;
  brandPrimaryHover: string;
  customBlue: string;
  textMajor: string;
  borderTable: string;
  backgroundPrimary: string;
};

export function readChartPalette(): ChartPalette {
  if (typeof window === "undefined") {
    // SSR 안전 기본값(클라이언트에서 다시 덮어씀)
    return {
      brandPrimary: "#3F4E73",
      brandPrimaryHover: "#4F5E83",
      customBlue: "#3D76EE",
      textMajor: "#3D4659",
      borderTable: "#E5E7EB",
      backgroundPrimary: "#F8F8FA",
    };
  }

  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    (s.getPropertyValue(name).trim() || fallback);

  return {
    brandPrimary: v("--color-brand-primary", "#3F4E73"),
    brandPrimaryHover: v("--color-brand-primary-hover", "#4F5E83"),
    customBlue: v("--color-custom-blue", "#3D76EE"),
    textMajor: v("--color-text-major", "#3D4659"),
    borderTable: v("--color-border-table", "#E5E7EB"),
    backgroundPrimary: v("--color-background-primary", "#F8F8FA"),
  };
}
