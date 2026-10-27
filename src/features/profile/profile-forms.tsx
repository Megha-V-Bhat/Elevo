"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Field, Input, Textarea } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { updateProfile } from "@/server/actions/profile";

type Values = Record<string, unknown>;

function useSave(section: "personal" | "about" | "mentor") {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = (v: Values) =>
    start(async () => {
      const r = await updateProfile(section, v);
      if (!r.ok) {
        setErrors(r.error.fieldErrors ?? {});
        return void toast.error(r.error.message);
      }
      setErrors({});
      toast.success("Saved");
      router.refresh();
    });
  return { pending, errors, save };
}

export function PersonalForm({ initial, avatarUrl, optional }: { initial: Values; avatarUrl: string | null; optional: Record<string, boolean> }) {
  const [v, setV] = useState(initial);
  const { pending, errors, save } = useSave("personal");
  const s = (k: string) => (v[k] == null ? "" : String(v[k]));
  return (
    <Card>
      <h2 className="mb-4 font-display text-h3 font-semibold text-ink-900">Personal details</h2>
      <div className="grid gap-5">
        <AvatarUploader name={s("full_name")} initialUrl={avatarUrl} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="pf-name" required error={errors.full_name}>
            <Input value={s("full_name")} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
          </Field>
          <Field label="Phone" htmlFor="pf-phone" required error={errors.phone}>
            <Input type="tel" value={s("phone")} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
          {optional.dob && (
            <Field label="Date of birth" htmlFor="pf-dob" optional>
              <Input type="date" value={s("dob")} onChange={(e) => setV({ ...v, dob: e.target.value })} />
            </Field>
          )}
          {optional.gender && (
            <Field label="Gender" htmlFor="pf-gender" optional>
              <Input value={s("gender")} onChange={(e) => setV({ ...v, gender: e.target.value })} />
            </Field>
          )}
        </div>
        {optional.address && (
          <Field label="Address" htmlFor="pf-address" optional>
            <Textarea rows={2} value={s("address")} onChange={(e) => setV({ ...v, address: e.target.value })} />
          </Field>
        )}
        <Button className="justify-self-start" loading={pending} onClick={() => save(v)}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

export function AboutForm({ initial }: { initial: Values }) {
  const [v, setV] = useState(initial);
  const { pending, errors, save } = useSave("about");
  const s = (k: string) => (v[k] == null ? "" : String(v[k]));
  return (
    <Card>
      <h2 className="mb-4 font-display text-h3 font-semibold text-ink-900">About me</h2>
      <div className="grid gap-5">
        <Field label="Skills" htmlFor="ab-skills" optional>
          <TagInput id="ab-skills" value={(v.skills as string[]) ?? []} onChange={(x) => setV({ ...v, skills: x })} />
        </Field>
        <Field label="Interests" htmlFor="ab-interests" optional>
          <TagInput id="ab-interests" value={(v.interests as string[]) ?? []} onChange={(x) => setV({ ...v, interests: x })} />
        </Field>
        <Field label="Career goals" htmlFor="ab-goals" optional error={errors.career_goals}>
          <Textarea rows={3} value={s("career_goals")} onChange={(e) => setV({ ...v, career_goals: e.target.value })} />
        </Field>
        <Field label="Achievements" htmlFor="ab-ach" optional>
          <Textarea rows={3} value={s("achievements")} onChange={(e) => setV({ ...v, achievements: e.target.value })} />
        </Field>
        <Field label="Where would support help most?" htmlFor="ab-support" optional helper="Only your mentor sees this.">
          <Textarea rows={2} value={s("support_areas")} onChange={(e) => setV({ ...v, support_areas: e.target.value })} />
        </Field>
        <Button className="justify-self-start" loading={pending} onClick={() => save(v)}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}

export function StaffProfileForm({ initial, avatarUrl, role }: { initial: Values; avatarUrl: string | null; role: "MENTOR" | "HOD" }) {
  const [v, setV] = useState(initial);
  const { pending, errors, save } = useSave("mentor");
  const s = (k: string) => (v[k] == null ? "" : String(v[k]));
  return (
    <Card>
      <h2 className="mb-4 font-display text-h3 font-semibold text-ink-900">Profile</h2>
      <div className="grid gap-5">
        <AvatarUploader name={s("full_name")} initialUrl={avatarUrl} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="sp-name" required error={errors.full_name}>
            <Input value={s("full_name")} onChange={(e) => setV({ ...v, full_name: e.target.value })} />
          </Field>
          <Field label="Phone" htmlFor="sp-phone" required error={errors.phone}>
            <Input type="tel" value={s("phone")} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
          <Field label="Designation" htmlFor="sp-des" required error={errors.designation}>
            <Input value={s("designation")} onChange={(e) => setV({ ...v, designation: e.target.value })} />
          </Field>
          {role === "MENTOR" && (
            <>
              <Field label="Official email" htmlFor="sp-email" required error={errors.official_email}>
                <Input type="email" value={s("official_email")} onChange={(e) => setV({ ...v, official_email: e.target.value })} />
              </Field>
              <Field label="Faculty ID" htmlFor="sp-fid" required error={errors.faculty_id}>
                <Input value={s("faculty_id")} onChange={(e) => setV({ ...v, faculty_id: e.target.value })} />
              </Field>
            </>
          )}
        </div>
        {role === "MENTOR" && (
          <Field label="Expertise" htmlFor="sp-exp" optional>
            <TagInput id="sp-exp" value={(v.expertise as string[]) ?? []} onChange={(x) => setV({ ...v, expertise: x })} />
          </Field>
        )}
        <Button className="justify-self-start" loading={pending} onClick={() => save(v)}>
          Save changes
        </Button>
      </div>
    </Card>
  );
}
