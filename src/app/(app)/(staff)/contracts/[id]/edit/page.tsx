import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import ContractForm from "../../ContractForm";

export const dynamic = "force-dynamic";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { assignment: { include: { engineer: true, project: { include: { client: true } } } } },
  });
  if (!contract) notFound();

  // 編集対象のアサインのみ（自身に紐づくもの）
  const options = [
    {
      id: contract.assignmentId,
      label: `${contract.assignment.engineer.name}／${contract.assignment.project.client.name}／${contract.assignment.project.title}`,
    },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader title="契約を編集" subtitle={contract.contractNo} />
      <Card className="p-6">
        <ContractForm contract={contract} assignments={options} />
      </Card>
    </div>
  );
}
