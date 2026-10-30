import definitions from "./legacy-form-definitions.json";
export type PmField = {
  label: string;
  value: string;
  type?: string;
  suffix?: string;
};
export type PmItem = {
  section: string;
  name: string;
  purpose: string;
  result: string;
  comment: string;
  fields: PmField[];
  noCheck: boolean;
  options: { v: string; l: string }[];
};
export type WorkDetails = {
  scheduleId: number | null;
  assetIds: number[];
  model: string;
  engineer: string;
  personalKind: string;
  contractType: string;
  acrKind: string;
  coldheadPosition: string;
  coldheadSerial: string;
  coldheadInDate: string;
  symptom: string;
  parts: string;
  startTime: string;
  endTime: string;
  heLevel: string;
  countsAsPm: boolean;
  followUp: string;
  prepItems: string;
  pm: PmItem[];
  acr: Record<string, Record<string, string>>;
  acrPulse: Record<string, string[]>;
  acrVerdicts: Record<string, string>;
  acrOverall: string;
  magneticFieldTesla: string;
};
type PmConfig = [
  string,
  [
    string,
    string,
    {
      fields?: (
        | string
        | { label: string; type?: string; suffix?: string; default?: string }
      )[];
      noCheck?: boolean;
      checkOptions?: { v: string; l: string }[];
    }?,
  ][],
];
export type AcrSection = {
  k: string;
  t: string;
  method: string[];
  crit: string;
  figs?: string[];
  grid?: number;
  inputs: string[][];
};
export const acrSections = definitions.acr as AcrSection[];
export const pulseRows = definitions.pulseRows,
  pulseCols = definitions.pulseCols;
export function initialDetails(): WorkDetails {
  return {
    scheduleId: null,
    assetIds: [],
    model: "",
    engineer: "",
    personalKind: "etc",
    contractType: "C",
    acrKind: "doc",
    coldheadPosition: "A2",
    coldheadSerial: "",
    coldheadInDate: "",
    symptom: "",
    parts: "",
    startTime: "",
    endTime: "",
    heLevel: "",
    countsAsPm: false,
    followUp: "",
    prepItems: "",
    pm: (definitions.pm as unknown as PmConfig[]).flatMap(([section, items]) =>
      items.map(([name, purpose, opts]) => ({
        section,
        name,
        purpose,
        result: "",
        comment: "",
        noCheck: !!opts?.noCheck,
        options: opts?.checkOptions || [
          { v: "pass", l: "적합" },
          { v: "fail", l: "부적합" },
          { v: "na", l: "N/A" },
        ],
        fields: (opts?.fields || []).map((f) =>
          typeof f === "string"
            ? { label: f, value: "" }
            : {
                label: f.label,
                type: f.type,
                suffix: f.suffix,
                value: f.default || "",
              },
        ),
      })),
    ),
    acr: Object.fromEntries(
      acrSections.map((s) => [
        s.k,
        Object.fromEntries(s.inputs.map(([k]) => [k, ""])),
      ]),
    ),
    acrVerdicts: {},
    acrOverall: "",
    acrPulse: structuredClone(definitions.pulseDefaults),
    magneticFieldTesla: "1.5",
  };
}
function asText(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
}
export function parseDetails(value?: string | null): WorkDetails {
  const fallback = initialDetails();
  if (!value) return fallback;
  try {
    const raw = JSON.parse(value);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
    const textKeys = [
      "model",
      "engineer",
      "personalKind",
      "contractType",
      "acrKind",
      "coldheadPosition",
      "coldheadSerial",
      "coldheadInDate",
      "symptom",
      "parts",
      "startTime",
      "endTime",
      "heLevel",
      "followUp",
      "prepItems",
      "magneticFieldTesla",
      "acrOverall",
    ] as const;
    for (const key of textKeys)
      if (raw[key] != null) fallback[key] = asText(raw[key]);
    if (!["1.5", "3"].includes(raw.magneticFieldTesla)) fallback.magneticFieldTesla = magneticFieldFromModel(fallback.model) || "1.5";
    fallback.scheduleId =
      Number.isSafeInteger(raw.scheduleId) && raw.scheduleId > 0
        ? raw.scheduleId
        : null;
    fallback.assetIds = Array.isArray(raw.assetIds)
      ? [
          ...new Set<number>(
            raw.assetIds.filter(
              (id: unknown): id is number =>
                typeof id === "number" && Number.isSafeInteger(id) && id > 0,
            ),
          ),
        ]
      : [];
    fallback.countsAsPm = raw.countsAsPm === true;
    if (Array.isArray(raw.pm))
      fallback.pm = fallback.pm.map((item) => {
        const saved = raw.pm.find(
          (p: unknown) =>
            !!p && typeof p === "object" && "name" in p && p.name === item.name,
        );
        if (!saved) return item;
        return {
          ...item,
          result: item.options.some((o) => o.v === saved.result)
            ? saved.result
            : "",
          comment: asText(saved.comment),
          fields: item.fields.map((f) => {
            const field = Array.isArray(saved.fields)
              ? saved.fields.find(
                  (p: unknown) =>
                    !!p &&
                    typeof p === "object" &&
                    "label" in p &&
                    p.label === f.label,
                )
              : null;
            return { ...f, value: asText(field?.value) };
          }),
        };
      });
    for (const section of acrSections) {
      const fields = raw.acr?.[section.k];
      if (fields && typeof fields === "object")
        for (const [key] of section.inputs)
          fallback.acr[section.k][key] = asText(fields[key]);
      const verdict = raw.acrVerdicts?.[section.k];
      if (["pass", "fail", "na"].includes(verdict))
        fallback.acrVerdicts[section.k] = verdict;
    }
    for (const row of pulseRows)
      if (Array.isArray(raw.acrPulse?.[row]))
        fallback.acrPulse[row] = pulseCols.map((_, i) =>
          asText(raw.acrPulse[row][i]),
        );
    return fallback;
  } catch {
    return fallback;
  }
}

