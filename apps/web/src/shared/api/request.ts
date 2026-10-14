import { getRawInitData } from "../lib/telegram.js";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const rawInitData = getRawInitData();
  if (rawInitData) headers.set("Authorization", `tma ${rawInitData}`);

  const res = await fetch(path, { ...init, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Ошибка запроса к серверу");
  return data as T;
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}
