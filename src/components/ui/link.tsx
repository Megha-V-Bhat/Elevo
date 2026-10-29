import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * next/link with prefetch off by default. App pages are dynamic (auth + several DB reads),
 * so viewport prefetching fires dozens of full renders per page; a click that lands while
 * those are in flight gets its navigation dropped and the link looks dead. Pass
 * prefetch={true} only for a link that's cheap to render.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
