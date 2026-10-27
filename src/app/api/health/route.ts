import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { pruneExpiredRateLimits } from "@/server/auth/rate-limit";

export async function GET() {
  const startTime = Date.now();

  try {
    // Ping database to ensure connection pool and query engine are functional
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    // Opportunistically prune stale rate-limit rows on each health check.
    // This runs fire-and-forget so it never delays the health response.
    pruneExpiredRateLimits().catch((err) =>
      console.warn("pruneExpiredRateLimits failed:", err),
    );

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        latencyMs,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        latencyMs,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
