import { describe, expect, it, vi } from "vitest";

// `connection()` from next/server is a Next.js request-scope API that throws
// when called outside the Next.js runtime (e.g. in vitest). Mock it before
// importing the route handler so the handler can run in the test environment.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn().mockResolvedValue(undefined),
  };
});

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns status ok and database connected", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
    expect(typeof body.latencyMs).toBe("number");
    expect(typeof body.uptime).toBe("number");
    expect(body.timestamp).toBeDefined();
  });
});
