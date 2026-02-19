/** Base URL for all API calls. Empty string = same-origin (browser mode). */
let base = "";

/** Set the API base URL (e.g. "http://192.168.1.100:9900") */
export function setApiBase(url: string) {
  // Strip trailing slash
  base = url.replace(/\/$/, "");
}

/** Get the current API base URL */
export function getApiBase(): string {
  return base;
}

/** Build a full API URL from a path like "/api/config" */
export function apiUrl(path: string): string {
  return `${base}${path}`;
}
