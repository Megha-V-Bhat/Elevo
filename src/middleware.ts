import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/mentee", "/mentor", "/hod", "/setup", "/account", "/notifications"];

/**
 * Refreshes the Supabase session cookie and keeps signed-out users out of app
 * routes. Role-based routing happens in server layouts, which read the role from
 * the database on every request.
 */
export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let res = NextResponse.next({ request: req });
  if (!url || !key) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });
  // Verifies the ES256 access token locally (JWKS cached) and refreshes it when expired;
  // no Auth round trip on every request.
  const { data } = await supabase.auth.getClaims();
  const path = req.nextUrl.pathname;
  if (!data?.claims && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const to = req.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|illustrations/|icon.svg|apple-icon|opengraph-image|robots.txt|sitemap.xml|api/cron).*)"],
};
