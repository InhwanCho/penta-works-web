"use client";

import { useEffect, useState } from "react";
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
const field = "mt-2 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-lg font-bold dark:border-slate-600 dark:bg-slate-900 disabled:opacity-70";
const card = "rounded-xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-700 dark:bg-background-dark-card";

export default function CompanyAlertSettings({ siteId }: { siteId?: string }) {
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
  if (query.isError || !draft) return <div role="alert" className={card}>설정을 불러오지 못했습니다.<button className="ml-3 min-h-12 underline" onClick={()=>query.refetch()}>다시 시도</button></div>;
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
    <label className="block min-w-0 text-base font-semibold">{label} ({unit})<input type="number" required min={min} max={max} step={step} disabled={locked} className={field} value={p[key]} onChange={e=>change({[key]:e.target.valueAsNumber})}/></label>;
  const hospitals = draft.hospitals.filter(h=>(!siteId || h.siteId===siteId) && (!search || h.name.includes(search)));
  return <form onSubmit={save} className="space-y-5 text-base leading-relaxed">
    {process.env.NEXT_PUBLIC_DEPLOY_ENV === "development" && <p className="rounded-lg bg-slate-100 p-4 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">개발용 화면 · 실제 카톡은 발송되지 않습니다.</p>}
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-extrabold">우리 회사 알림 기준</h2><p className="mt-2 text-slate-600 dark:text-slate-300">관리자가 저장하면 회사 전체 사용자에게 함께 적용됩니다.</p></div>
        {canEdit && !editing && <button type="button" onClick={()=>{setEditing(true);setNotice("");}} className="min-h-12 rounded-lg bg-sky-700 px-5 font-bold text-white">설정 변경</button>}
      </div>
      {!canEdit && <p className="mt-3 font-semibold">설정 변경은 회사 관리자에게 요청해주세요.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><strong>노란색 · 주의</strong><br/>표에서 상태를 확인하세요. 카톡은 보내지 않습니다.</p>
        <p className="rounded-lg bg-rose-50 p-3 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><strong>빨간색 · 확인 필요</strong><br/>문제가 시작될 때 카톡을 한 번 보냅니다.</p>
      </div>
      <p className="mt-3">정상 측정이 2회 연속 확인된 뒤 문제가 다시 발생하면 새 카톡을 보냅니다.</p>
      <Link href="/notification-settings?from=baselines" className="mt-3 inline-flex min-h-12 items-center font-bold text-sky-800 underline dark:text-sky-300">내가 알림 받는 시간·주말 설정 →</Link>
      <p className="text-sm text-slate-600 dark:text-slate-300">개인 반복 설정을 켜도 이 화면의 알림은 문제마다 한 번만 보냅니다.</p>
    </section>
    <section className={card}>
      <h3 className="text-lg font-extrabold">헬륨 압력 · He Pressure</h3>
      <p className="mt-2">최근 7일 평균에서 ±{p.tolerancePercent}% 벗어나거나 {p.pressureWarning}~{p.pressureCritical}이면 노란색입니다. 7일 평균을 넘는 측정값이 5회 연속 오를 때도 노란색으로 표시합니다.</p>
      <p className="mt-2"><strong>{p.pressureCritical} 초과가 2회 연속</strong>이면 빨간색과 카톡 1회로 알려드립니다.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{number("노란색 시작 압력","pressureWarning","psi",0.01,100,0.01)}{number("카톡을 보내는 초과 기준","pressureCritical","psi",0.01,100,0.01)}</div>
      <div className="mt-4 rounded-lg bg-slate-50 p-4 dark:bg-slate-800"><strong>콜드헤드 교체 후 5일</strong><p className="mt-1">완료된 콜드헤드 업무기록의 작업일부터 평균을 새로 계산합니다. 첫 5일은 색상과 연속 횟수만 표시하고 헬륨 압력 카톡은 쉽니다. 5일 후에도 문제가 계속되면 한 번 알립니다.</p><p className="mt-2 text-sm">새 평균은 유효한 측정값 12개부터 표시합니다. 그전에도 압력의 고정 기준과 누락 횟수는 확인합니다.</p></div>
    </section>
    <section className={card}>
      <h3 className="text-lg font-extrabold">헬륨 압력 값이 들어오지 않을 때</h3>
      <p className="mt-2">{p.missingWarning}회 연속 누락부터 노란색, {p.missingCritical}회부터 빨간색과 카톡 1회입니다.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{number("노란색으로 표시할 연속 누락","missingWarning","회",1,287)}{number("카톡을 보낼 연속 누락","missingCritical","회",2,288)}</div>
      <p className="mt-3 text-sm">정상값이 한 번 들어오면 누락 횟수는 0으로 돌아갑니다. 다른 항목의 측정 누락은 카톡을 보내지 않습니다.</p>
    </section>
    <section className={card}>
      <h3 className="text-lg font-extrabold">온도·습도·헬륨 잔량의 평균 비교</h3>
      <p className="mt-2">He Level, 그래디언트칠러, 실드쿨러 IN·OUT, 항온항습 온도·습도는 최근 24시간 평균을 기준으로 봅니다.</p>
      <p className="mt-2">평균보다 {p.tolerancePercent}% 높거나 낮으면 노란색으로 표시합니다. 평균 이탈만으로는 카톡을 보내지 않습니다.</p>
      <div className="mt-4 max-w-sm">{number("평균에서 벗어나는 비율","tolerancePercent","%",0.1,100,0.1)}</div>
      <p className="mt-3 text-sm">헬륨 압력의 7일 평균에도 같은 비율을 적용합니다. 미측정 값은 평균에서 제외합니다.</p>
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700"><h4 className="font-bold">그래디언트칠러 고온 알림</h4><p className="mt-2">{p.gradientCritical}°C 초과가 2회 연속이면 빨간색과 카톡 1회로 알려드립니다.</p><div className="mt-3 max-w-sm">{number("카톡을 보내는 초과 온도","gradientCritical","°C",0.1,100,0.1)}</div></div>
    </section>
    <section className={card}>
      <h3 className="text-lg font-extrabold">콜드칠러 정지 의심</h3>
      <label className="mt-3 flex min-h-12 items-center gap-3 font-bold"><input type="checkbox" className="h-6 w-6" disabled={locked} checked={p.coldChillerEnabled} onChange={e=>change({coldChillerEnabled:e.target.checked})}/>정지 의심 알림 사용</label>
      <p>IN·OUT 온도 차이가 0.1°C 이하면 빨간색으로 표시하고 카톡을 한 번 보냅니다. 공냉식 병원은 제외합니다.</p>
    </section>
    <section className={card}>
      <h3 className="text-lg font-extrabold">병원 데이터 전체가 들어오지 않을 때</h3>
      <p className="mt-2">병원 수집 주기의 {p.collectionWarning}배가 지나면 노란색, {p.collectionCritical}배가 지나면 빨간색과 카톡 1회입니다.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{number("노란색으로 표시할 지연","collectionWarning","수집 주기의 배수",1,23)}{number("카톡을 보낼 지연","collectionCritical","수집 주기의 배수",2,24)}</div>
      <p className="mt-3 text-sm">설치 전처럼 수집 기록이 없는 병원은 표에 -로 표시합니다. 병원 운영시간을 적용합니다. 전체 수집이 중단된 동안에는 항목별 누락 카톡을 중복 발송하지 않습니다.</p>
    </section>
    <section className={card}>
      <h3 className="text-lg font-extrabold">병원별 알림 켜기·끄기</h3>
      <p className="mt-2">알림을 끄면 회사 전체 사용자의 알림이 중지됩니다. 측정값과 그래프는 계속 볼 수 있습니다.</p>
      {!siteId && <label className="mt-4 block font-bold">병원 찾기<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="병원 이름 입력" className={field}/></label>}
      <div className="mt-4 space-y-4">{hospitals.map(h=>{
        const config=p.hospitals[h.siteId]??h.settings;
        const update=(patch:Partial<Hospital>)=>change({hospitals:{...p.hospitals,[h.siteId]:{...config,...patch}}});
        return <div key={h.siteId} className="rounded-lg border border-slate-200 p-4 dark:border-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="text-lg font-bold">{h.name}</h4><label className="flex min-h-12 items-center gap-3 font-bold"><input type="checkbox" className="h-6 w-6" disabled={locked} checked={config.enabled} onChange={e=>update({enabled:e.target.checked})}/>{config.enabled?"알림 켜짐":"알림 꺼짐"}</label></div>
          <label className="mt-3 block max-w-sm font-semibold">데이터가 들어오는 주기 (분)<input type="number" required min={5} max={1440} step={1} disabled={locked} value={config.intervalMinutes} onChange={e=>update({intervalMinutes:e.target.valueAsNumber})} className={field}/></label>
          <p className="mt-2">{config.enabled?`${config.intervalMinutes*p.collectionWarning}분 동안 안 오면 노란색 · ${config.intervalMinutes*p.collectionCritical}분 동안 안 오면 빨간색·카톡 1회` : "이 병원은 알림을 보내지 않습니다."}</p>
          {h.coldHeadReplacedAt && <p className="mt-2 text-sm">최근 콜드헤드 교체 {h.coldHeadReplacedAt} · 헬륨 압력 카톡 쉬는 기간 종료 {h.quietUntil} 00시</p>}
        </div>;
      })}{hospitals.length===0 && <p>해당 병원이 없습니다.</p>}</div>
    </section>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 font-bold text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-emerald-50 p-4 font-bold text-emerald-800">{notice}</p>}
    {editing && <div className="sticky bottom-2 z-10 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-900"><button type="submit" disabled={saving} className="min-h-12 flex-1 rounded-lg bg-sky-700 px-4 font-bold text-white disabled:opacity-50">{saving?"저장 중…":"저장하고 회사 전체에 적용"}</button><button type="button" disabled={saving} className="min-h-12 rounded-lg border px-4 font-bold" onClick={()=>{setEditing(false);setError("");}}>취소</button></div>}
  </form>;
}
