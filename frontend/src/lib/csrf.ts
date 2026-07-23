const CSRF_COOKIE_NAME = "csrftoken";

export function readCsrfToken(cookieSource?: string): string | null {
  const source =
    cookieSource ?? (typeof document === "undefined" ? "" : document.cookie);
  const cookie = source
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(CSRF_COOKIE_NAME.length + 1));
}
