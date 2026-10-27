import type { Metadata } from "next";
import { AuthFrame } from "../auth-layout";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to continue to Elevo.">
      <LoginForm next={sp.next} linkError={sp.error === "link"} />
    </AuthFrame>
  );
}
