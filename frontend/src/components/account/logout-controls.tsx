"use client";

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
  const [scope, setScope] = useState<"device" | "all" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!scope) return;
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, [scope]);
  function ask(value: "device" | "all") {
    setError("");
    setScope(value);
  }
  async function confirm() {
    if (busy || !scope) return;
    setBusy(true);
    setError("");
    try {
      await logout(scope === "all");
      setScope(null);
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
      {compact ? (
        <button
          type="button"
          role="menuitem"
          className={button}
          onClick={() => ask("device")}
        >
          로그아웃
        </button>
      ) : (
        <details className="dark:bg-background-dark-card mt-6 rounded-xl border border-slate-200 bg-white dark:border-white/10">
          <summary className="min-h-12 cursor-pointer px-4 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            계정 접속 관리
          </summary>
          <div className="border-t border-slate-100 p-2 dark:border-white/10">
            <p className="px-3 py-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
              기기를 바꾸거나 다른 계정으로 접속할 때 이용하세요.
            </p>
            <button
              type="button"
              className={button}
              onClick={() => ask("device")}
            >
              이 기기에서 로그아웃
            </button>
            <button
              type="button"
              className={button}
              onClick={() => ask("all")}
            >
              모든 기기에서 로그아웃
            </button>
          </div>
        </details>
      )}
      {scope &&
        createPortal(
          <dialog
            data-logout-dialog
            ref={ref}
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
            onCancel={(e) => {
              e.preventDefault();
              if (!busy) setScope(null);
            }}
            className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <h2
              id="logout-confirm-title"
              className="text-lg font-bold"
            >
              {scope === "all"
                ? "모든 기기에서 로그아웃할까요?"
                : "이 기기에서 로그아웃할까요?"}
            </h2>
            <p
              id="logout-confirm-description"
              className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300"
            >
              {scope === "all"
                ? "휴대폰과 PC를 포함한 모든 기기의 로그인이 종료됩니다. 다시 사용하려면 로그인해야 합니다."
                : "이 기기의 로그인이 종료됩니다. 다시 사용하려면 로그인해야 합니다. 다른 기기의 로그인은 유지됩니다."}
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
                onClick={() => setScope(null)}
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