function num(v: string | undefined) {
  if (!v?.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
// Arithmetic mirrors Pentaservice. Explicit verdicts override the automatic display.
export function acrCalculate(
  section: string,
  key: string,
  values: Record<string, string>,
): string {
  const n = (k: string) => num(values[k]);
  const fixed = (v: number | null, d = 1) =>
    v === null || !Number.isFinite(v) ? "" : v.toFixed(d);
  if (section === "geo") {
    const v = n("geoval");
    return key === "geoww"
      ? v === null
        ? ""
        : String(v)
      : fixed(v === null ? null : v / 2);
  }
  if (section === "spa") {
    const v = n(key === "t1peakhalf" ? "t1peak" : "t2peak");
    return fixed(v === null ? null : v / 2);
  }
  if (section === "piu" && key === "sighalf") {
    const v = n("siglarge");
    return fixed(v === null ? null : v / 2);
  }
  if (section === "sta") {
    const prefix = key.slice(0, 2);
    if (key.endsWith("wl")) {
      const a = n(prefix + "rtop"),
        b = n(prefix + "rbot");
      return fixed(a === null || b === null ? null : (a + b) / 2);
    }
    const a = n(prefix + "top"),
      b = n(prefix + "bot");
    return fixed(
      a === null || b === null || a + b === 0 ? null : (0.2 * a * b) / (a + b),
      2,
    );
  }
  if (section === "piu") {
    const prefix = key.slice(0, 2),
      lo = n(prefix + "low"),
      hi = n(prefix + "high");
    return fixed(
      lo === null || hi === null || hi + lo === 0
        ? null
        : 100 * (1 - (hi - lo) / (hi + lo)),
      2,
    );
  }
  if (section === "psg") {
    const l = n("large"),
      t = n("top"),
      b = n("bot"),
      left = n("left"),
      right = n("right");
    return fixed(
      !l || t === null || b === null || left === null || right === null
        ? null
        : Math.abs((t + b - (left + right)) / (2 * l)) * 100,
      2,
    );
  }
  return "";
}
export function computedDetails(d: WorkDetails): WorkDetails {
  return {
    ...d,
    acr: Object.fromEntries(
      acrSections.map((s) => {
        const values = { ...d.acr[s.k] };
        for (const [key, , kind] of s.inputs)
          if (kind === "calc") values[key] = acrCalculate(s.k, key, values);
        return [s.k, values];
      }),
    ),
  };
}

export type MeasurementVerdict = "" | "pass" | "fail" | "invalid";
export const acrPreparation = definitions.prep;

/** Limits and automatic verdicts from the original Pentaservice ACR form. */
export function acrFieldVerdict(section: string, key: string, values: Record<string, string>, tesla = "1.5"): MeasurementVerdict {
  const text = values[key]?.trim();
  if (!text) return "";
  const value = num(text);
  if (value === null) return "invalid";
  const epsilon = 1e-9;
  const between = (low: number, high: number) => value >= low - epsilon && value <= high + epsilon ? "pass" : "fail";
  if (section === "geo") {
    if (key === "sag") return between(146, 150);
    if (key === "axc" || key === "axd") return between(188, 192);
  }
  if (section === "sta" && ["t1thk", "t2thk"].includes(key)) return between(4.3, 5.7);
  if (section === "spa" && ["t1s1", "t1s11", "t2s1", "t2s11"].includes(key)) return between(-5, 5);
  if (section === "piu" && ["t1piu", "t2piu"].includes(key)) return between(tesla === "3" ? 82 : 87.5, 100);
  if (section === "psg" && key === "ratio") return between(0, 2.5);
  return "";
}
export function acrAutoVerdict(section: string, values: Record<string, string>, tesla = "1.5"): "" | "pass" | "fail" {
  const definition = acrSections.find(item => item.k === section);
  if (!definition) return "";
  const measurements = definition.inputs.filter(([, , kind]) => kind !== "check");
  const verdicts = measurements.map(([key]) => acrFieldVerdict(section, key, values, tesla));
  if (verdicts.some(value => value === "fail" || value === "invalid")) return "fail";
  if (verdicts.includes("pass")) return "pass";
  if (["sag0", "hcsr", "lcod"].includes(section)) {
    const checks = definition.inputs.filter(([, , kind]) => kind === "check");
    return checks.length && checks.every(([key]) => values[key] === "Y") ? "pass" : "";
  }
  return "";
}
export function acrEffectiveVerdicts(details: WorkDetails) {
  const computed = computedDetails(details);
  return Object.fromEntries(acrSections.map(section => [section.k, details.acrVerdicts[section.k] || acrAutoVerdict(section.k, computed.acr[section.k], details.magneticFieldTesla)]));
}
export function acrOverallVerdict(details: WorkDetails) {
  if (["pass", "fail", "na"].includes(details.acrOverall)) return details.acrOverall;
  const verdicts = Object.values(acrEffectiveVerdicts(details)).filter(value => value === "pass" || value === "fail");
  return !verdicts.length ? "" : verdicts.includes("fail") ? "fail" : "pass";
}

export function magneticFieldFromModel(model: string): "1.5" | "3" | undefined {
  if (/(?:^|[^0-9.])3(?:\.0)?\s*t\b/i.test(model)) return "3";
  if (/(?:^|[^0-9.])1\.5\s*t\b/i.test(model)) return "1.5";
  return undefined;
}
