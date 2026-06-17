import { PageHeader, Card } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import EngineerForm from "../EngineerForm";

export default async function NewEngineerPage() {
  await requireStaff();
  return (
    <div className="max-w-3xl">
      <PageHeader title="技術者を登録" subtitle="新しい技術者・協力会社要員を登録します" />
      <Card className="p-6">
        <EngineerForm />
      </Card>
    </div>
  );
}
