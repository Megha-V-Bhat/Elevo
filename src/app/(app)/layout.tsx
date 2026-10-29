import { Dock, MobileTabBar } from "@/components/shell/dock";
import { NavProgress } from "@/components/shell/nav-progress";
import { TopBar } from "@/components/shell/topbar";
import { SetupNotice } from "@/components/feedback/setup-notice";
import { hasSupabase } from "@/lib/env";
import { requirePage } from "@/server/authz";
import { signedUrl } from "@/server/files";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabase) return <SetupNotice />;
  const me = await requirePage();
  const avatarUrl = await signedUrl("avatars", me.avatar_path);
  return (
    <div className="min-h-dvh">
      <NavProgress />
      <TopBar me={{ id: me.id, name: me.name, email: me.email, role: me.role, avatarUrl }} />
      <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pt-6 pb-32 md:px-6 md:pt-8 md:pb-[120px]">
        {children}
      </main>
      <Dock role={me.role} />
      <MobileTabBar role={me.role} />
    </div>
  );
}
