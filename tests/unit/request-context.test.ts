import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRequestContext,
  isTrustedProxyIp,
  normalizeIp,
  resolveClientIp,
} from "@/server/auth/request-context";

afterEach(() => {
  vi.unstubAllEnvs();
});

function requestWith(headers: Record<string, string>) {
  return new Request("https://compos.example/login", { headers });
}

describe("normalizeIp", () => {
  it("trims whitespace and lowercases the value", () => {
    expect(normalizeIp("  10.0.0.1  ")).toBe("10.0.0.1");
    expect(normalizeIp("FE80::1")).toBe("fe80::1");
  });

  it("strips the port from a forwarding header entry", () => {
    expect(normalizeIp("203.0.113.5:51234")).toBe("203.0.113.5");
    expect(normalizeIp("[::1]:443")).toBe("::1");
  });

  it("maps IPv4-mapped IPv6 addresses back to IPv4", () => {
    expect(normalizeIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
  });

  it("returns null for empty input", () => {
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });
});

describe("isTrustedProxyIp", () => {
  it("trusts every address when no CIDRs are configured (dev/default mode)", () => {
    expect(isTrustedProxyIp("1.2.3.4", [])).toBe(true);
    expect(isTrustedProxyIp("192.168.1.100", [])).toBe(true);
  });

  it("matches exact IPv4 addresses", () => {
    const cidrs = ["127.0.0.1"];
    expect(isTrustedProxyIp("127.0.0.1", cidrs)).toBe(true);
    expect(isTrustedProxyIp("127.0.0.2", cidrs)).toBe(false);
  });

  it("matches an IPv4 /24 CIDR block", () => {
    const cidrs = ["192.168.1.0/24"];
    expect(isTrustedProxyIp("192.168.1.1", cidrs)).toBe(true);
    expect(isTrustedProxyIp("192.168.1.254", cidrs)).toBe(true);
    expect(isTrustedProxyIp("192.168.2.1", cidrs)).toBe(false);
  });

  it("matches the Docker internal network /12 CIDR (172.16.0.0/12)", () => {
    const cidrs = ["172.16.0.0/12"];
    expect(isTrustedProxyIp("172.16.0.1", cidrs)).toBe(true);
    expect(isTrustedProxyIp("172.31.255.254", cidrs)).toBe(true);
    expect(isTrustedProxyIp("172.32.0.1", cidrs)).toBe(false);
    expect(isTrustedProxyIp("10.0.0.1", cidrs)).toBe(false);
  });

  it("matches /32 (single host in CIDR notation)", () => {
    const cidrs = ["203.0.113.5/32"];
    expect(isTrustedProxyIp("203.0.113.5", cidrs)).toBe(true);
    expect(isTrustedProxyIp("203.0.113.6", cidrs)).toBe(false);
  });

  it("matches /0 CIDR (trust all — valid but not recommended)", () => {
    const cidrs = ["0.0.0.0/0"];
    expect(isTrustedProxyIp("8.8.8.8", cidrs)).toBe(true);
    expect(isTrustedProxyIp("192.168.0.1", cidrs)).toBe(true);
  });

  it("matches IPv6 entries exactly, including bracketed values", () => {
    const cidrs = ["::1"];
    expect(isTrustedProxyIp("::1", cidrs)).toBe(true);
    expect(isTrustedProxyIp("[::1]:3000", cidrs)).toBe(true);
    expect(isTrustedProxyIp("::2", cidrs)).toBe(false);
  });

  it("matches any of multiple entries and rejects unknown addresses", () => {
    const cidrs = ["127.0.0.1", "::1", "10.0.0.0/8"];
    expect(isTrustedProxyIp("127.0.0.1", cidrs)).toBe(true);
    expect(isTrustedProxyIp("10.10.10.10", cidrs)).toBe(true);
    expect(isTrustedProxyIp("8.8.8.8", cidrs)).toBe(false);
  });
});

describe("resolveClientIp", () => {
  it("uses the leftmost entry when no proxies are configured", () => {
    expect(resolveClientIp(["198.51.100.7", "10.0.0.5"], [])).toBe(
      "198.51.100.7",
    );
  });

  it("ignores a spoofed address prepended to the chain", () => {
    // The client sent "127.0.0.1"; Nginx appended the real peer.
    expect(
      resolveClientIp(["127.0.0.1", "203.0.113.9"], ["10.0.0.0/8"]),
    ).toBe("203.0.113.9");
  });

  it("skips trusted proxy hops from the right", () => {
    expect(
      resolveClientIp(
        ["198.51.100.7", "10.0.0.5", "172.16.0.2"],
        ["10.0.0.0/8", "172.16.0.0/12"],
      ),
    ).toBe("198.51.100.7");
  });

  it("falls back to the leftmost entry when every hop is trusted", () => {
    expect(resolveClientIp(["10.1.1.1", "10.2.2.2"], ["10.0.0.0/8"])).toBe(
      "10.1.1.1",
    );
  });

  it("normalizes entries before matching and returns unknown for empty chains", () => {
    expect(resolveClientIp([" 203.0.113.5:4444 "], ["10.0.0.0/8"])).toBe(
      "203.0.113.5",
    );
    expect(resolveClientIp([], [])).toBe("unknown");
  });
});

describe("getRequestContext", () => {
  it("trusts the forwarded headers when TRUSTED_PROXY_CIDRS is unset", () => {
    vi.stubEnv("TRUSTED_PROXY_CIDRS", "");

    const context = getRequestContext(
      requestWith({
        "x-forwarded-for": "198.51.100.7, 10.0.0.5",
        "user-agent": "Vitest",
      }),
    );

    expect(context.ipAddress).toBe("198.51.100.7");
    expect(context.userAgent).toBe("Vitest");
  });

  it("does not let a client pick a trusted address by prepending one", () => {
    vi.stubEnv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8");

    const context = getRequestContext(
      requestWith({
        "x-forwarded-for": "127.0.0.1, 198.51.100.7",
        "x-real-ip": "10.0.0.5",
      }),
    );

    expect(context.ipAddress).toBe("198.51.100.7");
  });

  it("skips a trusted hop appended by an internal proxy", () => {
    vi.stubEnv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8");

    const context = getRequestContext(
      requestWith({ "x-forwarded-for": "198.51.100.7, 10.0.0.5" }),
    );

    expect(context.ipAddress).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip when no forwarded chain is present", () => {
    vi.stubEnv("TRUSTED_PROXY_CIDRS", "");

    const context = getRequestContext(
      requestWith({ "x-real-ip": "203.0.113.5:443" }),
    );

    expect(context.ipAddress).toBe("203.0.113.5");
    expect(context.userAgent).toBeNull();
  });

  it("returns unknown when no address headers are present", () => {
    vi.stubEnv("TRUSTED_PROXY_CIDRS", "");

    expect(getRequestContext(requestWith({})).ipAddress).toBe("unknown");
  });

  it("truncates oversized headers", () => {
    vi.stubEnv("TRUSTED_PROXY_CIDRS", "");

    const context = getRequestContext(
      requestWith({
        "x-forwarded-for": `${"1".repeat(200)}`,
        "user-agent": "u".repeat(2000),
      }),
    );

    expect(context.ipAddress).toHaveLength(64);
    expect(context.userAgent).toHaveLength(1024);
  });
});
