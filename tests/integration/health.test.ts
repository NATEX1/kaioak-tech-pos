import { describe, expect, it } from "vitest";

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
