import type { Metadata } from "next";
import { Card } from "@/components/ui/display";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { AssignmentBoard } from "@/features/hod/assignment-board";
import { requirePage } from "@/server/authz";
import { activeAssignments } from "@/server/queries/hod";
import { db } from "@/server/supabase";

export const metadata: Metadata = { title: "Assignments" };

export default async function Assignments({ searchParams }: { searchParams: Promise<{ student?: string; mentor?: string }> }) {
  await requirePage("HOD");
  const sp = await searchParams;
  const supabase = await db();
  const [{ data: students }, { data: mentors }, active, { data: hist }] = await Promise.all([
    supabase.from("student_profiles").select("user_id, full_name, usn, current_semester, section, users!inner(status)").neq("users.status", "SUSPENDED").order("full_name").limit(2000),
    supabase.from("mentor_profiles").select("user_id, full_name, capacity, users!inner(role, status)").eq("users.role", "MENTOR").neq("users.status", "SUSPENDED").order("full_name"),
    activeAssignments(),
    supabase.from("mentor_assignments").select("id, student_id, mentor_id, started_at, ended_at, reason").order("started_at", { ascending: false }).limit(100),
  ]);
  const sName = new Map((students ?? []).map((s) => [s.user_id, s.full_name || "Student"]));
  const mName = new Map((mentors ?? []).map((m) => [m.user_id, m.full_name || "Mentor"]));
  return (
    <>
      <PageHeader title="Assignments" subtitle="Assign, rebalance and review mentor–mentee pairs. Every change is audited and takes effect immediately." />
      {!(mentors ?? []).length ? (
        <Card>
          <EmptyState illustration="mentees" title="Invite mentors first" body="Once mentors accept their invites, they appear as columns here." />
        </Card>
      ) : (
        <AssignmentBoard
          students={(students ?? []).map((s) => ({ id: s.user_id, name: s.full_name || "New student", usn: s.usn, sem: s.current_semester, section: s.section }))}
          mentors={(mentors ?? []).map((m) => ({ id: m.user_id, name: m.full_name || "Mentor", capacity: m.capacity }))}
          initial={Object.fromEntries(active.map((a) => [a.student_id, a.mentor_id]))}
          history={(hist ?? []).map((h) => ({ id: h.id, student: sName.get(h.student_id) ?? "Student", mentor: mName.get(h.mentor_id) ?? "Former mentor", started_at: h.started_at, ended_at: h.ended_at, reason: h.reason }))}
          focusStudent={sp.student}
          focusMentor={sp.mentor}
        />
      )}
    </>
  );
}
