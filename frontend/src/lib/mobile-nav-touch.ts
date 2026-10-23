import type { TouchEvent } from "react";

const TAP_DISTANCE = 10;
const TAP_DURATION = 500;

/** Touch taps use the normal anchor click path, including unsaved-form guards. */
export function createMobileNavTouchHandlers() {
  let tap: { id: number; x: number; y: number; started: number; link: HTMLAnchorElement } | null = null;
  const cancel = () => { tap = null; };
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      cancel();
      if (event.touches.length !== 1 || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      const touch = event.touches[0];
      if (!link || !event.currentTarget.contains(link)) return;
      tap = { id: touch.identifier, x: touch.clientX, y: touch.clientY, started: event.timeStamp, link };
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      if (!tap) return;
      const touch = Array.from(event.touches).find(item => item.identifier === tap!.id);
      if (event.touches.length !== 1 || !touch || Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) > TAP_DISTANCE) cancel();
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const current = tap;
      cancel();
      if (!current || event.defaultPrevented || !event.cancelable || event.touches.length > 0) return;
      const touch = Array.from(event.changedTouches).find(item => item.identifier === current.id);
      if (!touch || event.timeStamp - current.started > TAP_DURATION ||
          Math.hypot(touch.clientX - current.x, touch.clientY - current.y) > TAP_DISTANCE ||
          !current.link.isConnected || !event.currentTarget.contains(current.link)) return;
      // Suppress the delayed compatibility click so the link runs exactly once.
      event.preventDefault();
      current.link.click();
    },
    onTouchCancel: cancel,
    onContextMenu: cancel,
  };
}
