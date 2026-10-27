import "server-only";

const MAX_IP_LENGTH = 64;
const MAX_USER_AGENT_LENGTH = 1024;

/**
 * Trusted upstream proxy IPs or CIDRs (comma-separated), read per call so the
 * value can be changed without a module reload (and is testable).
 *
 * Example (Nginx on the same host, plus the Docker internal network):
 *   TRUSTED_PROXY_CIDRS=127.0.0.1,::1,172.16.0.0/12
 *
 * Leave empty (the default) to accept the forwarded chain as-is — acceptable
 * only when the app is never exposed directly to the internet, because a
 * direct client can then send whatever `x-forwarded-for` it likes.
 */
export function getTrustedProxyCidrs(): string[] {
  return (process.env.TRUSTED_PROXY_CIDRS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export type RequestContext = {
  ipAddress: string;
  userAgent: string | null;
};

/**
 * Normalizes the forms an address takes inside forwarding headers:
 * `[::1]:443`, `203.0.113.5:51234`, `::ffff:203.0.113.5`, surrounding spaces.
 * Returns null for empty or unusable values.
 */
export function normalizeIp(raw: string | null | undefined): string | null {
  let value = raw?.trim() ?? "";

  if (!value) {
    return null;
  }

  if (value.startsWith("[")) {
    const closingBracket = value.indexOf("]");

    if (closingBracket === -1) {
      return null;
    }

    value = value.slice(1, closingBracket);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(":"));
  }

  const ipv4Mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);

  if (ipv4Mapped) {
    value = ipv4Mapped[1];
  }

  return value ? value.toLowerCase() : null;
}

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");

  if (parts.length !== 4) {
    return null;
  }

  let result = 0;

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const value = Number(part);

    if (value > 255) {
      return null;
    }

    result = (result << 8) | value;
  }

  return result >>> 0;
}

function ipv4Mask(prefixLength: number): number {
  return prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
}

/**
 * Builds a matcher for one configured entry. IPv4 entries support exact
 * matches and /0–/32 CIDR notation; IPv6 entries (e.g. `::1`) are matched
 * exactly.
 */
function cidrMatcher(cidr: string): (ip: string) => boolean {
  const normalizedCidr = normalizeIp(cidr);

  if (!normalizedCidr) {
    return () => false;
  }

  if (!normalizedCidr.includes("/")) {
    return (ip) => ip === normalizedCidr;
  }

  const [base, rawPrefix] = normalizedCidr.split("/");
  const prefixLength = Number(rawPrefix);

  if (!/^\d{1,2}$/.test(rawPrefix) || prefixLength > 32) {
    // Unknown or non-IPv4 prefix — fall back to an exact match on the base.
    return (ip) => ip === base;
  }

  const baseNumber = ipv4ToNumber(base);

  if (baseNumber === null) {
    return (ip) => ip === base;
  }

  const mask = ipv4Mask(prefixLength);
  const network = (baseNumber & mask) >>> 0;

  return (ip) => {
    const candidate = ipv4ToNumber(ip);

    if (candidate === null) {
      return false;
    }

    return ((candidate & mask) >>> 0) === network;
  };
}

/**
 * Returns true when `ip` matches one of the configured proxies.
 * With no entries configured every address is considered trusted, which keeps
 * development and simple LAN setups working.
 */
export function isTrustedProxyIp(ip: string, trustedCidrs: string[]): boolean {
  if (trustedCidrs.length === 0) {
    return true;
  }

  const normalizedIp = normalizeIp(ip);

  if (!normalizedIp) {
    return false;
  }

  return trustedCidrs.some((cidr) => cidrMatcher(cidr)(normalizedIp));
}

/**
 * Resolves the client address from a forwarding chain.
 *
 * The chain is walked right-to-left: entries that belong to trusted proxies are
 * skipped, and the first untrusted entry is the client. This is what stops a
 * client from choosing its own address by putting a fake value at the front of
 * `x-forwarded-for` (proxies append, so the truthful hop is on the right).
 *
 * With no trusted proxies configured the leftmost entry is returned, matching
 * the previous permissive behavior.
 */
export function resolveClientIp(
  chain: string[],
  trustedCidrs: string[],
): string {
  const entries = chain
    .map((entry) => normalizeIp(entry))
    .filter((entry): entry is string => entry !== null);

  if (entries.length === 0) {
    return "unknown";
  }

  if (trustedCidrs.length === 0) {
    return entries[0];
  }

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (!isTrustedProxyIp(entries[index], trustedCidrs)) {
      return entries[index];
    }
  }

  // Every hop is a trusted proxy: the leftmost entry is closest to the client.
  return entries[0];
}

export function getRequestContext(request: Request): RequestContext {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const chain = forwardedFor ? forwardedFor.split(",") : [];

  if (chain.length === 0) {
    const singleHop =
      request.headers.get("x-real-ip") ??
      request.headers.get("cf-connecting-ip");

    if (singleHop) {
      chain.push(singleHop);
    }
  }

  const ipAddress = resolveClientIp(chain, getTrustedProxyCidrs());

  const userAgent = request.headers.get("user-agent")?.trim();

  return {
    ipAddress: ipAddress.slice(0, MAX_IP_LENGTH),
    userAgent: userAgent ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
  };
}
