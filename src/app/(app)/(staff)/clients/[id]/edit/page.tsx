import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import ClientForm from "../../ClientForm";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title="取引先を編集" subtitle={client.name} />
      <Card className="p-6">
        <ClientForm client={client} />
      </Card>
    </div>
  );
}
