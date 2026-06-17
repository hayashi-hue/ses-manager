import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import ProjectForm from "../ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <div className="max-w-3xl">
      <PageHeader title="案件を登録" />
      <Card className="p-6">
        {clients.length === 0 ? (
          <p className="text-sm text-amber-600">
            先に「取引先・営業」から取引先を登録してください。
          </p>
        ) : (
          <ProjectForm clients={clients} />
        )}
      </Card>
    </div>
  );
}
