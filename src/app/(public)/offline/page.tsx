import type { Metadata } from "next";
import { SystemPage } from "@/components/feedback/system-page";

export const metadata: Metadata = { title: "You're offline" };

export default function Offline() {
  return <SystemPage art="offline" title="You're offline" body="Check your connection. Anything you were typing in long forms is kept on this device and restored when you're back." />;
}
