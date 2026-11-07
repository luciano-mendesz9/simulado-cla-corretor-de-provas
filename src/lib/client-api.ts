let refreshPromise: Promise<boolean> | null = null;
async function refresh() {
  if (!refreshPromise) refreshPromise = (async () => {
    const result = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin", headers: { Origin: location.origin } });
    if (result.status === 409) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return (await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })).ok;
    }
    return result.ok;
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
export async function apiFetch(path: string, init?: RequestInit) {
  const options: RequestInit = { ...init, credentials: "same-origin", cache: "no-store", headers: { ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init?.headers } };
  let response = await fetch(path, options);
  if (response.status === 401 && await refresh()) response = await fetch(path, options);
  return response;
}
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data as T;
}
