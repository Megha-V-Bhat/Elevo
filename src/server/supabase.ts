import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// PERF_LOG=1 prints one line per Supabase call (path + ms, never headers or bodies) for profiling.
const t0 = Date.now();
const timedFetch: typeof fetch = async (input, init) => {
  const start = Date.now();
  const res = await fetch(input, init);
  const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  console.log(`[perf] +${start - t0}ms ${Date.now() - start}ms ${init?.method ?? "GET"} ${u.pathname}`);
  return res;
};

/** Per-request Supabase client acting as the signed-in user (RLS applies). */
export async function db() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...(process.env.PERF_LOG === "1" ? { global: { fetch: timedFetch } } : {}),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

export type Db = Awaited<ReturnType<typeof db>>;
