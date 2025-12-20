"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createPortal } from "react-dom";

// Context 타입 정의
interface ModalContextValue {
  openModals: string[];
  open: (id: string) => void;
  close: (id: string) => void;
}

// Context 생성
export const ModalContext = createContext<ModalContextValue | undefined>(
  undefined,
);

// Provider 컴포넌트
export function ModalProvider({ children }: { children: ReactNode }) {
  const [openModals, setOpenModals] = useState<string[]>([]);

  const open = useCallback((id: string) => {
    setOpenModals((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const close = useCallback((id: string) => {
    setOpenModals((prev) => prev.filter((modal) => modal !== id));
  }, []);

  const value = useMemo(
    () => ({ openModals, open, close }),
    [openModals, open, close],
  );

  // ESC 키 처리: 마지막 열린 모달만 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openModals.length) {
        const lastId = openModals[openModals.length - 1];
        if (lastId !== undefined) {
          close(lastId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openModals, close]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {/* 공통 백드롭: 열린 모달이 하나라도 있으면 렌더링 */}
      {openModals.length > 0 &&
        createPortal(
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: "rgba(0,0,0,0.7)",
              zIndex: 1000,
            }}
            onClick={() => {
              const lastId = openModals[openModals.length - 1];
              if (lastId !== undefined) {
                close(lastId);
              }
            }}
          />,
          document.body,
        )}
    </ModalContext.Provider>
  );
}

export function useModal(id: string) {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  const { openModals, open, close } = context;

  const isOpen = openModals.includes(id);
  const index = openModals.indexOf(id);
  const zIndex = 1000 + (index + 1) * 10;

  return {
    isOpen,
    open: () => open(id),
    close: () => close(id),
    zIndex,
  };
}
