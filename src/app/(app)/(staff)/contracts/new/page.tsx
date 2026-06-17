import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import ContractForm from "../ContractForm";

export const dynamic = "force-dynamic";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ assignmentId?: string }>;
}) {
  const sp = await searchParams;
  // 契約未作成のアサインのみ対象（編集時は別途）
  const assignments = await prisma.assignment.findMany({
    where: { contract: null },
    orderBy: { updatedAt: "desc" },
    include: { engineer: true, project: { include: { client: true } } },
  });

  const options = assignments.map((a) => ({
    id: a.id,
    label: `${a.engineer.name}／${a.project.client.name}／${a.project.title}`,
  }));

  return (
    <div className="max-w-3xl">
      <PageHeader title="契約を作成" />
      <Card className="p-6">
        {options.length === 0 ? (
          <p className="text-sm text-amber-600">
            契約可能なアサインがありません。先にアサインを作成してください。
          </p>
        ) : (
          <ContractForm assignments={options} defaultAssignmentId={sp.assignmentId} />
        )}
      </Card>
    </div>
  );
}
