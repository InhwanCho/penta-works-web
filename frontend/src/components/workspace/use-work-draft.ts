"use client";
import { useEffect, useRef, useState } from "react";
export function useWorkDraft<T>({
  storageKey,
  value,
  enabled,
  onRestore,
  shouldKeep,
  warnOnLeave = true,
  restoreNotice = "임시저장 내용을 복구했습니다. 첨부 사진은 업로드 후 24시간이 지나면 다시 첨부해야 할 수 있습니다.",
}: {
  storageKey: string;
  value: T;
  enabled: boolean;
  onRestore: (value: T) => void;
  restoreNotice?: string;
  shouldKeep?: (value: T) => boolean;
  warnOnLeave?: boolean;
}) {
  const keep = useRef(shouldKeep);
  keep.current = shouldKeep;
  const encoded = JSON.stringify(value),
    baseline = useRef<string | null>(null),
    saved = useRef(false);
  const [pending, setPending] = useState<{ value: T; at: string } | null>(null),
    [readyKey, setReadyKey] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const [clean, setClean] = useState(false);
  useEffect(() => {
    baseline.current = null;
    saved.current = false;
    setReadyKey(null);
    setPending(null);
    setNotice("");
    setClean(false);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (
          draft.version === 1 &&
          draft.value &&
          (!keep.current || keep.current(draft.value)) &&
          Date.parse(draft.at) <= Date.now() &&
          Date.now() - Date.parse(draft.at) < 7 * 86400000
        )
          setPending(draft);
        else localStorage.removeItem(storageKey);
      }
    } catch {
      setNotice("이 기기에서 임시저장을 사용할 수 없습니다.");
    }
    setReadyKey(storageKey);
  }, [storageKey]);
  const ready = readyKey === storageKey;
  useEffect(() => {
    if (enabled && ready && baseline.current === null)
      baseline.current = encoded;
  }, [enabled, ready, encoded]);
  const dirty =
    enabled &&
    ready &&
    !clean &&
    baseline.current !== null &&
    encoded !== baseline.current &&
    (!shouldKeep || shouldKeep(value));
  useEffect(() => {
    if (!dirty || pending || saved.current) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, value, at: new Date().toISOString() }),
      );
      setNotice("이 기기에 임시저장됨");
    } catch {
      setNotice("임시저장 공간이 부족합니다. 내용을 저장해주세요.");
    }
  }, [dirty, encoded, pending, storageKey, value]);
  const dirtyRef = useRef(dirty && warnOnLeave);
  dirtyRef.current = dirty && warnOnLeave;
  useEffect(() => {
    if (!dirty || !warnOnLeave) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]");
      if (
        a &&
        a.getAttribute("target") !== "_blank" &&
        !a.getAttribute("href")?.startsWith("#") &&
        !window.confirm("저장하지 않은 내용이 있습니다. 이 화면을 나갈까요?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, warnOnLeave]);
  // Browser back/forward is not a link click. Prefer cancellable navigation where available.
  useEffect(() => {
    if (!enabled) return;
    const navigation = (window as unknown as { navigation?: EventTarget })
      .navigation;
    if (navigation) {
      const navigate = (event: Event) => {
        const e = event as Event & {
          navigationType?: string;
          canIntercept?: boolean;
        };
        if (
          e.navigationType === "traverse" &&
          e.cancelable &&
          dirtyRef.current &&
          !window.confirm("저장하지 않은 내용이 있습니다. 이 화면을 나갈까요?")
        )
          e.preventDefault();
      };
      navigation.addEventListener("navigate", navigate);
      return () => navigation.removeEventListener("navigate", navigate);
    }
    // Safari fallback: retain one same-URL entry so a cancelled back action can return safely.
    const marker = `draft:${storageKey}`;
    if (window.history.state?.mreyesDraftGuard !== marker)
      window.history.pushState(
        { ...window.history.state, mreyesDraftGuard: marker },
        "",
        window.location.href,
      );
    let returning = false;
    const pop = (e: PopStateEvent) => {
      if (returning) {
        returning = false;
        e.stopImmediatePropagation();
        return;
      }
      e.stopImmediatePropagation();
      if (
        dirtyRef.current &&
        !window.confirm("저장하지 않은 내용이 있습니다. 이 화면을 나갈까요?")
      ) {
        returning = true;
        window.history.forward();
      } else {
        window.removeEventListener("popstate", pop, true);
        window.history.back();
      }
    };
    window.addEventListener("popstate", pop, true);
    return () => window.removeEventListener("popstate", pop, true);
  }, [enabled, storageKey]);
  return {
    pending,
    notice,
    confirmLeave: () =>
      !dirty || !warnOnLeave ||
      window.confirm("저장하지 않은 내용이 있습니다. 이 화면을 나갈까요?"),
    dirty,
    restore: () => {
      if (pending) {
        baseline.current = "";
        saved.current = false;
        setClean(false);
        onRestore(pending.value);
        setPending(null);
        setNotice(restoreNotice);
      }
    },
    pause: () => {
      if (dirty) setPending({ value, at: new Date().toISOString() });
    },
    discard: () => {
      setPending(null);
      setNotice("");
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    },
    clear: () => {
      saved.current = true;
      dirtyRef.current = false;
      baseline.current = encoded;
      setClean(true);
      setPending(null);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      setNotice("");
    },
    resume: () => {
      saved.current = false;
      setClean(false);
      baseline.current = null;
    },
  };
}
