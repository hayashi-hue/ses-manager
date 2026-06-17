import { requireStaff } from "@/lib/auth";

// 管理者/営業/経理 専用エリア。エンジニアがアクセスするとマイページへリダイレクト
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaff();
  return <>{children}</>;
}
