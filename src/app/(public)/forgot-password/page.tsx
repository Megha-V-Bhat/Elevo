import type { Metadata } from "next";
import Link from "next/link";
import { AuthFrame } from "../auth-layout";
import { ForgotForm } from "../auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <AuthFrame title="Reset your password" subtitle="Enter the email your HOD invited.">
      <ForgotForm />
      <Link href="/login" className="mt-4 inline-flex min-h-11 items-center text-small font-semibold text-pine-600 hover:underline">
        ← Back to sign in
      </Link>
    </AuthFrame>
  );
}
