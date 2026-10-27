import "server-only";
import { headers } from "next/headers";
import { adminDb } from "./client";

/**
 * System-level rate limiting (auth, uploads, Ask). Uses the service role because
 * the limiter table is deliberately invisible to users; no user data is read.
 * Fails open if the service key isn't configured (local dev).
 */
export async function rateLimit(scope: string, id: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const { data, error } = await adminDb().rpc("rate_limit_hit", {
    p_key: `${scope}:${ip}:${id}`.slice(0, 200),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[elevo] rate limit check failed", error.message);
    return true;
  }
  return Boolean(data);
}
