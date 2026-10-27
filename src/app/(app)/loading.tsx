import { Skeleton } from "@/components/ui/display";

/** Layout-shaped skeleton: header, hero, bento tiles, two cards. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <Skeleton className="mt-8 h-44 w-full rounded-hero" />
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  );
}
