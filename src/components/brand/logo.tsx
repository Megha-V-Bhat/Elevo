import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = { sm: 24, md: 32, lg: 44 } as const;

/** Uses the brand files in /public/brand unmodified. */
export function Logo({ variant = "color", size = "md", className }: { variant?: "color" | "white" | "mark"; size?: keyof typeof SIZES; className?: string }) {
  const h = SIZES[size];
  if (variant === "mark")
    return <Image src="/brand/elevo-mark.svg" alt="Elevo" width={h} height={h} className={className} priority />;
  return (
    <Image
      src={variant === "white" ? "/brand/elevo-logo-white.svg" : "/brand/elevo-logo.svg"}
      alt="Elevo"
      width={Math.round((h * 223) / 64)}
      height={h}
      className={cn("h-auto", className)}
      priority
    />
  );
}
