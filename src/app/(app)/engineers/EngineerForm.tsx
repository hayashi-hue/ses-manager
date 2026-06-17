import { saveEngineer } from "@/lib/actions";
import { Field, Input, Textarea, Select, Options, SubmitButton } from "@/components/form";
import { EmploymentTypeLabel, EngineerStatusLabel } from "@/lib/enums";
import { toDateInputValue } from "@/lib/utils";
import { LinkButton } from "@/components/ui";

type EngineerData = {
  id: string;
  code: string;
  name: string;
  nameKana: string | null;
  email: string | null;
  phone: string | null;
  employmentType: string;
  affiliation: string | null;
  status: string;
  costRate: number;
  sellRateMin: number;
  experienceYears: number;
  joinedOn: Date | null;
  note: string | null;
};

export default function EngineerForm({ engineer }: { engineer?: EngineerData }) {
  return (
    <form action={saveEngineer} className="space-y-5">
      {engineer && <input type="hidden" name="id" value={engineer.id} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="要員番号" required>
          <Input name="code" required defaultValue={engineer?.code} placeholder="ENG-001" />
        </Field>
        <Field label="区分" required>
          <Select name="employmentType" defaultValue={engineer?.employmentType || "EMPLOYEE"}>
            <Options map={EmploymentTypeLabel} />
          </Select>
        </Field>
        <Field label="氏名" required>
          <Input name="name" required defaultValue={engineer?.name} placeholder="山田 太郎" />
        </Field>
        <Field label="フリガナ">
          <Input name="nameKana" defaultValue={engineer?.nameKana || ""} placeholder="ヤマダ タロウ" />
        </Field>
        <Field label="メールアドレス">
          <Input type="email" name="email" defaultValue={engineer?.email || ""} />
        </Field>
        <Field label="電話番号">
          <Input name="phone" defaultValue={engineer?.phone || ""} />
        </Field>
        <Field label="所属（部署 / 協力会社名）">
          <Input name="affiliation" defaultValue={engineer?.affiliation || ""} placeholder="開発部 / 株式会社〇〇" />
        </Field>
        <Field label="稼働ステータス" required>
          <Select name="status" defaultValue={engineer?.status || "AVAILABLE"}>
            <Options map={EngineerStatusLabel} />
          </Select>
        </Field>
        <Field label="経験年数">
          <Input type="number" name="experienceYears" min={0} defaultValue={engineer?.experienceYears ?? 0} />
        </Field>
        <Field label="入社 / 参画日">
          <Input type="date" name="joinedOn" defaultValue={toDateInputValue(engineer?.joinedOn)} />
        </Field>
        <Field label="原価単価（月額・円）" hint="自社コスト。粗利計算に使用">
          <Input type="number" name="costRate" min={0} step={10000} defaultValue={engineer?.costRate ?? 0} />
        </Field>
        <Field label="提示単価 下限（月額・円）" hint="客先への最低提示額">
          <Input type="number" name="sellRateMin" min={0} step={10000} defaultValue={engineer?.sellRateMin ?? 0} />
        </Field>
      </div>

      <Field label="備考">
        <Textarea name="note" rows={3} defaultValue={engineer?.note || ""} placeholder="得意分野・希望条件・面談メモなど" />
      </Field>

      <div className="flex gap-2 pt-2">
        <SubmitButton>{engineer ? "更新する" : "登録する"}</SubmitButton>
        <LinkButton href="/engineers" variant="ghost">
          キャンセル
        </LinkButton>
      </div>
    </form>
  );
}
