"use client";

import { useState } from "react";
import { saveAssignment } from "@/lib/actions";
import { Field, Input, Textarea, Select, Options, SubmitButton } from "@/components/form";
import { AssignmentStatusLabel } from "@/lib/enums";
import { yen, calcMargin, toDateInputValue } from "@/lib/utils";
import { LinkButton } from "@/components/ui";

type AssignmentData = {
  id: string;
  engineerId: string;
  projectId: string;
  status: string;
  sellRate: number;
  costRate: number;
  startOn: Date | null;
  endOn: Date | null;
  standardHoursMin: number;
  standardHoursMax: number;
  note: string | null;
};

export default function AssignmentForm({
  assignment,
  engineers,
  projects,
  defaultEngineerId,
  defaultProjectId,
}: {
  assignment?: AssignmentData;
  engineers: { id: string; name: string; costRate: number; sellRateMin: number }[];
  projects: { id: string; title: string; clientName: string }[];
  defaultEngineerId?: string;
  defaultProjectId?: string;
}) {
  const [sell, setSell] = useState(assignment?.sellRate ?? 0);
  const [cost, setCost] = useState(assignment?.costRate ?? 0);
  const { profit, rate } = calcMargin(sell, cost);

  return (
    <form action={saveAssignment} className="space-y-5">
      {assignment && <input type="hidden" name="id" value={assignment.id} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="技術者" required>
          <Select
            name="engineerId"
            required
            defaultValue={assignment?.engineerId || defaultEngineerId || ""}
            onChange={(e) => {
              const eng = engineers.find((x) => x.id === e.target.value);
              if (eng) setCost(eng.costRate);
            }}
          >
            <option value="">選択してください</option>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="案件" required>
          <Select
            name="projectId"
            required
            defaultValue={assignment?.projectId || defaultProjectId || ""}
          >
            <option value="">選択してください</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.clientName}／{p.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ステータス" required>
          <Select name="status" defaultValue={assignment?.status || "PROPOSED"}>
            <Options map={AssignmentStatusLabel} />
          </Select>
        </Field>
        <div />
        <Field label="客先請求単価（月額・円）" required>
          <Input
            type="number"
            name="sellRate"
            min={0}
            step={10000}
            value={sell}
            onChange={(e) => setSell(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="原価単価（月額・円）" required>
          <Input
            type="number"
            name="costRate"
            min={0}
            step={10000}
            value={cost}
            onChange={(e) => setCost(Number(e.target.value) || 0)}
          />
        </Field>
      </div>

      {/* 粗利ライブプレビュー */}
      <div
        className={`rounded-lg px-4 py-3 text-sm flex items-center gap-4 ${
          profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        }`}
      >
        <span>想定粗利：<strong>{yen(profit)}</strong></span>
        <span>粗利率：<strong>{rate}%</strong></span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="参画開始日">
          <Input type="date" name="startOn" defaultValue={toDateInputValue(assignment?.startOn)} />
        </Field>
        <Field label="参画終了日">
          <Input type="date" name="endOn" defaultValue={toDateInputValue(assignment?.endOn)} />
        </Field>
        <Field label="精算下限（h）">
          <Input type="number" name="standardHoursMin" min={0} defaultValue={assignment?.standardHoursMin ?? 140} />
        </Field>
        <Field label="精算上限（h）">
          <Input type="number" name="standardHoursMax" min={0} defaultValue={assignment?.standardHoursMax ?? 180} />
        </Field>
      </div>

      <Field label="備考">
        <Textarea name="note" rows={2} defaultValue={assignment?.note || ""} />
      </Field>

      <div className="flex gap-2 pt-2">
        <SubmitButton>{assignment ? "更新する" : "アサインする"}</SubmitButton>
        <LinkButton href="/assignments" variant="ghost">
          キャンセル
        </LinkButton>
      </div>
    </form>
  );
}
