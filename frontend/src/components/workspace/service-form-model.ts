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
  inputs: string[][];
};
export const acrSections = definitions.acr as AcrSection[];
export const pulseRows = definitions.pulseRows,
  pulseCols = definitions.pulseCols;
export function initialDetails(): WorkDetails {
  return {
    assetIds: [],
    model: "",
    engineer: "",
    personalKind: "office",
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
    ] as const;
    for (const key of textKeys)
      if (raw[key] != null) fallback[key] = asText(raw[key]);
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
// Arithmetic mirrors the supplied Pentaservice form. Verdicts remain explicit user selections.
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
