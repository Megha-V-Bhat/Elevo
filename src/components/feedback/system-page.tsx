import Link from "@/components/ui/link";
import { Logo } from "@/components/brand/logo";
import { Illustration, type IllustrationName } from "@/components/illustrations";

export function SystemPage({ art, code, title, body, action }: { art: IllustrationName; code?: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <main id="main" className="dot-grid grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-lg text-center">
        <Link href="/" aria-label="Elevo home" className="inline-block">
          <Logo />
        </Link>
        <Illustration name={art} className="mx-auto mt-6 h-48" />
        {code && <p className="label-caps mt-4">{code}</p>}
        <h1 className="mt-2 font-display text-display-m font-bold text-ink-900 md:text-display-l">{title}</h1>
        <p className="mx-auto mt-2 max-w-[44ch] text-body text-ink-500">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {action ?? (
            <Link href="/" className="inline-flex min-h-11 items-center rounded-control bg-pine-600 px-5 font-semibold text-white hover:bg-pine-700">
              Go to Elevo
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
