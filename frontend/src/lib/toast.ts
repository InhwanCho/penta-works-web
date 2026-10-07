export type ToastMessage = { message: string; tone: "success" | "error" };
export const TOAST_EVENT = "mreyes:toast";

export function showToast(message: string, tone: ToastMessage["tone"] = "success") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ToastMessage>(TOAST_EVENT, { detail: { message, tone } }));
  }
}
