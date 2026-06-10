import type { AuthUser } from "@/lib/api";

const AUTH_KEY = "link2build_vendor_auth";

export interface VendorSession {
  mobile: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  loggedInAt: string;
}

export function setVendorSession(session: Omit<VendorSession, "loggedInAt">): void {
  const payload: VendorSession = {
    ...session,
    loggedInAt: new Date().toISOString(),
  };
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

export function getVendorSession(): VendorSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VendorSession;
  } catch {
    return null;
  }
}

export function clearVendorSession(): void {
  sessionStorage.removeItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
  return getVendorSession() !== null;
}

export function getAccessToken(): string | null {
  return getVendorSession()?.accessToken ?? null;
}

const SESSION_EXPIRED_KEY = "link2build_session_expired_msg";

export function markSessionExpired(
  message = "Session expired. Please sign in again."
): void {
  sessionStorage.setItem(SESSION_EXPIRED_KEY, message);
  clearVendorSession();
}

export function consumeSessionExpiredMessage(): string | null {
  const message = sessionStorage.getItem(SESSION_EXPIRED_KEY);
  if (message) {
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  }
  return message;
}
