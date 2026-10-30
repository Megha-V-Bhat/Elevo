"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { browserDb } from "@/lib/supabase-browser";

const DEST: Record<string, string> = { invite: "/accept-invite", recovery: "/reset-password", magiclink: "/", signup: "/" };

export function HashSession() {
  const router = useRouter();
  const sp = useSearchParams();
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const next = sp.get("next");
    const fail = () => router.replace("/login?error=link");
    if (h.get("error") || h.get("error_code")) return fail();
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");
    if (!access_token || !refresh_token) return fail();
    const dest = next && /^\/(?!\/)/.test(next) ? next : (DEST[h.get("type") ?? ""] ?? "/");
    void browserDb()
      .auth.setSession({ access_token, refresh_token })
      .then((r: { error: unknown }) => (r.error ? fail() : router.replace(dest)));
  }, [router, sp]);
  return (
    <p role="status" className="text-body text-ink-500">
      Signing you in…
    </p>
  );
}
