import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import RequestForm from "@/components/RequestForm";

export const dynamic = "force-dynamic";

export default async function NewWorkflowPage() {
  const engineers = await prisma.engineer.findMany({
    where: { status: { not: "RETIRED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="申請を作成（代行）" subtitle="社員に代わって各種申請を登録します" />
      <Card className="p-6">
        <RequestForm engineers={engineers} cancelHref="/workflows" />
      </Card>
    </div>
  );
}
