"use client";

import { closeOnDialogBackdrop } from "@/lib/dialog-backdrop";

import CircleLoader from "@/components/icons/circle-loader";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/provider/auth-provider";

export default function LogoutControls({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  function ask() {
    setError("");
    setOpen(true);
  }
  async function confirm() {
    if (busy || !open) return;
    setBusy(true);
    setError("");
    try {
      await logout(true);
      setOpen(false);
      router.replace("/login");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "로그아웃하지 못했습니다. 다시 시도해주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  const button =
    "min-h-12 w-full rounded-xl px-4 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30";
  return (
    <>
      <button
        type="button"
        role={compact ? "menuitem" : undefined}
        className={`${button}${compact ? "" : " mt-6 border border-slate-200 bg-white dark:border-white/10 dark:bg-background-dark-card"}`}
        onClick={ask}
      >
        로그아웃
      </button>
      {open &&
        createPortal(
          <dialog
            data-logout-dialog
            ref={ref}
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
            onClick={event => { if (!busy) closeOnDialogBackdrop(event, () => setOpen(false)); }}
            onCancel={(e) => {
              e.preventDefault();
              if (!busy) setOpen(false);
            }}
            className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <h2
              id="logout-confirm-title"
              className="text-lg font-bold"
            >
              모든 기기에서 로그아웃할까요?
            </h2>
            <p
              id="logout-confirm-description"
              className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              휴대폰과 PC를 포함한 모든 기기의 로그인이 종료됩니다. 다시 사용하려면 로그인해야 합니다.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-3 text-sm text-rose-600 dark:text-rose-300"
              >
                {error}
              </p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                autoFocus
                disabled={busy}
                onClick={() => setOpen(false)}
                className="action-cancel min-h-12 rounded-xl border border-slate-300 font-bold disabled:opacity-50 dark:border-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirm()}
                className="min-h-12 rounded-xl bg-rose-700 font-bold text-white disabled:opacity-50"
              >
                {busy ? <CircleLoader size="xs" inline /> : "로그아웃"}
              </button>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
