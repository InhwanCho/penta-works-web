"use client";

import Select from "@/components/common/select";
import CircleLoader from "@/components/icons/circle-loader";
import PageLoader from "@/components/common/page-loader";
import { ArrowBackIconMini } from "@/components/icons/arrow-back-icon";
import HelpButton from "@/components/common/context-help";
import { ALERT_HELP } from "@/lib/alert-help";
import Link from "@/components/common/app-link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

export type NotificationPreferences = {repeatMinutes:number; quietStart:string|null; quietEnd:string|null; suppressWeekends:boolean; holidayDates:string[]};
type PreferenceView = {preferences:NotificationPreferences|null; needsSelection:boolean; previousSettings:{siteId:string;name:string|null;preferences:NotificationPreferences}[]};
const key = ["notification-preferences"];
const defaults:NotificationPreferences = {repeatMinutes:0,quietStart:null,quietEnd:null,suppressWeekends:false,holidayDates:[]};
const panel = "work-panel mb-0! p-3 sm:p-4";
const fieldLabel = "grid min-w-0 gap-2 text-sm font-semibold";
const muted = "break-keep text-sm leading-6 text-text-secondary";
function usePreferences() {
  return useQuery({queryKey:key,queryFn:()=>apiFetch<PreferenceView>("/alerts/notification-preferences"),staleTime:60_000});
}
function preferenceSummary(p: NotificationPreferences) {
  return [
    p.quietStart ? `매일 ${p.quietStart.slice(0,5)}~${p.quietEnd?.slice(0,5)} 쉬기` : "시간 제한 없음",
    p.suppressWeekends ? "주말 쉬기" : "주말도 받기",
    p.holidayDates.length ? `쉬는 날짜 ${p.holidayDates.length}일` : null,
  ].filter(Boolean).join(" · ");
}

