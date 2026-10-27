export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** False until the human fills .env.local (Part 2.6). Pages render a setup notice instead of crashing. */
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
