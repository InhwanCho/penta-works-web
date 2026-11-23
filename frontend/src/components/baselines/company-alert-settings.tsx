"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "@/components/common/app-link";
import { apiFetch } from "@/lib/api";
import CircleLoader from "@/components/icons/circle-loader";

type Hospital = { enabled: boolean; intervalMinutes: number };
type Policy = {
  tolerancePercent: number; pressureWarning: number; pressureCritical: number; gradientCritical: number;
  missingWarning: number; missingCritical: number; collectionWarning: number; collectionCritical: number;
  coldChillerEnabled: boolean; hospitals: Record<string, Hospital>;
};
type PolicyView = {
  revision: number; canEdit: boolean; policy: Policy;
  hospitals: {siteId: string; name: string; settings: Hospital; coldHeadReplacedAt: string | null; quietUntil: string | null}[];
};
const field = "mt-2 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold dark:border-slate-600 dark:bg-slate-900 disabled:opacity-70";
const card = "rounded-xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-700 dark:bg-background-dark-card";

const muted = "text-sm leading-6 text-slate-600 dark:text-slate-300";

function SettingsSection({ title, summary, children, open }: {
  title: string;
  summary?: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} onInvalidCapture={event => { event.currentTarget.open = true; }} className="alert-settings-section">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-600 sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-semibold">{title}</span>
          {summary && <span className="block text-xs text-text-secondary">{summary}</span>}
        </span>
        <span aria-hidden="true" className="alert-settings-chevron mr-1 size-2 shrink-0 rotate-45 border-r-2 border-b-2 border-current text-text-secondary" />
      </summary>
      <div className="space-y-3 px-3 pb-4 sm:px-4">{children}</div>
    </details>
  );
}

function AlertCriterion({ title, summary, description, warning, kakao, note, children }: {
  title: string;
  summary: string;
  description?: string;
  warning?: ReactNode;
  kakao?: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SettingsSection title={title} summary={summary}>
      {description && <p className={muted}>{description}</p>}
      <dl className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 dark:bg-slate-800/70">
        {warning && <div>
          <dt className="text-xs font-semibold text-amber-800 dark:text-amber-300">화면 주의</dt>
          <dd className="mt-1">{warning}</dd>
        </div>}
        <div>
          <dt className="text-xs font-semibold text-rose-800 dark:text-rose-300">카톡 기준</dt>
          <dd className="mt-1">{kakao || "발송 없음"}</dd>
        </div>
      </dl>
      {children && <div className="grid items-start gap-3 sm:grid-cols-2">{children}</div>}
      {note && <div className="text-xs leading-5 text-text-secondary">{note}</div>}
    </SettingsSection>
  );
}

