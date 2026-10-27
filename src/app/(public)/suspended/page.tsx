import type { Metadata } from "next";
import { SystemPage } from "@/components/feedback/system-page";
import { signOut } from "@/server/actions/shell";

export const metadata: Metadata = { title: "Account suspended" };

export default function Suspended() {
  return (
    <SystemPage
      art="locked"
      title="Your account is paused"
      body="Your HOD has suspended this account. If you think this is a mistake, contact your department office."
      action={
        <form action={async () => { "use server"; await signOut(); }}>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-control bg-pine-600 px-5 font-semibold text-white hover:bg-pine-700">
            Sign out
          </button>
        </form>
      }
    />
  );
}
