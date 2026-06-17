import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import EngineerForm from "../../EngineerForm";

export default async function EditEngineerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const engineer = await prisma.engineer.findUnique({ where: { id } });
  if (!engineer) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title="技術者を編集" subtitle={engineer.name} />
      <Card className="p-6">
        <EngineerForm engineer={engineer} />
      </Card>
    </div>
  );
}
