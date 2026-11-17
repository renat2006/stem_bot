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

export function getSurfaceQuery(): "admin" | "projector" | "player" {
  if (typeof window === "undefined") return "player";
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "projector") return "projector";
  if (params.get("surface") === "admin") return "admin";
  return "player";
}

export function switchDevUser(value: string, surface?: "admin" | "player") {
  const url = new URL(window.location.href);
  url.searchParams.set("as", value);
  if (surface === "admin") url.searchParams.set("surface", "admin");
  else if (surface === "player") url.searchParams.delete("surface");
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {}
  window.location.assign(url.toString());
}
