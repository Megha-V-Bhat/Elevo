import { Eye } from "lucide-react";
import type { Metadata } from "next";
import { ChartFrame, PULSE_LEGEND, PulseStrip } from "@/components/charts";
import { Card, Chip } from "@/components/ui/display";
import { Bento, PageHeader } from "@/components/ui/layout";
import { CheckinForm } from "@/features/pulse/checkin-form";
import { MOOD_TEXT } from "@/features/pulse/faces";
import { currentWeekStart, fmtDate } from "@/lib/dates";
import { reflectionLine } from "@/lib/engine/pulse";
import { requirePage } from "@/server/authz";
import { loadAcademics, subjectCatalog } from "@/server/queries/academics";
import { mentorOf, studentProfile } from "@/server/queries/people";
import { asEngine, ownPulse, toStrip } from "@/server/queries/pulse";
import { appSettings } from "@/server/queries/settings";

export const metadata: Metadata = { title: "Weekly Pulse" };

export default async function PulsePage() {
  const me = await requirePage("MENTEE");
  const [rows, settings, profile, mentor, a] = await Promise.all([ownPulse(me.id), appSettings(), studentProfile(me.id), mentorOf(me.id), loadAcademics(me.id, me.department_id)]);
  const week = currentWeekStart(settings.pulse_week_start);
  const current = rows.find((r) => r.week_start === week);
  // Current subjects: this semester's results, else the catalog for the current semester
  const sem = profile?.current_semester ?? null;
  let subjects = a.semesters.find((s) => s.semester_no === sem)?.results.map((r) => ({ id: r.subject.id, name: r.subject.name })) ?? [];
  if (!subjects.length && sem) subjects = (await subjectCatalog(me.department_id, sem)).map((s) => ({ id: s.id, name: s.name }));
  const strip = toStrip(rows.map((r) => ({ week_start: r.week_start, mood: r.mood, workload: r.workload, has_note: !!r.help_note && !!r.share_note })), settings.pulse_week_start);
  const reflection = reflectionLine(asEngine(rows));

  return (
    <>
      <PageHeader
        title="Weekly Pulse"
        subtitle="Three quick questions, about 30 seconds. It helps your mentor notice early when a week is tough. Skipping is always fine."
        eyebrow={<Chip tone="mint">Week of {fmtDate(week, { day: "numeric", month: "short" })}</Chip>}
      />
      <Bento>
        <Card className="md:col-span-6 lg:col-span-7">
          {current && (
            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-panel bg-mint-50 p-3.5 text-small text-pine-700">
              <span className="font-semibold">You checked in this week: {MOOD_TEXT[current.mood]}, {current.workload.toLowerCase()} workload.</span>
              {current.seen_by_mentor_at && (
                <Chip tone="mint">
                  <Eye className="size-3" aria-hidden /> Seen by your mentor
                </Chip>
              )}
              <span className="text-ink-700">You can update it until the week ends.</span>
            </div>
          )}
          <CheckinForm
            mentorName={mentor?.full_name ?? null}
            subjects={subjects}
            initial={{
              mood: current?.mood ?? null,
              workload: current?.workload ?? null,
              subject_confidence: current?.subject_confidence ?? [],
              help_note: current?.help_note ?? null,
              share_note: current?.share_note ?? true,
            }}
          />
        </Card>
        <div className="grid content-start gap-5 md:col-span-6 lg:col-span-5">
          <Card>
            <ChartFrame
              bare
              title="Your last 12 weeks"
              table={{ columns: ["Week of", "Mood", "Workload"], rows: rows.map((r) => [r.week_start, MOOD_TEXT[r.mood], r.workload.toLowerCase()]) }}
            >
              <h2 className="mb-3 font-display text-h3 font-semibold text-ink-900">Your last 12 weeks</h2>
              <PulseStrip weeks={strip} />
              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-700">
                {PULSE_LEGEND.slice(1).map((m, i) => (
                  <li key={m.label} className="inline-flex items-center gap-1">
                    <span aria-hidden className={`inline-flex size-4 items-center justify-center rounded text-[10px] font-bold ${m.bg} ${m.text}`}>{i + 1}</span>
                    {m.label}
                  </li>
                ))}
                <li className="inline-flex items-center gap-1">
                  <span aria-hidden className="size-1.5 rounded-full bg-coral-600" /> heavy week
                </li>
              </ul>
            </ChartFrame>
            {reflection && <p className="mt-4 rounded-panel bg-lilac-50 p-3.5 text-body text-ink-900">{reflection}</p>}
          </Card>
          <Card className="bg-canvas-sunk shadow-none">
            <h2 className="font-display text-h3 font-semibold text-ink-900">How Pulse works</h2>
            <ul className="mt-2 grid gap-1.5 text-small text-ink-700">
              <li>• One check-in per week, editable until the week ends.</li>
              <li>• Your mentor sees your mood and workload; your note only if you share it.</li>
              <li>• Missing a week never counts against you.</li>
              <li>• Never shown to other students, never in PDFs, never ranked.</li>
            </ul>
          </Card>
        </div>
      </Bento>
    </>
  );
}
