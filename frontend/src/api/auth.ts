export type Role = "admin" | "viewer";

export type CurrentUser = {
  username: string;
  role: Role;
  mustChangePassword: boolean;
  sessionExpiresAt?: string;
};

export type AdminUser = {
  id: number;
  username: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  activeSessions: number;
};

export type AuditEntry = {
  at: string;
  actor: string | null;
  action: string;
  detail: string | null;
  ip: string | null;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** CSRF-токен шлюз кладёт в читаемую куку; чужой сайт её прочитать не может. */
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)infofield_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRF-Token", csrfToken());
    if (init.body) headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    method,
    headers,
    // Сессия живёт в куке, поэтому здесь credentials нужны — в отличие от
    // публичных запросов, куда мы их намеренно не отправляем.
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
  });

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : `Ошибка ${response.status}`;
    throw new ApiError(response.status, detail);
  }

  return payload as T;
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  try {
    const data = await request<CurrentUser & { authenticated: boolean }>("/api/auth/me");
    return data.authenticated ? data : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function login(username: string, password: string): Promise<CurrentUser> {
  return request<CurrentUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request<void>("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function listUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>("/api/admin/users");
}

export function createUser(username: string, password: string, role: Role): Promise<void> {
  return request<void>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ username, password, role }),
  });
}

export function setUserActive(id: number, active: boolean): Promise<void> {
  return request<void>(`/api/admin/users/${id}/${active ? "activate" : "deactivate"}`, { method: "POST" });
}

export function fetchAudit(): Promise<AuditEntry[]> {
  return request<AuditEntry[]>("/api/admin/audit?limit=60");
}

export function refreshData(): Promise<void> {
  return request<void>("/api/refresh", { method: "POST" });
}
