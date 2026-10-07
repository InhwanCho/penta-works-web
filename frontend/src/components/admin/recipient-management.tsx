"use client";

import PhoneInput from "@/components/forms/phone-input";
import { formatPhone, phoneDigits } from "@/lib/phone";
import { useAuth } from "@/components/provider/auth-provider";
import { apiFetch, type AlertRecipient, type SiteAlertSettings } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

type RecipientSite = Pick<SiteAlertSettings, "siteid" | "name">;

export default function RecipientManagement({ sites }: { sites: RecipientSite[] }) {
  const { isAdmin, session } = useAuth();
  const client = useQueryClient();
  const queryKey = ["alert-recipients", session?.id];
  const recipients = useQuery({ queryKey, queryFn: () => apiFetch<AlertRecipient[]>("/alerts/recipients"), enabled: isAdmin });
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey }),
    client.invalidateQueries({ queryKey: ["alert-events"] }),
    client.invalidateQueries({ queryKey: ["dashboard"] }),
  ]);
  const create = useMutation({
    mutationFn: (request: { siteId: string; channel: AlertRecipient["channel"]; destination: string; userId?: number; quietStart: string | null; quietEnd: string | null; enabled: boolean }) =>
      apiFetch<AlertRecipient>("/alerts/recipients", { method: "POST", body: JSON.stringify(request) }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, userId, destination, quietStart, quietEnd, enabled }: AlertRecipient) =>
      apiFetch<AlertRecipient>(`/alerts/recipients/${id}`, { method: "PATCH", body: JSON.stringify({ userId, destination, quietStart, quietEnd, enabled }) }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/alerts/recipients/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  if (!isAdmin) return null;
  return <RecipientPanel sites={sites} recipients={recipients.data ?? []} loading={recipients.isPending} failed={recipients.isError}
    onCreate={request => create.mutateAsync(request)} onUpdate={recipient => update.mutateAsync(recipient)} onDelete={id => remove.mutateAsync(id)} />;
}

function RecipientPanel({ sites, recipients, loading, failed, onCreate, onUpdate, onDelete }: {
  sites: Pick<SiteAlertSettings, "siteid" | "name">[]; recipients: AlertRecipient[]; loading: boolean; failed: boolean;
  onCreate: (request: { siteId: string; channel: AlertRecipient["channel"]; destination: string; userId?: number; quietStart: string | null; quietEnd: string | null; enabled: boolean }) => Promise<AlertRecipient>;
  onUpdate: (recipient: AlertRecipient) => Promise<AlertRecipient>; onDelete: (id: number) => Promise<void>;
}) {
  const { isAdmin, session } = useAuth();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => apiFetch<{ id: number; name: string; email: string; phone: string | null; siteIds: string[]; role: string; status: string }[]>("/admin/accounts/users"), enabled: isAdmin });
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [owner, setOwner] = useState<number>(session?.id ?? 0);
  const [destination, setDestination] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const chosenUser = users.data?.find(user => user.id === owner);
  const availableSites = chosenUser?.role === "USER" ? sites.filter(site => chosenUser.siteIds.includes(site.siteid)) : sites;
  async function submit(event: FormEvent) {
    event.preventDefault();
    const phone = destination.replace(/[-\s]/g, "");
    if (!/^01[016789][0-9]{7,8}$/.test(phone)) { setError("휴대폰 번호를 확인해주세요."); return; }
    setSaving(true); setError(null); setResultMessage("");
    let created = 0, skipped = 0;
    const failures: { id: string; message: string }[] = [];
    try {
      for (const siteId of selectedSites) {
        if (!availableSites.some(site => site.siteid === siteId)) { failures.push({ id: siteId, message: "담당자의 병원 접근 권한을 확인해주세요." }); continue; }
        const existing = recipients.find(row => row.siteId === siteId && row.destination.replace(/[-\s]/g, "") === phone);
        if (existing) {
          if (existing.userId !== (owner || session?.id) || !existing.enabled) failures.push({ id: siteId, message: "같은 번호가 다른 담당자 또는 수신 중지 상태로 등록되어 있습니다. 기존 수신처를 수정해주세요." });
          else skipped++;
          continue;
        }
        try {
          await onCreate({ siteId, userId: owner || undefined, channel: "KAKAO_ALIMTALK", destination: phoneDigits(phone), quietStart: null, quietEnd: null, enabled: true });
          created++;
        } catch (err) { failures.push({ id: siteId, message: err instanceof Error ? err.message : "등록 실패" }); }
      }
      setResultMessage(`신규 등록 ${created}개 · 기존 등록 ${skipped}개 · 확인 필요 ${failures.length}개`);
      setSelectedSites(failures.map(item => item.id));
      if (failures.length) setError(failures.map(item => `${sites.find(site => site.siteid === item.id)?.name ?? item.id}: ${item.message}`).join("\n"));
      else setDestination("");
    } finally { setSaving(false); }
  }
  return <section className="grid gap-4 xl:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
    <form onSubmit={submit} className="h-fit rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-background-dark-card">
      <h2 className="text-lg font-extrabold">{isAdmin ? "담당자 수신처 등록" : "내 수신처 등록"}</h2>
      <fieldset disabled={saving || loading || failed} className="min-w-0 disabled:opacity-60">
      <p className="text-text-secondary mt-2 text-sm">병원마다 여러 담당자를 등록할 수 있습니다. 각 번호로 알림톡을 보내고 실패하면 문자로 대체합니다.</p>
      {!isAdmin && <p className="mt-4 text-sm font-bold">담당자 · {session?.name} (본인)</p>}
      {isAdmin && <label className="mt-4 block text-sm font-bold">담당자<select value={owner} onChange={event => { const id = Number(event.target.value); setOwner(id); setSelectedSites([]); setDestination(users.data?.find(user => user.id === id)?.phone ?? ""); }} className="mt-1 w-full rounded-lg border bg-slate-50 p-3 dark:bg-background-dark-primary dark:border-white/10"><option value={session?.id}>{session?.name} (본인)</option>{users.data?.filter(user => user.id !== session?.id && user.status === "ACTIVE").map(user => <option value={user.id} key={user.id}>{user.name} · {user.email}</option>)}</select></label>}
      <fieldset className="mt-4"><legend className="text-sm font-bold">받을 병원 ({selectedSites.length}개 선택)</legend>
        <label className="my-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={availableSites.length > 0 && availableSites.every(site => selectedSites.includes(site.siteid))} onChange={event => setSelectedSites(event.target.checked ? availableSites.map(site => site.siteid) : [])} />전체 사이트 선택</label>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-white/10">{availableSites.map(site => <label className="flex min-h-11 items-center gap-2 text-sm" key={site.siteid}><input type="checkbox" className="h-5 w-5" checked={selectedSites.includes(site.siteid)} onChange={event => setSelectedSites(current => event.target.checked ? [...current, site.siteid] : current.filter(id => id !== site.siteid))} />{site.name} <span className="text-text-secondary">{site.siteid}</span></label>)}</div>
      </fieldset>
      <label className="mt-4 block text-sm font-bold">수신 휴대폰 번호<PhoneInput required value={destination} onValueChange={setDestination} placeholder="010-1234-5678" className="mt-1 w-full rounded-lg border bg-slate-50 p-3 dark:bg-background-dark-primary dark:border-white/10" /></label>
      <p className="text-text-secondary mt-3 text-xs leading-5">알림 기준·조용한 시간·지정 휴일은 담당자 본인의 ‘내 알림 패턴’에서 설정합니다.</p>
      {resultMessage && <p role="status" className="mt-3 text-sm font-bold text-sky-700 dark:text-sky-300">{resultMessage}</p>}
      {error && <p role="alert" className="mt-3 whitespace-pre-line text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      <button disabled={saving || selectedSites.length === 0} className="mt-4 min-h-11 w-full rounded-lg bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-40">{saving ? "등록 중…" : `선택한 ${selectedSites.length}개 병원에 등록`}</button>
      </fieldset>
    </form>
    <div><h2 className="text-lg font-extrabold">{isAdmin ? "병원별 담당자 · 번호" : "내 등록 현황"}</h2>
      <select aria-label="수신처 병원 필터" value={siteFilter} onChange={event => setSiteFilter(event.target.value)} className="my-3 min-h-11 w-full rounded-lg border bg-white px-3 dark:bg-background-dark-card dark:border-white/10"><option value="">전체 병원 · {recipients.length}개 수신처</option>{sites.map(site => <option key={site.siteid} value={site.siteid}>{site.name} · {recipients.filter(row => row.siteId === site.siteid).length}명</option>)}</select>
      {failed && <p role="alert">수신처를 불러오지 못했습니다.</p>}
      {loading ? <p>불러오는 중…</p> : sites.filter(site => !siteFilter || site.siteid === siteFilter).map(site => <section key={site.siteid} className="mb-4"><h3 className="mb-2 font-bold">{site.name} · {site.siteid}</h3>{recipients.filter(row => row.siteId === site.siteid).length === 0 ? <p className="text-text-secondary rounded-lg border border-dashed p-3 text-sm">등록된 수신처 없음</p> : <div className="space-y-2">{recipients.filter(row => row.siteId === site.siteid).map(row => <RecipientRow key={row.id} recipient={row} onUpdate={onUpdate} onDelete={onDelete} />)}</div>}</section>)}
    </div>
  </section>;
}

