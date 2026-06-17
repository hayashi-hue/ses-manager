import { saveProject } from "@/lib/actions";
import { Field, Input, Textarea, Select, Options, SubmitButton } from "@/components/form";
import { ContractTypeLabel, ProjectStatusLabel } from "@/lib/enums";
import { toDateInputValue } from "@/lib/utils";
import { LinkButton } from "@/components/ui";

type ProjectData = {
  id: string;
  code: string;
  title: string;
  clientId: string;
  contractType: string;
  workLocation: string | null;
  startOn: Date | null;
  endOn: Date | null;
  requiredCount: number;
  unitPriceMin: number;
  unitPriceMax: number;
  requiredSkills: string | null;
  status: string;
  description: string | null;
};

export default function ProjectForm({
  project,
  clients,
}: {
  project?: ProjectData;
  clients: { id: string; name: string }[];
}) {
  return (
    <form action={saveProject} className="space-y-5">
      {project && <input type="hidden" name="id" value={project.id} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="案件コード" required>
          <Input name="code" required defaultValue={project?.code} placeholder="PRJ-001" />
        </Field>
        <Field label="取引先" required>
          <Select name="clientId" defaultValue={project?.clientId || ""} required>
            <option value="">選択してください</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="案件名" required>
          <Input name="title" required defaultValue={project?.title} placeholder="基幹システム刷新 / Javaエンジニア募集" />
        </Field>
        <Field label="契約形態" required>
          <Select name="contractType" defaultValue={project?.contractType || "QUASI_MANDATE"}>
            <Options map={ContractTypeLabel} />
          </Select>
        </Field>
        <Field label="勤務地">
          <Input name="workLocation" defaultValue={project?.workLocation || ""} placeholder="東京都港区 / リモート可" />
        </Field>
        <Field label="ステータス" required>
          <Select name="status" defaultValue={project?.status || "OPEN"}>
            <Options map={ProjectStatusLabel} />
          </Select>
        </Field>
        <Field label="開始予定日">
          <Input type="date" name="startOn" defaultValue={toDateInputValue(project?.startOn)} />
        </Field>
        <Field label="終了予定日">
          <Input type="date" name="endOn" defaultValue={toDateInputValue(project?.endOn)} />
        </Field>
        <Field label="必要人数">
          <Input type="number" name="requiredCount" min={1} defaultValue={project?.requiredCount ?? 1} />
        </Field>
        <div />
        <Field label="想定単価 下限（月額・円）">
          <Input type="number" name="unitPriceMin" min={0} step={10000} defaultValue={project?.unitPriceMin ?? 0} />
        </Field>
        <Field label="想定単価 上限（月額・円）">
          <Input type="number" name="unitPriceMax" min={0} step={10000} defaultValue={project?.unitPriceMax ?? 0} />
        </Field>
      </div>
      <Field label="必須スキル" hint="カンマ区切り（例: Java, Spring, AWS）">
        <Input name="requiredSkills" defaultValue={project?.requiredSkills || ""} />
      </Field>
      <Field label="案件詳細・募集要項">
        <Textarea name="description" rows={4} defaultValue={project?.description || ""} />
      </Field>
      <div className="flex gap-2 pt-2">
        <SubmitButton>{project ? "更新する" : "登録する"}</SubmitButton>
        <LinkButton href="/projects" variant="ghost">
          キャンセル
        </LinkButton>
      </div>
    </form>
  );
}
