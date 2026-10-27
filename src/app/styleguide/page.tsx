import { BookOpen, ClipboardCheck, HeartPulse, Inbox, Target, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ChartFrame, CoverageDonut, CreditPath, GoalCompass, GroupedBars, GrowthRings, HBars, PairedBars, ProgressRing, PulseStrip, RingLegend, Sparkline, StackedBar, SubjectBloom, TrendLine } from "@/components/charts";
import { ILLUSTRATION_ALT, Illustration, type IllustrationName } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { Avatar, Card, CardHeader, Chip, DeltaChip, Meter, StatusPill } from "@/components/ui/display";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Bento, EmptyState, HeroCard, PageHeader, StatTile } from "@/components/ui/layout";
import { TabStrip } from "@/components/ui/tabs";
import { FlagChips } from "@/features/mentor/flags";
import { MoodFace } from "@/features/pulse/faces";
import { StyleguideShell } from "./shell-demo";

export const metadata: Metadata = { title: "Styleguide", robots: { index: false } };

// Sample props only — this page is for design review and never touches real data.
const rings = [
  { no: 1, sgpa: 7.2, credits: 20 },
  { no: 2, sgpa: 7.8, credits: 22 },
  { no: 3, sgpa: 6.6, credits: 22 },
  { no: 4, sgpa: 8.4, credits: 24 },
  { no: 5, sgpa: 8.9, credits: 24 },
];
const weeks = [4, 3, null, 2, 2, 3, 4, 5, 4, null, 3, 4].map((m, i) => ({ week_start: `2026-08-${String(3 + i * 7).padStart(2, "0")}`, mood: m, workload: i === 4 ? "HEAVY" : "OKAY", has_note: i === 3 }));

const TOKENS = [
  ["canvas", "#FAFBF8"],
  ["surface", "#FFFFFF"],
  ["ink-900", "#10201B"],
  ["ink-500", "#5E6B66"],
  ["pine-600", "#0F766E"],
  ["pine-800", "#0B4F4A"],
  ["teal-500", "#14B8A6"],
  ["mint-400", "#34D399"],
  ["lilac-500", "#8B7CF6"],
  ["butter-400", "#FBBF24"],
  ["coral-600", "#DC4B4B"],
  ["sky-500", "#0EA5E9"],
];

// Measured WCAG contrast for the text pairs the UI uses (see DESIGN.md).
const CONTRAST = [
  ["ink-900 on canvas", "16.2:1"],
  ["ink-700 on surface", "10.4:1"],
  ["ink-500 on canvas", "5.4:1"],
  ["ink-450 on surface (axis, placeholder)", "4.7:1"],
  ["white on pine-600 / Sunrise end", "5.5:1 / 4.9:1"],
  ["pine-700 on mint-100", "6.7:1"],
  ["lilac-700 on lilac-100", "5.3:1"],
  ["butter-800 on butter-100", "6.0:1"],
  ["coral-700 on coral-100", "5.2:1"],
  ["sky-700 on sky-100", "5.2:1"],
  ["white on coral-700 (destructive)", "6.2:1"],
];

