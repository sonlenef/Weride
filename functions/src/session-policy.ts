/** Shared by the browser and sharing API; Firestore enforces the same bound with server time. */
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
export const AUTH_CLOCK_SKEW_SECONDS = 5 * 60;
export interface SessionClaims { auth_time?: unknown; }
/** auth_time is issued by Firebase; token refresh / page reload must never extend this window. */
export function sessionExpiresAt(claims: SessionClaims, nowMs = Date.now()): number | null {
  const seconds = claims.auth_time;
  if (typeof seconds !== 'number' || !Number.isSafeInteger(seconds) || seconds <= 0 ||
      !Number.isFinite(nowMs) || seconds * 1000 > nowMs + AUTH_CLOCK_SKEW_SECONDS * 1000) return null;
  const deadline = (seconds + SESSION_MAX_AGE_SECONDS) * 1000;
  return Number.isSafeInteger(deadline) ? deadline : null;
}
export function sessionIsCurrent(claims: SessionClaims, nowMs = Date.now()): boolean {
  const expiresAt = sessionExpiresAt(claims, nowMs);
  return expiresAt !== null && nowMs < expiresAt;
}
