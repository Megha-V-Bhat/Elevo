"use client";

import { SystemPage } from "@/components/feedback/system-page";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <SystemPage
      art="error"
      code="500"
      title="Something went wrong"
      body="It's not you — we hit a problem loading this. Your saved work is safe. Try again in a moment."
      action={
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-control bg-pine-600 px-5 font-semibold text-white hover:bg-pine-700">
          Try again
        </button>
      }
    />
  );
}
