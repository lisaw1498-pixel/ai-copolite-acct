import { requireUser } from "@/lib/current-user";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar userName={user.fullName || user.email} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
