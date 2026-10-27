import { requirePage } from "@/server/authz";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  await requirePage("MENTOR");
  return children;
}
