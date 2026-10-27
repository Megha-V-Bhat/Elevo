"use client";

import { useEffect } from "react";
import { markThreadSeen } from "@/server/actions/ask";

export function ThreadSeen({ id, seen }: { id: string; seen: boolean }) {
  useEffect(() => {
    if (!seen) void markThreadSeen(id);
  }, [id, seen]);
  return null;
}
