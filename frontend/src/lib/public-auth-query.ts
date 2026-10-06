import { type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// Token-based public pages remain usable when an unrelated login session expires.
export function clearPrivateQueries(client: QueryClient) {
  client.removeQueries({ predicate: query => !["invitation", "password-reset"].includes(String(query.queryKey[0])) });
}

export async function loadPublicAuth<T>(path: string, signal: AbortSignal, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  let timedOut = false;
  if (signal.aborted) cancel();
  else signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await apiFetch<T>(path, { signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (timedOut) throw new Error("연결이 지연되고 있습니다. 네트워크를 확인하고 다시 시도해주세요.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
