import type { MouseEvent } from "react";

/** Native dialog backdrop clicks target the dialog, but fall outside its bounds. */
export function closeOnDialogBackdrop(event: MouseEvent<HTMLDialogElement>, close: () => void) {
  if (event.target !== event.currentTarget) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
    event.stopPropagation();
    close();
  }
}
