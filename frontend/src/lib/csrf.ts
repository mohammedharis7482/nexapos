/**
 * In-memory CSRF token store.
 *
 * The token is issued by GET /auth/csrf/ in the JSON response body and
 * held only in module state - it is never read from or written to
 * document.cookie. This deployment serves the frontend and API from
 * different registrable domains, and a browser's third-party cookie
 * policy can silently drop a cross-site cookie even when it's set with
 * SameSite=None; Secure, with no way for JS to detect or recover from
 * that short of not depending on the cookie being readable at all.
 */
let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}
