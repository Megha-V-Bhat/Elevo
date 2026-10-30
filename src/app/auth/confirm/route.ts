import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/supabase";

/** Email links (invite, recovery) land here: verify the token hash, then continue. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const dest = next && /^\/(?!\/)/.test(next) ? next : type === "invite" ? "/accept-invite" : "/reset-password";
  // No token in the query: the link may carry the session in the #fragment (Supabase's default
  // templates). Browsers keep the fragment across redirects, so hand over to the client page.
  if (!tokenHash && !code) {
    const cb = url.clone();
    cb.search = "";
    cb.pathname = "/auth/callback";
    cb.searchParams.set("next", dest);
    return NextResponse.redirect(cb);
  }
  const supabase = await db();
  const ok = tokenHash && type
    ? !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error
    : code
      ? !(await supabase.auth.exchangeCodeForSession(code)).error
      : false;
  const to = url.clone();
  to.search = "";
  to.pathname = ok ? dest : "/login";
  if (!ok) to.searchParams.set("error", "link");
  return NextResponse.redirect(to);
}
