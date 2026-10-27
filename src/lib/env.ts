import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url().default("http://localhost:3000"),
  AUTH_TRUST_HOST: z.enum(["true", "false"]).optional(),
  /**
   * Comma-separated list of trusted upstream proxy IPs or CIDRs.
   * When set, x-forwarded-for is only trusted if the request comes from one
   * of these addresses. Leave empty to trust all headers (dev / LAN setups).
   * Example: "127.0.0.1,::1,172.16.0.0/12"
   */
  TRUSTED_PROXY_CIDRS: z.string().optional(),
});

export type ServerEnv = z.infer<typeof envSchema>;

/**
 * Validate server-only environment variables.
 * Import this from server code, never from a Client Component.
 */
export function getServerEnv(): ServerEnv {
  return envSchema.parse(process.env);
}
