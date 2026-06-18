import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getCompanyForm } from "@/lib/company";
import { saveCompanySetting } from "@/lib/actions";
import { PageHeader, Card, Badge } from "@/components/ui";
import { Field, Input, Textarea, SubmitButton } from "@/components/form";

export const dynamic = "force-dynamic";

export default async function CompanySettingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await requireStaff();
  if (user.role !== "ADMIN") redirect("/dashboard");
  const sp = await searchParams;
  const c = await getCompanyForm();

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="会社情報設定"
        subtitle="請求書に印字する自社（請求元）情報。住所・電話番号・振込先などを変更できます。"
      />

      {sp.saved && (
        <Card className="p-3 mb-4">
          <Badge className="bg-emerald-100 text-emerald-700">保存しました</Badge>
        </Card>
      )}

      <Card className="p-6">
        <form action={saveCompanySetting} className="space-y-4">
          <Field label="会社名" required>
            <Input name="name" required defaultValue={c.name} />
          </Field>
          <Field label="登録番号（インボイス適格請求書発行事業者）">
            <Input name="registrationNumber" defaultValue={c.registrationNumber} placeholder="T0000000000000" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="郵便番号">
              <Input name="postalCode" defaultValue={c.postalCode} placeholder="108-0075" />
            </Field>
            <div className="md:col-span-2">
              <Field label="住所1">
                <Input name="address1" defaultValue={c.address1} placeholder="東京都港区港南2-16-4" />
              </Field>
            </div>
          </div>
          <Field label="住所2（建物名・階数など）">
            <Input name="address2" defaultValue={c.address2} placeholder="品川グランドセントラルタワー17階" />
          </Field>
          <Field label="電話番号">
            <Input name="tel" defaultValue={c.tel} placeholder="050-5052-1028" />
          </Field>
          <Field label="振込先（1行に1口座）" hint="改行で複数口座を登録できます">
            <Textarea name="banks" rows={3} defaultValue={c.banks} />
          </Field>
          <Field label="補足注記" hint="例: ※恐れ入りますが、振込手数料はご負担ください">
            <Input name="feeNote" defaultValue={c.feeNote} />
          </Field>
          <div className="pt-2">
            <SubmitButton>保存する</SubmitButton>
          </div>
        </form>
      </Card>

      <p className="text-xs text-gray-400 mt-4">
        ※ ロゴ・角印の画像は <code className="text-gray-500">public/company/logo.png</code> /{" "}
        <code className="text-gray-500">seal.png</code>{" "}
        に配置されています（差し替える場合はファイルを更新してください）。
      </p>
    </div>
  );
}
