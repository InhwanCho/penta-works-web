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
  /** 모달이 닫힐 때(ESC, 바깥 클릭, 닫기 버튼 모두 포함) 호출되는 콜백 */
  onRequestClose?: () => void;
  showCloseButton?: boolean;
  /** 바깥 영역 클릭으로 닫기 허용 여부 (기본값: true) */
  closeOnOverlay?: boolean;
  /** ESC 키로 닫기 허용 여부 (기본값: true) */
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
    // 모달 스토어 상태 먼저 닫기
    close();
    // 외부에서 전달한 후처리 실행(라우팅/로그 등)
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
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex }}
      onClick={closeOnOverlay ? handleClose : undefined}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="dark:bg-background-dark-card relative rounded-lg bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            className={`absolute top-4 right-4 ${closeBtnLocation}`}
            onClick={() => (onCloseByX ? onCloseByX() : handleClose())}
            aria-label="닫기"
          >
            <XIcon
              className={`size-5 cursor-pointer dark:bg-transparent dark:text-white ${closeBtnStyle}`}
            />
          </button>
        )}

        {children}
      </div>
    </div>,
    document.body,
  );
}