export default function Styleguide() {
  if (process.env.NODE_ENV === "production" && process.env.ELEVO_STYLEGUIDE !== "1") notFound();
  return (
    <StyleguideShell>
      <PageHeader title="Meadow Light" subtitle="Elevo's design system: tokens, type, components and signature visuals." eyebrow={<Chip tone="mint">Styleguide · dev only</Chip>} />

      <Bento>
        <Card className="md:col-span-6 lg:col-span-6">
          <CardHeader title="Logo lockups" />
          <div className="grid gap-4">
            <div className="flex items-center gap-6 rounded-panel bg-canvas p-5">
              <Logo size="lg" />
              <Logo variant="mark" size="lg" />
            </div>
            <div className="flex items-center gap-6 rounded-panel bg-pine-600 p-5">
              <Logo variant="white" size="lg" />
            </div>
          </div>
        </Card>
        <Card className="md:col-span-6 lg:col-span-6">
          <CardHeader title="Type scale" />
          <p className="font-display text-display-xl leading-display-xl font-extrabold text-ink-900">Grow 56</p>
          <p className="font-display text-display-l font-bold text-ink-900">Page title 40</p>
          <p className="font-display text-display-m font-bold text-ink-900 tnum">8.42 CGPA</p>
          <p className="mt-2 text-h3 font-semibold text-ink-900">Section heading 20</p>
          <p className="text-body">Body 15/24 — Manrope for everything you read and tap.</p>
          <p className="label-caps mt-2">Label · 12 uppercase</p>
        </Card>
      </Bento>

      <Card className="mt-5">
        <CardHeader title="Colour tokens & measured contrast" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {TOKENS.map(([n, hex]) => (
            <div key={n}>
              <div className="h-14 rounded-panel border border-line" style={{ background: hex }} />
              <p className="mt-1 text-small font-semibold text-ink-900">{n}</p>
              <p className="text-[12px] text-ink-500 tnum">{hex}</p>
            </div>
          ))}
        </div>
        <ul className="mt-5 grid gap-1.5 text-small sm:grid-cols-2">
          {CONTRAST.map(([p, r]) => (
            <li key={p} className="flex justify-between rounded-control bg-canvas-sunk px-3 py-1.5">
              <span className="text-ink-700">{p}</span>
              <span className="font-semibold text-pine-700 tnum">{r} ✓</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Buttons, inputs, chips, pills" />
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tonal">Tonal</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Full name" htmlFor="sg-name" required helper="As it appears on your ID.">
            <Input defaultValue="Ananya Rao" />
          </Field>
          <Field label="USN" htmlFor="sg-usn" error="USN should be 6–15 letters or numbers">
            <Input defaultValue="1X-?" />
          </Field>
          <Field label="Semester" htmlFor="sg-sem">
            <Select defaultValue="5">
              <option>5</option>
            </Select>
          </Field>
          <Field label="Note" htmlFor="sg-note" optional className="sm:col-span-3">
            <Textarea rows={2} placeholder="Placeholder text meets 4.5:1" />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {["DRAFT", "SUBMITTED", "VERIFIED", "FINALIZED", "PENDING", "IN_PROGRESS", "COMPLETED", "OPEN", "ANSWERED", "RESOLVED"].map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip tone="mint">Sem 5</Chip>
          <Chip tone="lilac">Mentor: Dr. Iyer</Chip>
          <Chip tone="butter">2 missing</Chip>
          <DeltaChip value={0.42} label="vs Sem 4" />
          <DeltaChip value={-0.3} label="vs Sem 4" />
          <FlagChips flags={[{ ruleId: "declining", label: "Declining performance", reason: "SGPA 8.1 → 7.4" }]} pulse={[{ ruleId: "p", label: "Low pulse 3 weeks in a row", reason: "Rough, Low, Low", selfReported: true }]} />
        </div>
        <div className="mt-5">
          <TabStrip label="Demo tabs" active="insights" tabs={["Overview", "Academics", "Insights", "Mentoring", "Pulse", "Ask"].map((t) => ({ key: t.toLowerCase(), label: t, href: "#", count: t === "Ask" ? 2 : undefined }))} />
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4">
        <StatTile label="Need attention" value={3} icon={TriangleAlert} tone="coral" helper="With explained reasons" />
        <StatTile label="Unanswered questions" value={2} icon={Inbox} tone="lilac" />
        <StatTile label="Pending verifications" value={5} icon={ClipboardCheck} tone="butter" />
        <StatTile label="Sessions this week" value={4} icon={BookOpen} tone="mint" delta={<DeltaChip value={1} label="vs last" digits={0} />} />
      </div>

      <HeroCard className="mt-5">
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <GrowthRings semesters={rings} cgpa={7.86} size={200} onPine />
          <div>
            <p className="label-caps !text-white">Your growth</p>
            <p className="mt-1 font-display text-display-m font-bold tnum">7.86 CGPA</p>
            <p className="text-white">across 5 semesters · 112 credits</p>
            <div className="mt-4">
              <RingLegend onPine />
            </div>
          </div>
        </div>
      </HeroCard>

      <Bento className="mt-5">
        <Card className="md:col-span-6 lg:col-span-7">
          <ChartFrame bare title="SGPA trend" table={{ columns: ["Sem", "SGPA"], rows: rings.map((r) => [r.no, r.sgpa]) }}>
            <CardHeader title="Trend line" />
            <TrendLine points={rings.map((r) => ({ label: `S${r.no}`, value: r.sgpa }))} />
          </ChartFrame>
        </Card>
        <Card className="md:col-span-6 lg:col-span-5">
          <CardHeader title="Subject bloom" />
          <SubjectBloom petals={[{ label: "DBMS", value: 82 }, { label: "OS", value: 64 }, { label: "CN", value: 71 }, { label: "SE", value: 55 }, { label: "AI", value: 88 }, { label: "Lab", value: null }]} />
        </Card>
        <Card className="md:col-span-6 lg:col-span-7">
          <CardHeader title="MSE vs SEE" />
          <PairedBars rows={[{ label: "DBMS", a: 76, b: 82 }, { label: "OS", a: 70, b: 58 }, { label: "CN", a: 64, b: 71 }, { label: "SE", a: null, b: 55 }]} />
        </Card>
        <Card className="md:col-span-6 lg:col-span-5">
          <CardHeader title="Pulse strip & faces" />
          <PulseStrip weeks={weeks} />
          <div className="mt-4 flex gap-3">
            {[1, 2, 3, 4, 5].map((m) => (
              <MoodFace key={m} mood={m} size={36} />
            ))}
          </div>
        </Card>
        <Card className="md:col-span-3 lg:col-span-4">
          <CardHeader title="Goal compass" />
          <GoalCompass current={7.86} required={8.9} max={10} state="STRETCH" />
        </Card>
        <Card className="md:col-span-3 lg:col-span-4">
          <CardHeader title="Credit path" />
          <CreditPath earned={88} inProgress={24} total={160} />
        </Card>
        <Card className="md:col-span-6 lg:col-span-4">
          <CardHeader title="Small multiples" icon={Target} />
          <div className="flex items-center gap-4">
            <CoverageDonut value={86} size={96} />
            <ProgressRing value={62} size={56} label="Profile" />
            <Sparkline values={[7.2, 7.8, 6.6, 8.4, 8.9]} label="SGPA trend" />
          </div>
          <div className="mt-4">
            <Meter value={14} max={20} label="Capacity" />
          </div>
        </Card>
        <Card className="md:col-span-6 lg:col-span-6">
          <CardHeader title="Workload bars" />
          <HBars rows={[{ label: "Dr. Iyer", value: 18, sub: "/ 20" }, { label: "Prof. Rao", value: 22, sub: "/ 20" }, { label: "Dr. Shah", value: 9, sub: "/ 20" }]} max={20} />
        </Card>
        <Card className="md:col-span-6 lg:col-span-6">
          <CardHeader title="Grouped & stacked" />
          <GroupedBars groups={[{ label: "Sec A", values: [7.9, 7.6] }, { label: "Sec B", values: [7.4, 7.5] }, { label: "Sec C", values: [8.1, 7.9] }]} series={["Latest SGPA", "CGPA"]} />
          <div className="mt-4">
            <StackedBar segments={[{ label: "Pass", value: 41, color: "#34D399" }, { label: "Pending", value: 6, color: "#CFD8CF" }, { label: "Fail", value: 2, color: "#F06A6A" }]} />
          </div>
        </Card>
      </Bento>

      <Card className="mt-5">
        <CardHeader title="Avatars & empty state" icon={HeartPulse} tone="coral" />
        <div className="flex gap-3">
          <Avatar name="Ananya Rao" size={48} ring />
          <Avatar name="Meera Iyer" size={48} />
          <Avatar name="Kiran S" size={48} />
          <Avatar name="Dev Patel" size={48} />
        </div>
        <EmptyState illustration="questions" title="No questions yet" body="Stuck on something? Ask your mentor." action={<Button>Ask a question</Button>} />
      </Card>

      <Card className="mt-5">
        <CardHeader title="Paper-cut illustrations" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {(Object.keys(ILLUSTRATION_ALT) as IllustrationName[]).map((n) => (
            <figure key={n} className="rounded-panel bg-canvas p-2 text-center">
              <Illustration name={n} className="mx-auto h-24" />
              <figcaption className="text-[12px] text-ink-500">{n}</figcaption>
            </figure>
          ))}
        </div>
      </Card>
    </StyleguideShell>
  );
}