export default function NotificationPreferencesPage() {
  const query = usePreferences();
  const [fromDashboard, setFromDashboard] = useState(false);
  useEffect(() => {
    setFromDashboard(new URLSearchParams(window.location.search).get("from") === "dashboard");
  }, []);
  return (
    <main className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6">
      <header className="mb-4">
        <Link href={fromDashboard ? "/?view=alerts" : "/baselines?view=settings"} className="alert-settings-back work-back">
          <span aria-hidden="true"><ArrowBackIconMini /></span>
          {fromDashboard ? "대시보드 알림값" : "알림 설정"}
        </Link>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="alert-settings-page-title">내 카톡 수신 시간 설정</h1>
            <p className={`mt-1 ${muted}`}>내가 받는 모든 병원의 알림에 적용됩니다.</p>
          </div>
          <HelpButton
            title="내 알림 수신 설정"
            message="내 계정에 한 번 설정하면 현재와 앞으로 추가되는 모든 병원에 적용됩니다. 다른 담당자의 설정에는 영향을 주지 않습니다. 쉬는 시간에도 앱 안의 이상 표시와 기록은 남고, 카톡·문자 발송만 쉽니다."
          />
        </div>
      </header>
      {query.isPending ? <PageLoader /> : query.isError ? (
        <div role="alert" className={`${panel} flex flex-wrap items-center justify-between gap-3`}>
          <p className={muted}>수신 설정을 불러오지 못했습니다.</p>
          <button type="button" className="work-secondary" onClick={() => void query.refetch()}>다시 시도</button>
        </div>
      ) : query.data && <PreferenceEditor view={query.data} />}
    </main>
  );
}
function PreferenceEditor({view}:{view:PreferenceView}) {
  const client=useQueryClient();
  const [value,setValue]=useState(view.preferences??defaults);
  const [quiet,setQuiet]=useState(!!view.preferences?.quietStart);
  const [start,setStart]=useState(view.preferences?.quietStart?.slice(0,5)??"18:00");
  const [end,setEnd]=useState(view.preferences?.quietEnd?.slice(0,5)??"09:00");
  const [date,setDate]=useState("");
  const dateInput=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [choice,setChoice]=useState("");
  const patch=(p:Partial<NotificationPreferences>)=>setValue(v=>({...v,...p}));
  function choose(id:string) {
    setChoice(id);setError("");
    const p=id==="new"?defaults:view.previousSettings.find(s=>s.siteId===id)?.preferences;
    if(!p)return;
    setValue(p);setQuiet(!!p.quietStart);setStart(p.quietStart?.slice(0,5)??"18:00");setEnd(p.quietEnd?.slice(0,5)??"09:00");
  }
  function addDate() {
    const chosen = dateInput.current?.value ?? date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(chosen) || !dateInput.current?.validity.valid) {
      setError("추가할 날짜를 선택해주세요.");
      return;
    }
    if (value.holidayDates.length >= 100) {
      setError("쉬는 날짜는 최대 100일입니다.");
      return;
    }
    patch({ holidayDates: [...new Set([...value.holidayDates, chosen])].sort() });
    setDate("");
    setError("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();setError("");
    if(view.needsSelection&&!choice){setError("공통으로 사용할 기존 설정 또는 새로 설정하기를 선택해주세요.");return;}
    const fields=new FormData(event.currentTarget);
    const quietStart=String(fields.get("quietStart")??start),quietEnd=String(fields.get("quietEnd")??end);
    if(quiet&&(!quietStart||!quietEnd||quietStart===quietEnd)){setError("쉬는 시간의 시작과 종료를 서로 다르게 입력해주세요.");return;}
    setBusy(true);
    try {
      const saved=await apiFetch<PreferenceView>("/alerts/notification-preferences",{method:"PATCH",body:JSON.stringify({...value,quietStart:quiet?quietStart:null,quietEnd:quiet?quietEnd:null})});
      client.setQueryData(key,saved);
      await client.invalidateQueries({queryKey:["alert-thresholds"]});
    }catch(e){setError(e instanceof Error?e.message:"저장하지 못했습니다.");}
    finally{setBusy(false);}
  }
  const selectedSettings = choice !== "new" ? view.previousSettings.find(settings => settings.siteId === choice) : undefined;

  return (
    <form onSubmit={save}>
      <fieldset disabled={busy} className="grid min-w-0 gap-3">
        {view.needsSelection && (
          <section className={panel} aria-labelledby="notification-migration-heading">
            <h2 id="notification-migration-heading" className="text-base font-bold">기존 설정을 공통 설정으로 이전</h2>
            <p className={`mt-1 ${muted}`}>저장하기 전까지는 기존 병원별 설정이 유지됩니다. 사용할 설정을 선택한 뒤 아래 내용을 확인하세요.</p>
            <label className={`mt-3 ${fieldLabel}`}>
              가져올 설정
              <Select className="work-input" value={choice} onChange={event => choose(event.target.value)}>
                <option value="">선택해주세요</option>
                <option value="new">새로 설정하기</option>
                {view.previousSettings.map(settings => <option key={settings.siteId} value={settings.siteId}>{settings.name ?? settings.siteId}</option>)}
              </Select>
            </label>
            {selectedSettings && <p className={`mt-2 break-words ${muted}`}>{preferenceSummary(selectedSettings.preferences)}</p>}
          </section>
        )}

        <section className={panel} aria-labelledby="notification-hours-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="notification-hours-heading" className="text-base font-bold">알림 받지 않는 시간</h2>
            <HelpButton title="알림 받지 않는 시간" message={ALERT_HELP["알림 받지 않는 시간"]} />
          </div>
          <label className="work-check cursor-pointer">
            <input type="checkbox" checked={quiet} onChange={event => setQuiet(event.target.checked)} />
            매일 같은 시간에 쉬기
          </label>
          {quiet && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className={fieldLabel}>
                쉬기 시작
                <input type="time" name="quietStart" className="work-input" value={start} onChange={event => setStart(event.target.value)} required />
              </label>
              <label className={fieldLabel}>
                다시 받기 시작
                <input type="time" name="quietEnd" className="work-input" value={end} onChange={event => setEnd(event.target.value)} required />
              </label>
            </div>
          )}
          <p className={`mt-2 ${muted}`}>예: 18:00부터 다음 날 09:00까지 · 한국 시간 기준</p>
        </section>

        <section className={panel} aria-labelledby="notification-dates-heading">
          <h2 id="notification-dates-heading" className="text-base font-bold">주말·알림 쉬는 날짜</h2>
          <label className="work-check cursor-pointer">
            <input type="checkbox" checked={value.suppressWeekends} onChange={event => patch({ suppressWeekends: event.target.checked })} />
            토요일·일요일 쉬기
          </label>
          <p className={muted}>공휴일·휴가 등 하루 종일 쉬는 날짜를 직접 추가하세요.</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <label className={fieldLabel}>
              쉬는 날짜
              <input type="date" ref={dateInput} className="work-input" value={date} onChange={event => setDate(event.target.value)} />
            </label>
            <button type="button" className="work-secondary h-11" onClick={addDate}>추가</button>
          </div>
          {value.holidayDates.length > 0 && (
            <ul className="mt-3 divide-y divide-(--work-line) border-t border-(--work-line)">
              {value.holidayDates.map(day => (
                <li key={day} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="tabular-nums">{day}</span>
                  <button type="button" aria-label={`${day} 삭제`} className="min-h-11 px-3 font-semibold text-rose-700 dark:text-rose-300" onClick={() => patch({ holidayDates: value.holidayDates.filter(value => value !== day) })}>삭제</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className={`hidden lg:block ${muted}`}>쉬는 시간에도 대시보드의 이상 표시와 앱 내 알림 기록은 유지됩니다. 카톡·문자 발송만 쉬고, 다시 받는 시간이 되면 미확인 상태로 계속 발생 중인 문제만 발송 대상이 됩니다.</p>
        {error && <p role="alert" className="text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" aria-busy={busy} className="action-save min-w-28 w-full sm:w-auto">
            {busy ? <CircleLoader size="xs" inline /> : "설정 저장하기"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
