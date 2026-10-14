const STORAGE_KEY = "stem_dev_user";

export function getDevUser(): string | null {
  if (typeof window === "undefined") return null;
  const fromQuery = new URLSearchParams(window.location.search).get("as");
  try {
    if (fromQuery) sessionStorage.setItem(STORAGE_KEY, fromQuery);
    return fromQuery ?? sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return fromQuery;
  }
}

export function switchDevUser(value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("as", value);
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {}
  window.location.assign(url.toString());
}