function RecipientRow({ recipient, onUpdate, onDelete }: { recipient: AlertRecipient; onUpdate: (recipient: AlertRecipient) => Promise<AlertRecipient>; onDelete: (id: number) => Promise<void> }) {
  const { isAdmin } = useAuth();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => apiFetch<{ id: number; name: string; email: string; phone: string | null; siteIds: string[]; role: string; status: string }[]>("/admin/accounts/users"), enabled: isAdmin });
  const [owner, setOwner] = useState(recipient.userId);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(recipient.destination);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function toggleEditing() {
    setPhone(recipient.destination); setOwner(recipient.userId);
    setError(null); setEditing(!editing);
  }
  async function update() {
    setSaving(true); setError(null);
    try {
      await onUpdate({ ...recipient, userId: owner, destination: phoneDigits(phone), quietStart: null, quietEnd: null, enabled: true });
      setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : "변경하지 못했습니다."); }
    finally { setSaving(false); }
  }
  async function remove() { if (!window.confirm("이 병원의 수신처를 삭제할까요?")) return; setSaving(true); try { await onDelete(recipient.id); } catch (err) { setError(err instanceof Error ? err.message : "삭제하지 못했습니다."); } finally { setSaving(false); } }
  return <article className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-background-dark-card">
    {editing && isAdmin && <label className="mb-3 block text-xs font-bold">수신 담당자<select value={owner} onChange={event => setOwner(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-lg border bg-slate-50 px-3 dark:border-white/10 dark:bg-background-dark-primary"><option value={recipient.userId}>{recipient.userName}</option>{users.data?.filter(user => user.id !== recipient.userId && user.status === "ACTIVE" && (user.role !== "USER" || user.siteIds.includes(recipient.siteId))).map(user => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label>}
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold">{recipient.userName} · {formatPhone(recipient.destination)}</p><p className="text-text-secondary mt-1 text-xs">알림톡 → 실패 시 문자 · 담당자의 내 알림 패턴 적용</p></div><button type="button" disabled={saving} onClick={toggleEditing} className="min-h-11 rounded-lg border px-3 text-xs font-bold">{editing ? "접기" : "수정"}</button></div>
    {editing && <div className="mt-3 space-y-3"><label className="block text-xs font-bold">휴대폰 번호<PhoneInput value={phone} onValueChange={setPhone} className="mt-1 min-h-11 w-full rounded-lg border bg-slate-50 p-3 dark:bg-background-dark-primary dark:border-white/10" /></label><div className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => update()} className="min-h-11 rounded-lg bg-sky-700 px-4 text-sm font-bold text-white">저장</button><button type="button" disabled={saving} onClick={remove} className="min-h-11 px-3 text-sm text-rose-600 dark:text-rose-300">삭제</button></div></div>}
    {error && <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
  </article>;
}
