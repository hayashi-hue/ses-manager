import { saveClient } from "@/lib/actions";
import { Field, Input, Textarea, Select, Options, SubmitButton } from "@/components/form";
import { ClientTypeLabel } from "@/lib/enums";
import { LinkButton } from "@/components/ui";

type ClientData = {
  id: string;
  name: string;
  nameKana: string | null;
  clientType: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  closingDay: number;
  paymentTermDays: number;
  address: string | null;
  note: string | null;
};

export default function ClientForm({ client }: { client?: ClientData }) {
  return (
    <form action={saveClient} className="space-y-5">
      {client && <input type="hidden" name="id" value={client.id} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="取引先名" required>
          <Input name="name" required defaultValue={client?.name} placeholder="株式会社サンプル" />
        </Field>
        <Field label="フリガナ">
          <Input name="nameKana" defaultValue={client?.nameKana || ""} />
        </Field>
        <Field label="区分" required>
          <Select name="clientType" defaultValue={client?.clientType || "END"}>
            <Options map={ClientTypeLabel} />
          </Select>
        </Field>
        <Field label="担当者名">
          <Input name="contactName" defaultValue={client?.contactName || ""} />
        </Field>
        <Field label="担当者メール">
          <Input type="email" name="contactEmail" defaultValue={client?.contactEmail || ""} />
        </Field>
        <Field label="担当者電話">
          <Input name="contactPhone" defaultValue={client?.contactPhone || ""} />
        </Field>
        <Field label="締め日" hint="月末締めは 31">
          <Input type="number" name="closingDay" min={1} max={31} defaultValue={client?.closingDay ?? 31} />
        </Field>
        <Field label="支払サイト（日）" hint="例: 翌月末払い = 30">
          <Input type="number" name="paymentTermDays" min={0} defaultValue={client?.paymentTermDays ?? 30} />
        </Field>
      </div>
      <Field label="住所">
        <Input name="address" defaultValue={client?.address || ""} />
      </Field>
      <Field label="備考">
        <Textarea name="note" rows={3} defaultValue={client?.note || ""} />
      </Field>
      <div className="flex gap-2 pt-2">
        <SubmitButton>{client ? "更新する" : "登録する"}</SubmitButton>
        <LinkButton href="/clients" variant="ghost">
          キャンセル
        </LinkButton>
      </div>
    </form>
  );
}
