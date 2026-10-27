import { requirePage } from "@/server/authz";

export default async function HodLayout({ children }: { children: React.ReactNode }) {
  await requirePage("HOD");
  return children;
}
