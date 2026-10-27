const FALLBACK_PATH = "/";

/**
 * Allows only same-site absolute paths. This prevents open redirects through
 * the `next` query parameter while preserving search strings and hash fragments.
 */
export function safeInternalPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = FALLBACK_PATH,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const path = value.trim();

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\r\n]/.test(path)
  ) {
    return fallback;
  }

  try {
    const url = new URL(path, "http://compos.local");

    if (url.origin !== "http://compos.local" || url.pathname === "/login") {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
