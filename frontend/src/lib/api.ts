import { useAuthStore } from "./auth";

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }

  // Detect browser hostname for cloud deployment (e.g. Vercel)
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      return "https://insightforge-backend-2be1.onrender.com";
    }
  } else if (process.env.NODE_ENV === "production") {
    return "https://insightforge-backend-2be1.onrender.com";
  }

  return "http://localhost:8000";
}

const API_PREFIX = "/api/v1";

export interface ApiErrorBody {
  detail?: string | any;
  error?: { code: string; message: string; details?: unknown; request_id?: string | null };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string | null,
  ) {
    super(message);
  }
}

// Single-flight promise so concurrent 401/403 calls do not spam login requests
let refreshPromise: Promise<string | null> | null = null;

export async function refreshDemoAuth(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}${API_PREFIX}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: "demo@insightforge.ai",
          password: "password123",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          useAuthStore.getState().setAuth(data.access_token, {
            id: "7a99714b32364f8fb36135428ab46443",
            email: "demo@insightforge.ai",
            full_name: "Executive Demo User",
          });
          return data.access_token as string;
        }
      }
    } catch (e) {
      console.warn("Failed to auto-refresh demo authentication:", e);
    } finally {
      refreshPromise = null;
    }
    return null;
  })();
  return refreshPromise;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const currentStoreToken = typeof window !== "undefined" ? useAuthStore.getState().token : null;

  // Resolve headers, auto-injecting valid auth token if missing or stale
  const headers = new Headers(init?.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const authHeader = headers.get("Authorization");
  if (!authHeader || authHeader === "Bearer null" || authHeader === "Bearer undefined" || authHeader === "Bearer ") {
    if (currentStoreToken) {
      headers.set("Authorization", `Bearer ${currentStoreToken}`);
    }
  }

  const apiBase = getApiBaseUrl();
  const url = `${apiBase}${API_PREFIX}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (initialErr) {
    // If network fetch failed, retry once with a short delay (vital for Render cold-start wake-up)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      res = await fetch(url, {
        ...init,
        headers,
        cache: "no-store",
      });
    } catch {
      throw new ApiError(
        0,
        "network_error",
        "Cannot reach the API server. If deployed to cloud, the backend may be spinning up from idle sleep (free Render tier takes ~30-50s). Please wait a moment and try again."
      );
    }
  }

  // If token is invalid or expired (401 or 403), auto-refresh demo token and retry once transparently
  if (res.status === 401 || res.status === 403) {
    const isLoginEndpoint = path.includes("/auth/login") || path.includes("/auth/register");
    if (!isLoginEndpoint) {
      const freshToken = await refreshDemoAuth();
      if (freshToken) {
        headers.set("Authorization", `Bearer ${freshToken}`);
        try {
          const retryRes = await fetch(url, {
            ...init,
            headers,
            cache: "no-store",
          });
          if (retryRes.ok) {
            return (await retryRes.json()) as T;
          }
          res = retryRes;
        } catch {
          // fall through to error handling
        }
      }
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const errorMessage =
      body?.error?.message ??
      (typeof body?.detail === "string" ? body.detail : null) ??
      res.statusText;
    const errorCode = body?.error?.code ?? (res.status === 401 || res.status === 403 ? "unauthorized" : "unknown");

    throw new ApiError(
      res.status,
      errorCode,
      errorMessage,
      body?.error?.request_id,
    );
  }

  return (await res.json()) as T;
}
