"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { requestPasswordReset, signIn, updatePassword } from "@/server/actions/auth";

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-panel border border-coral-100 bg-coral-50 px-3.5 py-2.5 text-small font-medium text-coral-700">
      {message}
    </p>
  );
}

function PasswordInput({ id, name, autoComplete, onCaps }: { id: string; name: string; autoComplete: string; onCaps?: (v: boolean) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        className="pr-12"
        onKeyUp={(e) => onCaps?.(e.getModifierState("CapsLock"))}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-control text-ink-500 hover:text-ink-900"
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState(signIn, null);
  const [caps, setCaps] = useState(false);
  const err = state && !state.ok ? state.error : undefined;
  return (
    <form action={action} className="grid gap-4" noValidate>
      {linkError && !err && <FormError message="That link has expired or was already used. Sign in, or request a new reset link." />}
      <FormError message={err?.fieldErrors ? undefined : err?.message} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email" error={err?.fieldErrors?.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={err?.fieldErrors?.password}
        helper={caps ? <span className="font-semibold text-butter-800">Caps Lock is on</span> : undefined}
      >
        <PasswordInput id="password" name="password" autoComplete="current-password" onCaps={setCaps} />
      </Field>
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot-password" className="min-h-9 py-2 text-small font-semibold text-pine-600 hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state?.ok)
    return (
      <p role="status" className="rounded-panel border border-mint-100 bg-mint-50 px-4 py-3 text-body text-pine-700">
        {state.data}
      </p>
    );
  const err = state && !state.ok ? state.error : undefined;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={err?.fieldErrors ? undefined : err?.message} />
      <Field label="Email" htmlFor="email" error={err?.fieldErrors?._ ?? err?.fieldErrors?.email} helper="We'll email you a link to choose a new password.">
        <Input name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}

export function NewPasswordForm({ cta }: { cta: string }) {
  const [state, action, pending] = useActionState(updatePassword, null);
  const err = state && !state.ok ? state.error : undefined;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError message={err?.fieldErrors ? undefined : err?.message} />
      <Field label="New password" htmlFor="password" error={err?.fieldErrors?.password} helper="At least 10 characters, with a letter and a number.">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={err?.fieldErrors?.confirm}>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {cta}
      </Button>
    </form>
  );
}
