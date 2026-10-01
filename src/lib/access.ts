export type AccessDecision = 'member' | 'authMissingEmail' | 'authDomainDenied' | 'authProviderDenied' | 'authSessionMismatch';
/** Microsoft SSO + exact company domain. Firebase mailbox verification is not an access requirement. */
export function accessDecision(email: string | null, claims: Record<string, unknown>): AccessDecision {
  const provider = claims.firebase;
  if (!provider || typeof provider !== 'object' ||
      (provider as {sign_in_provider?: unknown}).sign_in_provider !== 'microsoft.com') return 'authProviderDenied';
  const tokenEmail = claims.email;
  if (typeof email !== 'string' || !email || typeof tokenEmail !== 'string' || !tokenEmail) return 'authMissingEmail';
  const domain = /^[a-z0-9._%+-]+@madison[.]dev$/i;
  if (!domain.test(email) || !domain.test(tokenEmail)) return 'authDomainDenied';
  if (email.toLowerCase() !== tokenEmail.toLowerCase()) return 'authSessionMismatch';
  return 'member';
}
export function authErrorKey(error: unknown): string {
  const code = (error as {code?: string})?.code;
  switch (code) {
    case 'auth/popup-closed-by-user': return 'popupClosed';
    case 'auth/too-many-requests': return 'authRateLimited';
    case 'auth/network-request-failed': return 'authNetworkError';
    case 'auth/user-token-expired': case 'auth/invalid-user-token': case 'auth/user-disabled':
    case 'auth/requires-recent-login': return 'authSessionExpired';
    case 'auth/operation-not-allowed': case 'auth/unauthorized-domain': return 'authConfigurationError';
    default: return 'authError';
  }
}
