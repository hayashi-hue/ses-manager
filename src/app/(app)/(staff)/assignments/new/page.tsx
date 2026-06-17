import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import AssignmentForm from "../AssignmentForm";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; engineerId?: string }>;
}) {
  const sp = await searchParams;
  const [engineers, projects] = await Promise.all([
    prisma.engineer.findMany({
      where: { status: { not: "RETIRED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, costRate: true, sellRateMin: true },
    }),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: { client: true },
    }),
  ]);

  const projectOptions = projects.map((p) => ({
    id: p.id,
    title: p.title,
    clientName: p.client.name,
  }));

  return (
    <div className="max-w-3xl">
      <PageHeader title="アサインを作成" subtitle="技術者を案件に割り当てます" />
      <Card className="p-6">
        {engineers.length === 0 || projects.length === 0 ? (
          <p className="text-sm text-amber-600">
            先に技術者と案件を登録してください。
          </p>
        ) : (
          <AssignmentForm
            engineers={engineers}
            projects={projectOptions}
            defaultEngineerId={sp.engineerId}
            defaultProjectId={sp.projectId}
          />
        )}
      </Card>
    </div>
  );
}
