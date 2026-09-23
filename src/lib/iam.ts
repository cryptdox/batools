// Client for the Identity and Access Management backend (login / refresh /
// logout). The IAM resolves which client + realm a login belongs to from the
// x-cr-access-code header, so VITE_IAM_CR_ACCESS_CODE is what actually ties
// this app to the "batools" client; VITE_IAM_CLIENT_ID is kept for reference.
const IAM_API_BASE_URL = (import.meta.env.VITE_IAM_API_BASE_URL as string | undefined) ?? 'https://crypt-iam-latest.onrender.com/api';
const IAM_CR_ACCESS_CODE = import.meta.env.VITE_IAM_CR_ACCESS_CODE as string | undefined;
export const IAM_CLIENT_ID = import.meta.env.VITE_IAM_CLIENT_ID as string | undefined;

const CR_ACCESS_CODE_HEADER = 'x-cr-access-code';
const STORAGE_KEY = 'batools-iam-session';

export type IamUser = {
  userId: string;
  email: string;
  name?: string;
  isEmailVerified: boolean;
  isMasterRealmUser?: boolean;
};

export type IamSession = {
  accessToken: string;
  refreshToken: string;
  user: IamUser;
};

type ApiResponse<T> = {
  success: boolean;
  status: number;
  message: string;
  data?: T;
};

export class IamError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${IAM_API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new IamError('Cannot reach the authentication server.', 0);
  }
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !body?.success) {
    throw new IamError(body?.message ?? `Request failed (${res.status})`, res.status);
  }
  return body.data as T;
}

// ---------------- session storage ----------------

export function loadSession(): IamSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IamSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: IamSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Seconds-since-epoch `exp` claim of a JWT, or null if it can't be read. */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

// ---------------- API calls ----------------

export async function iamLogin(email: string, password: string, captchaToken: string): Promise<IamSession> {
  if (!IAM_CR_ACCESS_CODE) {
    throw new IamError('VITE_IAM_CR_ACCESS_CODE is not configured in .env.', 0);
  }
  const data = await request<IamSession>('/auth/login', {
    method: 'POST',
    headers: { [CR_ACCESS_CODE_HEADER]: IAM_CR_ACCESS_CODE },
    body: JSON.stringify({ email, password, captchaToken }),
  });
  saveSession(data);
  return data;
}

// Refresh tokens are single-use (the backend rotates them), so concurrent
// callers must share one in-flight refresh instead of each spending the token.
let refreshInFlight: Promise<IamSession> | null = null;

export function iamRefresh(): Promise<IamSession> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const current = loadSession();
    if (!current?.refreshToken) throw new IamError('No refresh token', 401);
    const tokens = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    const next: IamSession = { ...current, ...tokens };
    saveSession(next);
    return next;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function iamLogout(accessToken: string) {
  await request<null>('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
