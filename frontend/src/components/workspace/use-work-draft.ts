"use client";
import { useEffect, useRef, useState } from "react";
export function useWorkDraft<T>({
  storageKey,
  value,
  enabled,
  onRestore,
}: {
  storageKey: string;
  value: T;
  enabled: boolean;
  onRestore: (value: T) => void;
}) {
  const encoded = JSON.stringify(value),
    baseline = useRef<string | null>(null),
    saved = useRef(false);
  const [pending, setPending] = useState<{ value: T; at: string } | null>(null),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  const [clean, setClean] = useState(false);
  useEffect(() => {
    baseline.current = null;
    saved.current = false;
    setReady(false);
    setPending(null);
    setClean(false);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (
          draft.version === 1 &&
          draft.value &&
          Date.now() - Date.parse(draft.at) < 7 * 86400000
        )
          setPending(draft);
        else localStorage.removeItem(storageKey);
      }
    } catch {
      setNotice("이 기기에서 임시저장을 사용할 수 없습니다.");
    }
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (enabled && ready && baseline.current === null)
      baseline.current = encoded;
  }, [enabled, ready, encoded]);
  const dirty =
    enabled &&
    ready &&
    !clean &&
    baseline.current !== null &&
    encoded !== baseline.current;
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
  useEffect(() => {
    if (!dirty) return;
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
  }, [dirty]);
  return {
    pending,
    notice,
    dirty,
    restore: () => {
      if (pending) {
        onRestore(pending.value);
        setPending(null);
        setNotice(
          "임시저장 내용을 복구했습니다. 첨부 사진은 업로드 후 24시간이 지나면 다시 첨부해야 할 수 있습니다.",
        );
      }
    },
    discard: () => {
      setPending(null);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    },
    clear: () => {
      saved.current = true;
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
