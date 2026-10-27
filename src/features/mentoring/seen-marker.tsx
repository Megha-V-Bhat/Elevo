"use client";

import { useEffect } from "react";
import { markSeen } from "@/server/actions/mentoring";

/** Marks items as seen a moment after they've been displayed; the "New" dot clears on the next visit. */
export function SeenMarker({ type, ids }: { type: "learning_resources" | "mentor_recommendations"; ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    const t = setTimeout(() => void markSeen(type, key.split(",")), 1500);
    return () => clearTimeout(t);
  }, [type, key]);
  return null;
}
