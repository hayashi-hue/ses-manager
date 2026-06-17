import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import ImportUploader from "./ImportUploader";

export const dynamic = "force-dynamic";

export default async function TimesheetImportPage() {
  await requireStaff();

  return (
    <div>
      <PageHeader
        title="勤務表アップロード取込"
        subtitle="Excel勤務表をアップロードすると、日次の実働時間を合計して当月工数に自動入力します"
        action={
          <Link
            href="/timesheets"
            className="px-4 py-2 rounded-lg text-sm bg-white border border-gray-300 hover:bg-gray-50"
          >
            工数一覧へ
          </Link>
        }
      />
      <ImportUploader />
    </div>
  );
}
