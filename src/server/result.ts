import "server-only";
import { ZodError } from "zod";

export type ActionError = { code: string; message: string; fieldErrors?: Record<string, string> };
export type Result<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export class AppError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL",
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

type PgLike = { code?: string; message?: string; details?: string };

/** Translate a Postgres/PostgREST error into a safe, human message. */
export function fromPg(e: PgLike | null | undefined, fallback = "Something went wrong. Please try again."): AppError {
  if (!e) return new AppError("INTERNAL", fallback);
  if (e.code === "42501") return new AppError("FORBIDDEN", e.message || "You don't have permission to do that.");
  if (e.code === "P0001") return new AppError("CONFLICT", e.message ?? fallback);
  if (e.code === "23505") return new AppError("CONFLICT", "That already exists.");
  if (e.code === "23514") return new AppError("VALIDATION", "Some values are out of range. Check marks don't exceed the maximum.");
  if (e.code === "PGRST116") return new AppError("NOT_FOUND", "We couldn't find that.");
  return new AppError("INTERNAL", fallback);
}

/** One wrapper for every server action and route handler: maps errors to safe messages, logs details server-side. */
export async function handle<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: { code: e.code, message: e.message, fieldErrors: e.fieldErrors } };
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of e.issues) fieldErrors[i.path.join(".") || "_"] ??= i.message;
      return { ok: false, error: { code: "VALIDATION", message: "Please check the highlighted fields.", fieldErrors } };
    }
    // Next.js redirect()/notFound() must propagate
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[elevo] unhandled", e);
    return { ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." } };
  }
}

/** Throw on a Supabase error, otherwise return data. */
export function must<T>(r: { data: T | null; error: PgLike | null }, fallback?: string): T {
  if (r.error) throw fromPg(r.error, fallback);
  return r.data as T;
}
