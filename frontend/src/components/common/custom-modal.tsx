"use client";

import XIcon from "@/components/icons/x-icon";
import { useModal } from "@/components/provider/modal-provider";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

type CustomModalProps = {
  id: string;
  closeBtnStyle?: string;
  closeBtnLocation?: string;
  children: React.ReactNode;
  onRequestClose?: () => void;
  showCloseButton?: boolean;
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
  onCloseByX?: () => void;
};

export default function CustomModal({
  id,
  closeBtnStyle,
  closeBtnLocation,
  children,
  onRequestClose,
  showCloseButton = true,
  closeOnOverlay = true,
  closeOnEsc = true,
  onCloseByX,
}: CustomModalProps) {
  const { isOpen, close, zIndex } = useModal(id);

  const handleClose = useCallback(() => {
    close();
    onRequestClose?.();
  }, [close, onRequestClose]);

  // ESC 키 처리
  useEffect(() => {
    if (!(isOpen && closeOnEsc)) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, closeOnEsc, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center p-0 sm:items-start sm:p-6 sm:pt-[10vh]"
      style={{ zIndex }}
      onClick={closeOnOverlay ? handleClose : undefined}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "dark:bg-background-dark-card relative w-full bg-white",
          "shadow-[0_10px_38px_-10px_rgba(22,23,24,0.25),_0_10px_20px_-15px_rgba(22,23,24,0.15)]",
          "border border-border/80 dark:border-background-dark-secondary/80",
          // 모바일: 바텀 시트
          "max-h-[92vh] overflow-hidden rounded-t-xl",
          // 데스크탑: 중앙 카드
          "sm:max-w-[560px] sm:rounded-lg",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            className={`text-text-secondary hover:bg-background-tertiary dark:text-text-dark-primary/60 dark:hover:bg-background-dark-secondary absolute top-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${closeBtnLocation ?? ""}`}
            onClick={() => (onCloseByX ? onCloseByX() : handleClose())}
            aria-label="닫기"
          >
            <XIcon
              className={`size-4 ${closeBtnStyle ?? ""}`}
            />
          </button>
        )}

        {children}
      </div>
    </div>,
    document.body,
  );
}