function duration(minutes: number) {
  if (!Number.isFinite(minutes)) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}시간${rest ? ` ${rest}분` : ""}` : `${rest}분`;
}

export default function CompanyAlertSettings({ siteId, metricKey, siteIds }: { siteId?: string; metricKey?: string; siteIds?: string[] }) {
  const client = useQueryClient();
  const query = useQuery({queryKey:["company-alert-policy"],queryFn:()=>apiFetch<PolicyView>("/alerts/company-policy")});
  const [draft, setDraft] = useState<PolicyView | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { if (query.data && !editing) setDraft(query.data); }, [query.data, editing]);
  if (query.isPending || !draft && !query.isError) return <div className="p-6"><CircleLoader size="xs" /></div>;
  if (query.isError || !draft) return <div role="alert" className={card}>설정을 불러오지 못했습니다.<button type="button" className="ml-3 min-h-10 underline" onClick={()=>query.refetch()}>다시 시도</button></div>;
  const p = draft.policy;
  const canEdit = draft.canEdit;
  const locked = !canEdit || !editing || saving;
  function change(patch: Partial<Policy>) { setDraft(current=>current ? {...current,policy:{...current.policy,...patch}} : current); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const saved = await apiFetch<PolicyView>("/alerts/company-policy",{method:"PATCH",body:JSON.stringify({revision:draft.revision,policy:draft.policy})});
      client.setQueryData(["company-alert-policy"],saved);
      setDraft(saved);setEditing(false);setNotice("저장했습니다. 회사 전체 사용자에게 적용되었습니다.");
      await Promise.all(["alert-thresholds","dashboard","siteDetail","alert-events"].map(key=>client.invalidateQueries({queryKey:[key]})));
    } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  const number = (label: string, key: keyof Omit<Policy,"hospitals"|"coldChillerEnabled">, unit: string, min: number, max: number, step = 1) =>
    <label className="block min-w-0 text-sm font-semibold">{label} ({unit})<input type="number" required min={min} max={max} step={step} disabled={locked} className={field} value={p[key]} onChange={e=>change({[key]:e.target.valueAsNumber})}/></label>;
  const hospitals = draft.hospitals.filter(h=>(!siteId || h.siteId===siteId) && (!siteIds || siteIds.includes(h.siteId)) && (!search || h.name.includes(search)));
  return <form onSubmit={save} className="space-y-3 text-sm leading-relaxed">
    {process.env.NEXT_PUBLIC_DEPLOY_ENV === "development" && <p className="rounded-lg bg-slate-100 p-4 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">개발용 화면 · 실제 카톡은 발송되지 않습니다.</p>}
    <section className={card}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold">{metricKey ? "선택 항목 알림 기준" : "우리 회사 알림 기준"}</h2>
          <p className="mt-0.5 text-xs text-text-secondary">회사 공통 · 관리자만 변경</p>
        </div>
        {canEdit && !editing && <button type="button" onClick={()=>{setEditing(true);setNotice("");}} className="min-h-11 shrink-0 rounded-lg bg-sky-700 px-3 font-bold text-white">설정 변경</button>}
      </div>
      <Link href="/notification-settings?from=baselines" className="mt-1 inline-flex min-h-11 items-center font-semibold text-sky-800 dark:text-sky-300">내 카톡 수신 시간 설정 →</Link>
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-2 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{notice}</p>}
    </section>
    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-background-dark-card">
    {(!metricKey || metricKey === "hepres") && <AlertCriterion
      title="헬륨 압력"
      summary={`카톡 · ${p.pressureCritical} psi 초과 2회`}
      description="7일 평균 · 고정 압력 기준"
      warning={<ul className="list-disc space-y-1 pl-5">
        <li><strong>{p.pressureWarning}~{p.pressureCritical} psi</strong> 범위</li>
        <li>7일 평균보다 <strong>{p.tolerancePercent}% 넘게</strong> 높거나 낮음</li>
        <li>7일 평균을 웃도는 <strong>10건</strong>이 연속으로 매번 상승</li>
        <li>{p.pressureCritical} psi를 처음 초과</li>
      </ul>}
      kakao={<><strong>{p.pressureCritical} psi 초과</strong>가 <strong>2회 연속</strong></>}
      note={<details className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
        <summary className="cursor-pointer py-1 font-bold">콜드헤드 교체 후 5일간 헬륨 압력 카톡 중지</summary>
        <p className="mt-1">교체 작업일부터 압력 평균을 다시 계산합니다. 5일 동안은 압력 이상과 누락을 화면에 표시합니다. 이후에도 문제가 이어지면 카톡을 한 번 보냅니다.</p>
        <p className="mt-1">평균은 유효한 측정값이 12개부터 표시됩니다.</p>
      </details>}
    >
      {editing && number("노란색 시작 압력","pressureWarning","psi",0.01,100,0.01)}
      {editing && number("카톡을 보내는 초과 기준","pressureCritical","psi",0.01,100,0.01)}
    </AlertCriterion>}
    {(!metricKey || metricKey === "hepres") && <AlertCriterion
      title="헬륨 압력 측정 누락"
      summary={`카톡 · ${p.missingCritical}회 연속 누락부터`}
      description="압력값만 누락된 경우"
      warning={<><strong>{p.missingWarning}~{p.missingCritical - 1}회</strong> 연속 누락</>}
      kakao={<><strong>{p.missingCritical}회</strong> 연속 누락부터</>}
      note="유효한 압력값이 들어오면 화면의 누락 횟수는 0으로 돌아갑니다."
    >
      {editing && number("노란색으로 표시할 연속 누락","missingWarning","회",1,287)}
      {editing && number("카톡을 보낼 연속 누락","missingCritical","회",2,288)}
    </AlertCriterion>}
    {(!metricKey || ["heleve", "gctemp", "cc-in", "cc-out", "actemp", "achumi"].includes(metricKey)) && <AlertCriterion
      title={metricKey ? ({heleve:"헬륨 잔량",gctemp:"그래디언트칠러", "cc-in":"실드쿨러 IN","cc-out":"실드쿨러 OUT",actemp:"항온항습 온도",achumi:"항온항습 습도"}[metricKey] ?? "평균 비교") : "온도·습도·헬륨 잔량"}
      description="24시간 평균 기준"
      summary={`화면 주의 · 평균에서 ±${p.tolerancePercent}% 초과`}
      warning={<>24시간 평균보다 <strong>{p.tolerancePercent}% 넘게</strong> 높거나 낮음</>}
      note="헬륨 압력의 7일 평균에도 같은 비율을 적용합니다. 미측정 값은 평균에서 제외합니다."
    >
      {editing && number("평균에서 벗어나는 비율","tolerancePercent","%",0.1,100,0.1)}
    </AlertCriterion>}
    {(!metricKey || metricKey === "gctemp") && <AlertCriterion
      title="그래디언트칠러 고온"
      summary={`카톡 · ${p.gradientCritical}°C 초과 2회`}
      warning={<><strong>{p.gradientCritical}°C</strong>를 처음 초과</>}
      kakao={<><strong>{p.gradientCritical}°C 초과</strong>가 <strong>2회 연속</strong></>}
    >
      {editing && number("카톡을 보내는 초과 온도","gradientCritical","°C",0.1,100,0.1)}
    </AlertCriterion>}
    {(!metricKey || ["cc-in", "cc-out"].includes(metricKey)) && <AlertCriterion
      title="콜드칠러 정지 의심"
      summary={p.coldChillerEnabled ? "카톡 · 온도 차이 0.1°C 이하" : "알림 꺼짐"}
      description={p.coldChillerEnabled ? "알림 켜짐 · 공냉식 병원은 제외됩니다." : "알림 꺼짐"}
      kakao={p.coldChillerEnabled && <>IN·OUT 온도 차이가 <strong>0.1°C 이하</strong></>}
    >
      {editing && <label className="flex min-h-10 items-center gap-3 font-bold">
        <input type="checkbox" className="h-6 w-6" disabled={locked} checked={p.coldChillerEnabled} onChange={e=>change({coldChillerEnabled:e.target.checked})}/>
        정지 의심 알림 사용
      </label>}
    </AlertCriterion>}
    {(!metricKey) && <AlertCriterion
      title="병원 전체 데이터 수집 지연"
      summary={`카톡 · 수집 주기의 ${p.collectionCritical}배 지연`}
      description="마지막 데이터가 들어온 시점부터 계산합니다. 병원별 수집 주기는 아래에서 확인할 수 있습니다."
      warning={<>수집 주기의 <strong>{p.collectionWarning}배</strong> 동안 미수신</>}
      kakao={<>수집 주기의 <strong>{p.collectionCritical}배</strong> 동안 미수신</>}
      note="수집 이력이 있는 병원에 운영시간을 기준으로 적용합니다. 전체 수집이 중단된 동안에는 측정항목 누락 카톡을 함께 보내지 않습니다."
    >
      {editing && number("노란색으로 표시할 지연","collectionWarning","수집 주기의 배수",1,23)}
      {editing && number("카톡을 보낼 지연","collectionCritical","수집 주기의 배수",2,24)}
    </AlertCriterion>}
    </div>
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-background-dark-card">
      <SettingsSection title="병원별 알림 설정" summary={siteId ? undefined : "알림 사용 · 수집 주기"} open={siteId && !metricKey ? true : undefined}>
        {!siteId && <label className="block max-w-sm font-semibold">병원 찾기
          <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="병원 이름 입력" className={field}/>
        </label>}
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {hospitals.map(h => {
            const config = p.hospitals[h.siteId] ?? h.settings;
            const update = (patch: Partial<Hospital>) => change({hospitals: {...p.hospitals, [h.siteId]: {...config, ...patch}}});
            return (
              <SettingsSection key={h.siteId} title={h.name} summary={`알림 ${config.enabled ? "켜짐" : "꺼짐"} · ${duration(config.intervalMinutes)} 주기`} open={siteId && !metricKey ? true : undefined}>
                {editing && <div className="grid items-end gap-2 sm:grid-cols-2">
                  <label className="flex min-h-11 items-center gap-2 font-semibold">
                    <input type="checkbox" className="size-5" disabled={locked} checked={config.enabled} onChange={e=>update({enabled:e.target.checked})}/>
                    알림 사용
                  </label>
                  <label className="block font-semibold">수집 주기 (분)
                    <input type="number" required min={5} max={1440} step={1} disabled={locked} value={config.intervalMinutes} onChange={e=>update({intervalMinutes:e.target.valueAsNumber})} className={field}/>
                  </label>
                </div>}
                {config.enabled && <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/70">
                  <div><dt className="text-xs text-text-secondary">화면 주의</dt><dd className="font-semibold">{duration(config.intervalMinutes * p.collectionWarning)} 지연</dd></div>
                  <div><dt className="text-xs text-text-secondary">카톡 발송</dt><dd className="font-semibold">{duration(config.intervalMinutes * p.collectionCritical)} 지연</dd></div>
                </dl>}
                {h.coldHeadReplacedAt && <p className={muted}>콜드헤드 교체 {h.coldHeadReplacedAt} · 압력 카톡 중지 {h.quietUntil} 00시까지</p>}
              </SettingsSection>
            );
          })}
          {hospitals.length === 0 && <p className="p-3 text-text-secondary">해당 병원이 없습니다.</p>}
        </div>
      </SettingsSection>
    </div>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 font-bold text-rose-800">{error}</p>}
    {editing && <div className="sticky bottom-2 z-10 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-900"><button type="submit" disabled={saving} className="min-h-10 flex-1 rounded-lg bg-sky-700 px-4 font-bold text-white disabled:opacity-50">{saving?"저장 중…":"회사 전체에 저장"}</button><button type="button" disabled={saving} className="min-h-10 rounded-lg border px-4 font-bold" onClick={()=>{setEditing(false);setError("");}}>취소</button></div>}
  </form>;
}
