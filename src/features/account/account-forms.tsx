"use client";

import { LogOut } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Field, Input, Switch } from "@/components/ui/form";
import { changePassword, updatePrefs } from "@/server/actions/profile";
import { signOut } from "@/server/actions/shell";
import type { Role } from "@/server/authz";

export function PasswordForm() {
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="font-display text-h3 font-semibold text-ink-900">Change password</h2>
      <form
        className="mt-4 grid gap-4 sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (v.next !== v.confirm) return setErrs({ confirm: "Passwords don't match" });
          start(async () => {
            const r = await changePassword(v.current, v.next);
            if (!r.ok) {
              setErrs(r.error.fieldErrors ?? { next: r.error.message });
              return void toast.error(r.error.message);
            }
            setErrs({});
            setV({ current: "", next: "", confirm: "" });
            toast.success("Password changed");
          });
        }}
      >
        <Field label="Current password" htmlFor="pw-current" error={errs.current}>
          <Input type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />
        </Field>
        <Field label="New password" htmlFor="pw-next" error={errs.next ?? errs._} helper="At least 10 characters, with a letter and a number.">
          <Input type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" error={errs.confirm}>
          <Input type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
        </Field>
        <Button type="submit" loading={pending} className="justify-self-start">
          Update password
        </Button>
      </form>
    </Card>
  );
}

const PREFS: Record<Role, { k: string; l: string; d: string }[]> = {
  MENTEE: [
    { k: "pulse_reminder", l: "Weekly Pulse reminder", d: "One gentle reminder at the start of each week." },
    { k: "email_pulse", l: "Email the Pulse reminder", d: "Otherwise it's in-app only." },
    { k: "email_sessions", l: "Email session reminders", d: "The day before a session." },
  ],
  MENTOR: [
    { k: "email_ask", l: "Email when a question waits 48 hours", d: "Unanswered questions from your mentees." },
    { k: "email_followups", l: "Email follow-up reminders", d: "Review dates and overdue goals." },
    { k: "email_sessions", l: "Email session reminders", d: "The day before a session." },
  ],
  HOD: [{ k: "email_followups", l: "Email follow-up reminders", d: "Review dates for items you created." }],
};

export function PrefsForm({ role, initial }: { role: Role; initial: Record<string, boolean> }) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="font-display text-h3 font-semibold text-ink-900">Notifications</h2>
      <p className="mt-1 text-small text-ink-500">In-app notifications are always on. Choose what also reaches your inbox.</p>
      <div className="mt-5 grid gap-4">
        {PREFS[role].map((p) => (
          <Switch key={p.k} id={`pref-${p.k}`} checked={v[p.k] !== false} onChange={(x) => setV({ ...v, [p.k]: x })} label={p.l} description={p.d} />
        ))}
      </div>
      <Button
        className="mt-5"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await updatePrefs(Object.fromEntries(PREFS[role].map((p) => [p.k, v[p.k] !== false])));
            if (!r.ok) return void toast.error(r.error.message);
            toast.success("Preferences saved");
          })
        }
      >
        Save preferences
      </Button>
    </Card>
  );
}

export function SessionsCard() {
  const [pending, start] = useTransition();
  return (
    <Card>
      <h2 className="font-display text-h3 font-semibold text-ink-900">Sessions</h2>
      <p className="mt-1 text-small text-ink-500">Signed in on a shared or lost device? Sign out everywhere — you&apos;ll need your password on every device again.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" loading={pending} onClick={() => start(() => signOut(false))}>
          <LogOut /> Sign out of this device
        </Button>
        <Button variant="destructive" loading={pending} onClick={() => start(() => signOut(true))}>
          Sign out of all devices
        </Button>
      </div>
    </Card>
  );
}
