import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Illustration } from "@/components/illustrations";

/** Shared frame for login / reset / invite: dot-grid canvas, scene beside the card on desktop, above it on mobile. */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main id="main" className="dot-grid min-h-dvh">
      <div className="mx-auto grid min-h-dvh max-w-[1120px] items-center gap-8 px-4 py-8 md:grid-cols-[1.05fr_1fr] md:gap-12 md:px-8">
        <section className="order-1 hidden md:block">
          <Link href="/" aria-label="Elevo home">
            <Logo size="lg" />
          </Link>
          <h2 className="mt-8 max-w-[14ch] font-display text-display-l font-bold text-ink-900">
            Mentoring that <span className="text-pine-600">grows</span> with you.
          </h2>
          <Illustration name="login" className="mt-6 h-auto w-full max-w-[460px]" />
        </section>
        <section className="order-2 mx-auto w-full max-w-[440px]">
          <div className="mb-6 flex flex-col items-center md:hidden">
            <Link href="/" aria-label="Elevo home">
              <Logo />
            </Link>
            <Illustration name="login" className="mt-4 h-36" />
          </div>
          <div className="rounded-card border border-line bg-surface p-6 shadow-2 md:p-8">
            <h1 className="font-display text-display-m font-bold text-ink-900">{title}</h1>
            <p className="mt-1 mb-6 text-body text-ink-500">{subtitle}</p>
            {children}
          </div>
          <p className="mt-6 text-center text-small text-ink-500">Elevo is invite-only. Your HOD creates your account.</p>
        </section>
      </div>
    </main>
  );
}
