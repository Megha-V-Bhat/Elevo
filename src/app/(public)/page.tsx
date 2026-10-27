import { ArrowRight, BookOpenCheck, FileLock2, GraduationCap, HeartPulse, LayoutGrid, Lock, MessageCircleQuestion, Sparkles, Target, UserRoundCheck, Users } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { GrowthRings, PulseStrip } from "@/components/charts";
import { Illustration } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { IconTile, StatusPill } from "@/components/ui/display";

// Illustrative values for the marketing composition only — never real student data.
const DEMO_RINGS = [
  { no: 1, sgpa: 7.4, credits: 20 },
  { no: 2, sgpa: 7.9, credits: 22 },
  { no: 3, sgpa: 8.3, credits: 22 },
  { no: 4, sgpa: 8.7, credits: 24 },
];
const DEMO_PULSE = [3, 4, 4, 2, 3, 4, 5, 4, null, 4, 5, 4].map((m, i) => ({
  week_start: `W${i + 1}`,
  mood: m,
  workload: i === 3 ? "HEAVY" : "OKAY",
}));

const ROLES = [
  {
    icon: GraduationCap,
    tone: "mint" as const,
    title: "For students",
    points: ["Every semester's marks, SGPA and CGPA in one place", "A 30-second weekly check-in", "Ask your mentor privately, any time", "Plan what you need to reach your goal"],
  },
  {
    icon: UserRoundCheck,
    tone: "lilac" as const,
    title: "For mentors",
    points: ["Only your mentees, with clear evidence", "Early signals before results drop", "One inbox for questions", "Professional PDF reports in a click"],
  },
  {
    icon: LayoutGrid,
    tone: "butter" as const,
    title: "For HODs",
    points: ["Assign and rebalance mentors on a board", "Coverage, workload and interventions", "Bulk import with previews", "A full audit trail"],
  },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/86 backdrop-blur-[14px]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 md:px-8">
          <Logo />
          <Button asChild size="sm" className="h-10 px-4">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main id="main">
        <section className="dot-grid relative overflow-hidden">
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 pt-12 pb-16 md:grid-cols-[1.1fr_1fr] md:px-8 md:pt-20 md:pb-24">
            <div className="animate-rise">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-small font-semibold text-pine-700 shadow-1">
                <Sparkles className="size-4" aria-hidden /> Academic mentoring for colleges
              </span>
              <h1 className="mt-5 font-display text-[2.75rem] leading-[3rem] font-extrabold text-ink-900 md:text-display-xl md:leading-display-xl">
                Mentoring that{" "}
                <span className="relative inline-block text-pine-600">
                  grows
                  <svg aria-hidden viewBox="0 0 200 18" className="absolute -bottom-2 left-0 h-3 w-full" preserveAspectRatio="none">
                    <path d="M3 12 C 50 4, 110 3, 197 9" stroke="#34D399" strokeWidth="6" fill="none" strokeLinecap="round" pathLength={1} className="anim-draw" />
                  </svg>
                </span>{" "}
                with you.
              </h1>
              <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-7 text-ink-700">
                Elevo brings academic records, mentor guidance and weekly wellbeing into one calm place, so every student gets noticed early and supported well.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/login">
                    Sign in <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href="#how">See how it works</a>
                </Button>
              </div>
            </div>

            {/* Floating bento composition of real UI pieces */}
            <div className="relative mx-auto w-full max-w-[520px]" aria-hidden>
              <Illustration name="hero" className="h-auto w-full opacity-95" />
              <div className="absolute top-2 -left-2 w-[190px] rounded-card border border-line bg-surface p-3 shadow-dock md:-left-8">
                <GrowthRings semesters={DEMO_RINGS} cgpa={8.12} size={164} />
              </div>
              <div className="absolute right-0 bottom-6 w-[250px] rounded-card border border-line bg-surface p-3.5 shadow-dock md:-right-6">
                <p className="label-caps mb-2">Weekly pulse</p>
                <PulseStrip weeks={DEMO_PULSE} compact />
              </div>
              <div className="absolute top-0 right-2 hidden w-[220px] rounded-card border border-line bg-surface p-3.5 shadow-dock sm:block md:-right-4">
                <div className="flex items-center justify-between">
                  <span className="text-small font-semibold text-ink-900">How do I revise joins?</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-small text-ink-500">DBMS · 2h ago</span>
                  <StatusPill status="ANSWERED" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-[1200px] px-4 py-16 md:px-8 md:py-24">
          <h2 className="max-w-[20ch] font-display text-[2rem] leading-10 font-bold text-ink-900 md:text-display-l">One shared journey, three clear roles.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {ROLES.map((r) => (
              <article key={r.title} className="rounded-card border border-line bg-surface p-6 shadow-1">
                <IconTile icon={r.icon} tone={r.tone} />
                <h3 className="mt-4 font-display text-h3 font-semibold text-ink-900">{r.title}</h3>
                <ul className="mt-3 grid gap-2">
                  {r.points.map((p) => (
                    <li key={p} className="flex gap-2 text-body text-ink-700">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-mint-400" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {[
              { icon: HeartPulse, tone: "mint" as const, t: "Weekly Pulse", d: "Three quick questions. Mentors see a gentle signal before marks slip." },
              { icon: MessageCircleQuestion, tone: "lilac" as const, t: "Ask My Mentor", d: "Private, calm question threads, tagged by subject, with attachments." },
              { icon: Target, tone: "butter" as const, t: "Grade Goal Planner", d: "“You need 58/100 in SEE for an A.” Clear next steps, compared only with your own goals." },
            ].map((f) => (
              <div key={f.t} className="flex gap-4 rounded-card bg-surface/60 p-2">
                <IconTile icon={f.icon} tone={f.tone} />
                <div>
                  <h3 className="font-display text-h3 font-semibold text-ink-900">{f.t}</h3>
                  <p className="mt-1 text-body text-ink-700">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-pine-800 text-white">
          <div className="dot-grid-light">
            <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-8 md:py-20">
              <h2 className="font-display text-[2rem] leading-10 font-bold text-white md:text-display-l">Private by design.</h2>
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                {[
                  { icon: Lock, t: "Mentors see only their mentees", d: "Enforced in the database. Reassign a student and access moves instantly." },
                  { icon: Users, t: "Students are never ranked", d: "Every comparison is with your own past or your own target. No leaderboards." },
                  { icon: FileLock2, t: "PDFs carry verified records only", d: "No charts, insights, check-ins or questions ever leave the website." },
                ].map((p) => (
                  <div key={p.t} className="rounded-card border border-white/15 bg-white/[0.06] p-6">
                    <p.icon className="size-6 text-mint-300" strokeWidth={1.75} aria-hidden />
                    <h3 className="mt-4 font-display text-h3 font-semibold text-white">{p.t}</h3>
                    <p className="mt-1 text-body text-white/85">{p.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-[1200px] flex-col items-center px-4 py-16 text-center md:px-8">
          <BookOpenCheck className="size-8 text-pine-600" strokeWidth={1.75} aria-hidden />
          <h2 className="mt-3 font-display text-display-m font-bold text-ink-900">Your HOD has invited you?</h2>
          <p className="mt-2 max-w-[48ch] text-body text-ink-500">Open the link in your email to set a password, or sign in if you already have one.</p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/login">Sign in to Elevo</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-3 px-4 py-8 text-small text-ink-500 md:flex-row md:px-8">
          <Logo size="sm" />
          <p>Elevo · Mentoring that grows with you.</p>
        </div>
      </footer>
    </div>
  );
}
