import type { Metadata } from "next";
import { AuthFrame } from "../auth-layout";
import { NewPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPage() {
  return (
    <AuthFrame title="Choose a new password" subtitle="You'll be signed in right after.">
      <NewPasswordForm cta="Save and continue" />
    </AuthFrame>
  );
}
