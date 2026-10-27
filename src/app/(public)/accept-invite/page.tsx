import type { Metadata } from "next";
import { AuthFrame } from "../auth-layout";
import { NewPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Accept your invite" };

export default function AcceptInvitePage() {
  return (
    <AuthFrame title="Welcome to Elevo" subtitle="Set a password to activate your account. Setup takes about 5 minutes after this.">
      <NewPasswordForm cta="Activate my account" />
    </AuthFrame>
  );
}
