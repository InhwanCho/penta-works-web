"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type Props = {
  onRefresh: () => Promise<unknown> | void;
  disabled?: boolean;
  /** 네비게이션 바 높이(지표 위치 조정용). 기본 56px */
  topOffset?: number;
  children?: ReactNode;
};

// 당김 임계값 / 최대 이동 거리 (px)
const THRESHOLD = 80;
const MAX_PULL = 120;
// 당김 저항 (1.0 = 손가락 이동 그대로, 작을수록 둔해짐)
const RESISTANCE = 0.4;
// 화면 맨 최상단 판정 허용 오차(px). iOS 바운스 등 미세한 양수값 흡수
const TOP_TOLERANCE = 0;

/** 현재 문서의 scrollTop 을 여러 소스에서 안전하게 가져옵니다. */
function getDocumentScrollTop() {
  if (typeof window === "undefined") return 0;
  return Math.max(
    0,
    window.scrollY ||
      document.documentElement?.scrollTop ||
      document.body?.scrollTop ||
      0,
  );
}

/** 화면 맨 최상단 여부 */
function isAtTop() {
  return getDocumentScrollTop() <= TOP_TOLERANCE;
}

/**
 * 모바일에서 화면 최상단일 때 아래로 당기면 새로고침을 실행합니다.
 * - window.scrollY === 0 일 때만 동작
 * - 기본 브라우저 바운스(터치 드래그 시 주소창/상단 튕김)를 방지하기 위해 touchmove에
 *   passive:false 를 사용하지만, 당김이 확정된 이후에만 preventDefault 를 호출합니다.
 */
export default function PullToRefresh({
  onRefresh,
  disabled = false,
  topOffset = 56,
  children,
}: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 항상 최신 onRefresh 참조 (리스너 재등록 방지)
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (disabled) return;

    let startY: number | null = null;
    let active = false;
    let distance = 0;
    let refreshing = false;

    /** 터치 타깃의 조상 중 세로 스크롤이 위로 남아있는 컨테이너가 있으면 true */
    const hasScrollableAncestor = (target: EventTarget | null) => {
      let el = target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.scrollTop > 0) {
          const style = window.getComputedStyle(el);
          const overflowY = style.overflowY;
          if (
            overflowY === "auto" ||
            overflowY === "scroll" ||
            overflowY === "overlay"
          ) {
            return true;
          }
        }
        el = el.parentElement;
      }
      return false;
    };

    const onTouchStart = (e: TouchEvent) => {
      // 1) 이미 새로고침 중이면 무시
      if (refreshing) {
        active = false;
        return;
      }
      // 2) 문서가 화면 맨 최상단이어야만 허용
      if (!isAtTop()) {
        active = false;
        return;
      }
      // 3) 모달 등 내부 스크롤 컨텐츠 내부에서 시작한 터치는 무시
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-ptr-ignore]")) {
        active = false;
        return;
      }
      // 4) 내부 스크롤 가능한 조상이 위로 스크롤되어 있으면 무시
      if (hasScrollableAncestor(target)) {
        active = false;
        return;
      }
      // 멀티터치는 무시 (핀치줌 등)
      if (e.touches.length > 1) {
        active = false;
        return;
      }
      startY = e.touches[0]?.clientY ?? null;
      active = startY != null;
      distance = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active || startY == null) return;
      // 이동 중에도 계속 최상단 유지되는지 확인
      if (!isAtTop()) {
        active = false;
        distance = 0;
        setPullDistance(0);
        return;
      }
      // 멀티터치 발생 시 취소
      if (e.touches.length > 1) {
        active = false;
        distance = 0;
        setPullDistance(0);
        return;
      }
      const y = e.touches[0]?.clientY ?? startY;
      const delta = y - startY;
      if (delta <= 0) {
        distance = 0;
        setPullDistance(0);
        return;
      }
      distance = Math.min(delta * RESISTANCE, MAX_PULL);
      setPullDistance(distance);
      // 당김이 의미있는 거리일 때만 바운스 방지
      if (e.cancelable && distance > 3) {
        e.preventDefault();
      }
    };

    const finishPull = async () => {
      if (!active) return;
      active = false;
      startY = null;

      const reached = distance >= THRESHOLD;
      distance = 0;
      setPullDistance(0);

      if (reached) {
        refreshing = true;
        setIsRefreshing(true);
        try {
          await onRefreshRef.current();
        } finally {
          refreshing = false;
          setIsRefreshing(false);
        }
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", finishPull, { passive: true });
    window.addEventListener("touchcancel", finishPull, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove as EventListener);
      window.removeEventListener("touchend", finishPull);
      window.removeEventListener("touchcancel", finishPull);
    };
  }, [disabled]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const shownHeight = isRefreshing ? 56 : pullDistance;

  return (
    <>
      <div
        aria-hidden={!isRefreshing && pullDistance === 0}
        className={[
          "pointer-events-none fixed right-0 left-0 z-20 flex items-start justify-center overflow-hidden",
          // 당김 중에는 손가락을 따라오도록 transition 없음. 놓았을 때만 부드럽게 줄어듦.
          isRefreshing || pullDistance > 0
            ? ""
            : "transition-[height] duration-200 ease-out",
        ].join(" ")}
        style={{
          top: `${topOffset}px`,
          height: `${shownHeight}px`,
        }}
      >
        <div
          className="border-border/60 dark:border-background-dark-secondary/60 dark:bg-background-dark-card/95 mt-2 flex h-9 w-9 items-center justify-center rounded-full border bg-white/95 shadow-[0_1px_2px_0_rgb(0_0_0_/_0.06)] backdrop-blur"
          style={{
            opacity: isRefreshing ? 1 : Math.max(0.4, progress),
            transform: `scale(${isRefreshing ? 1 : 0.85 + progress * 0.15})`,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className={[
              "text-text-secondary dark:text-text-dark-primary/70 h-4 w-4",
              isRefreshing ? "animate-spin" : "",
            ].join(" ")}
            style={
              isRefreshing
                ? undefined
                : { transform: `rotate(${progress * 270}deg)` }
            }
            aria-hidden
          >
            <path
              d="M12 4a8 8 0 1 1-5.66 2.34"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M12 2v5l-3-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {children}
    </>
  );
}
