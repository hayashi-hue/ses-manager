import { Field, Input, Textarea, Select, Options } from "@/components/form";
import { WorkRoleLabel, PhaseTypeLabel } from "@/lib/enums";
import { toDateInputValue } from "@/lib/utils";

type WH = {
  id: string;
  title: string;
  industry: string | null;
  startOn: Date | null;
  endOn: Date | null;
  roleType: string;
  teamSize: number | null;
  summary: string | null;
  technologies: string | null;
  phases: string | null;
  sortOrder: number;
};

/** 職務経歴の入力フィールド群（追加/編集で共用） */
export default function WorkHistoryFields({ wh }: { wh?: WH }) {
  const selectedPhases = (wh?.phases || "").split(",").map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="案件名 / プロジェクト概要" required>
          <Input name="title" required defaultValue={wh?.title} placeholder="大手銀行 勘定系システム再構築" />
        </Field>
        <Field label="業種">
          <Input name="industry" defaultValue={wh?.industry || ""} placeholder="金融 / 製造 / 流通 など" />
        </Field>
        <Field label="開始年月">
          <Input type="month" name="startOn" defaultValue={toMonth(wh?.startOn)} />
        </Field>
        <Field label="終了年月" hint="現在進行中は空欄">
          <Input type="month" name="endOn" defaultValue={toMonth(wh?.endOn)} />
        </Field>
        <Field label="役割">
          <Select name="roleType" defaultValue={wh?.roleType || "SE"}>
            <Options map={WorkRoleLabel} />
          </Select>
        </Field>
        <Field label="チーム規模（人数）">
          <Input type="number" name="teamSize" min={1} defaultValue={wh?.teamSize ?? ""} placeholder="10" />
        </Field>
      </div>

      <Field label="使用技術" hint="言語/FW/DB/OS/ツール（カンマ区切り）">
        <Input name="technologies" defaultValue={wh?.technologies || ""} placeholder="Java, Spring Boot, Oracle, Linux, Git" />
      </Field>

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-1">担当工程</span>
        <div className="flex flex-wrap gap-3">
          {Object.entries(PhaseTypeLabel).map(([k, v]) => (
            <label key={k} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="phases"
                value={k}
                defaultChecked={selectedPhases.includes(k)}
                className="w-4 h-4"
              />
              {v}
            </label>
          ))}
        </div>
      </div>

      <Field label="業務内容">
        <Textarea
          name="summary"
          rows={3}
          defaultValue={wh?.summary || ""}
          placeholder="担当した機能・役割・実績などを記入"
        />
      </Field>
    </div>
  );
}

function toMonth(d: Date | null | undefined): string {
  const v = toDateInputValue(d);
  return v ? v.slice(0, 7) : "";
}
