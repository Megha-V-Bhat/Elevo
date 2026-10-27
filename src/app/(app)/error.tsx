"use client";

import { ErrorState } from "@/components/ui/layout";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <ErrorState message="This page didn't load. Your saved work is safe." />
      <div className="mt-4 text-center">
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-control bg-pine-600 px-5 font-semibold text-white hover:bg-pine-700">
          Try again
        </button>
      </div>
    </div>
  );
}
