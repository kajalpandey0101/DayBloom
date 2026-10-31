const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

function isJsonResponse(response: Response): boolean {
  return /(^|\/|\+)json(?:;|$)/i.test(response.headers.get("Content-Type") ?? "");
}

async function readJson(response: Response): Promise<unknown> {
  if (!isJsonResponse(response)) {
    throw new ApiError(
      `The server returned a non-JSON response (HTTP ${response.status}). Check the API URL and ensure the Django backend is running.`,
      response.status,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError(`The server returned invalid JSON (HTTP ${response.status}).`, response.status);
  }
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/csrf/`, { credentials: "include" });
  if (!response.ok) {
    throw new ApiError(`Could not load the security token (HTTP ${response.status}).`, response.status);
  }
  await readJson(response);
  const token = readCookie("csrftoken");
  if (!token) {
    throw new Error("The security token could not be loaded. Please refresh and try again.");
  }
  return decodeURIComponent(token);
}

function errorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  if (payload && typeof payload === "object") {
    return Object.entries(payload)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(" ") : String(value)}`)
      .join(" ");
  }
  return "The request could not be completed.";
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    headers.set("X-CSRFToken", await csrfToken());
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });
  if (response.status === 204) return undefined as T;

  const payload = await readJson(response);
  if (!response.ok) {
    throw new ApiError(errorMessage(payload), response.status);
  }
  return payload as T;
}

export function apiPathDate(date: string): string {
  return encodeURIComponent(date);
}
