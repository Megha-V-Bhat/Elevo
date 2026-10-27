import { Logo } from "@/components/brand/logo";
import { Illustration } from "@/components/illustrations";

/** Shown in development until .env.local has the Supabase keys (Part 2.6). */
export function SetupNotice() {
  return (
    <main id="main" className="dot-grid grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-lg rounded-card border border-line bg-surface p-8 text-center shadow-2">
        <Logo className="mx-auto" />
        <Illustration name="locked" className="mx-auto mt-6 h-32" />
        <h1 className="mt-4 font-display text-display-m font-bold text-ink-900">Connect Elevo to its database</h1>
        <p className="mt-2 text-body text-ink-500">
          Add <code className="rounded bg-canvas-sunk px-1.5 py-0.5 text-small">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-canvas-sunk px-1.5 py-0.5 text-small">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
          <code className="rounded bg-canvas-sunk px-1.5 py-0.5 text-small">.env.local</code>, then restart the dev server. See README → Setup.
        </p>
      </div>
    </main>
  );
}
