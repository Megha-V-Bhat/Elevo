import { requirePage } from "@/server/authz";

export default async function MenteeLayout({ children }: { children: React.ReactNode }) {
  await requirePage("MENTEE");
  return children;
}
