import type { Metadata } from "next";
import { Suspense } from "react";
import { HashSession } from "./hash-session";

export const metadata: Metadata = { title: "Signing you in" };

/**
 * Landing page for email links that carry the session in the URL fragment
 * (Supabase's default templates use the implicit flow: #access_token=…).
 * The fragment never reaches the server, so it's read in the browser.
 */
export default function AuthCallback() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <Suspense>
        <HashSession />
      </Suspense>
    </main>
  );
}
