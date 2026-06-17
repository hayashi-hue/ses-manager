import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { UserRoleLabel } from "@/lib/enums";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userName={user.name}
        role={UserRoleLabel[user.role] || user.role}
        roleKey={user.role}
      />
      <main className="flex-1 p-8 max-w-[1400px]">{children}</main>
    </div>
  );
}
