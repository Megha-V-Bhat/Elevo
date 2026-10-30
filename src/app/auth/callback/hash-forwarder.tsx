"use client";

import { useEffect } from "react";

/**
 * When a redirect URL isn't allow-listed, Supabase falls back to the Site URL and appends the
 * session (or an error) as a #fragment on whatever page that is. Send it to /auth/callback.
 */
export function HashForwarder() {
  useEffect(() => {
    const h = window.location.hash;
    if (window.location.pathname !== "/auth/callback" && /(^#|&)(access_token|error_code)=/.test(h)) window.location.replace(`/auth/callback${h}`);
  }, []);
  return null;
}
