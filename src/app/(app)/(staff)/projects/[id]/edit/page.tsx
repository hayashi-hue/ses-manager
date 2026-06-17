import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import ProjectForm from "../../ProjectForm";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, clients] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!project) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title="案件を編集" subtitle={project.title} />
      <Card className="p-6">
        <ProjectForm project={project} clients={clients} />
      </Card>
    </div>
  );
}
