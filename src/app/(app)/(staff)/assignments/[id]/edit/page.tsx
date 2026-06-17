import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import AssignmentForm from "../../AssignmentForm";

export const dynamic = "force-dynamic";

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [assignment, engineers, projects] = await Promise.all([
    prisma.assignment.findUnique({ where: { id } }),
    prisma.engineer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, costRate: true, sellRateMin: true },
    }),
    prisma.project.findMany({ orderBy: { updatedAt: "desc" }, include: { client: true } }),
  ]);
  if (!assignment) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title="アサインを編集" />
      <Card className="p-6">
        <AssignmentForm
          assignment={assignment}
          engineers={engineers}
          projects={projects.map((p) => ({ id: p.id, title: p.title, clientName: p.client.name }))}
        />
      </Card>
    </div>
  );
}
