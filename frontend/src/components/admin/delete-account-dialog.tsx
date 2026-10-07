"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function DeleteAccountDialog({ email, name, onClose, onConfirm }: {
  email: string;
  name: string;
  onClose: () => void;
  onConfirm: (email: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirmationEmail.trim().toLowerCase() === email.toLowerCase();

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!matches || saving) return;
    setSaving(true); setError(null);
    try {
      await onConfirm(confirmationEmail.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "계정을 삭제하지 못했습니다. 다시 시도해주세요.");
    } finally { setSaving(false); }
  }

  return createPortal(<dialog ref={dialog} aria-labelledby="delete-account-title" aria-describedby="delete-account-description"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-text-major shadow-xl backdrop:bg-slate-950/55 dark:border-white/10 dark:bg-background-dark-card dark:text-text-dark-primary">
    <form onSubmit={submit}>
      <h2 id="delete-account-title" className="text-xl font-extrabold">계정 삭제 확인</h2>
      <p id="delete-account-description" className="mt-3 text-sm leading-6"><strong>{name}</strong>님의 계정을 삭제합니다. 이 계정은 로그인할 수 없게 되며, 병원 접근 권한과 알림 수신처 등록이 해제됩니다.</p>
      <p className="mt-4 break-all rounded-xl bg-rose-50 px-3 py-3 text-sm font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{email}</p>
      <label className="mt-5 block text-sm font-bold">삭제할 계정의 이메일 입력
        <input autoFocus type="text" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={saving}
          value={confirmationEmail} onChange={event => { setConfirmationEmail(event.target.value); setError(null); }}
          className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-transparent px-3 font-normal dark:border-white/20" />
      </label>
      <p className="mt-2 text-xs text-text-secondary">위 이메일을 직접 입력하면 삭제 버튼이 활성화됩니다.</p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" disabled={saving} onClick={onClose} className="min-h-12 rounded-xl border border-slate-200 font-bold dark:border-white/15">취소</button>
        <button type="submit" disabled={!matches || saving} className="min-h-12 rounded-xl bg-rose-600 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{saving ? "삭제 중…" : "계정 삭제"}</button>
      </div>
    </form>
  </dialog>, document.body);
}
