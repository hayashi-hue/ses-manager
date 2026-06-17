import { PageHeader, Card } from "@/components/ui";
import ClientForm from "../ClientForm";

export default function NewClientPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="取引先を登録" />
      <Card className="p-6">
        <ClientForm />
      </Card>
    </div>
  );
}
