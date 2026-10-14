import { getDevUser } from "../lib/dev-user.js";
import { getRawInitData } from "../lib/telegram.js";

export function authHeaders(): Record<string, string> {
  const rawInitData = getRawInitData();
  if (rawInitData) return { Authorization: `tma ${rawInitData}` };
  const devUser = getDevUser();
  return devUser ? { "X-Dev-User": encodeURIComponent(devUser) } : {};
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  for (const [key, value] of Object.entries(authHeaders())) headers.set(key, value);

  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Ошибка запроса к серверу");
  return data as T;
}

export function postJson<T>(path: string, body: unknown = {}): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
}
