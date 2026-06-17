"use client";

import { useState } from "react";
import { saveContract } from "@/lib/actions";
import { Field, Input, Textarea, Select, Options, SubmitButton } from "@/components/form";
import {
  ContractTypeLabel,
  ContractStatusLabel,
  SettlementTypeLabel,
  SettlementMethodLabel,
  RateTypeLabel,
} from "@/lib/enums";
import { settlementHours, computeRates } from "@/lib/settlement";
import { yen, toDateInputValue } from "@/lib/utils";
import { LinkButton } from "@/components/ui";

type ContractData = {
  id: string;
  assignmentId: string;
  contractNo: string;
  contractType: string;
  signedOn: Date | null;
  startOn: Date | null;
  endOn: Date | null;
  autoRenew: boolean;
  status: string;
  note: string | null;
  rateType: string;
  monthlyRate: number;
  engineerRate: number | null;
  engineerRateType: string;
  settlementType: string;
  lowerHours: number | null;
  upperHours: number | null;
  fixedHours: number | null;
  dailyStdHours: number | null;
  bufferHours: number | null;
  settlementMethod: string;
  deductionRate: number | null;
  excessRate: number | null;
};

export default function ContractForm({
  contract,
  assignments,
  defaultAssignmentId,
}: {
  contract?: ContractData;
  assignments: { id: string; label: string }[];
  defaultAssignmentId?: string;
}) {
  const [rateType, setRateType] = useState(contract?.rateType || "MONTHLY");
  const [engineerRateType, setEngineerRateType] = useState(contract?.engineerRateType || "HOURLY");
  const [monthlyRate, setMonthlyRate] = useState(contract?.monthlyRate ?? 0);
  const [engineerRate, setEngineerRate] = useState<number | "">(contract?.engineerRate ?? "");
  const [settlementType, setSettlementType] = useState(contract?.settlementType || "RANGE");
  const isHourly = rateType === "HOURLY";
  // 提示額の単位（時給契約のときだけ月額/時給を選べる。月額契約は常に月額）
  const presentedHourly = isHourly && engineerRateType === "HOURLY";
  const [settlementMethod, setSettlementMethod] = useState(contract?.settlementMethod || "MIDDLE");
  const [lowerHours, setLowerHours] = useState<number | "">(contract?.lowerHours ?? 140);
  const [upperHours, setUpperHours] = useState<number | "">(contract?.upperHours ?? 180);
  const [fixedHours, setFixedHours] = useState<number | "">(contract?.fixedHours ?? "");
  const [dailyStdHours, setDailyStdHours] = useState<number | "">(contract?.dailyStdHours ?? 8);
  const [bufferHours, setBufferHours] = useState<number | "">(contract?.bufferHours ?? 20);

  // プレビュー算出（実単価ベース）
  const input = {
    settlementType,
    lowerHours: num(lowerHours),
    upperHours: num(upperHours),
    fixedHours: num(fixedHours),
    dailyStdHours: num(dailyStdHours),
    bufferHours: num(bufferHours),
    settlementMethod,
    deductionRate: null,
    excessRate: null,
  };
  const hours = settlementHours(input);
  const previewRates = computeRates(input, monthlyRate || 0);

  return (
    <form action={saveContract} className="space-y-6">
      {contract && <input type="hidden" name="id" value={contract.id} />}

      {/* 基本 */}
      <section className="space-y-4">
        <h3 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-1">基本情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="対象アサイン" required>
            <Select name="assignmentId" required defaultValue={contract?.assignmentId || defaultAssignmentId || ""}>
              <option value="">選択してください</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="契約番号" required>
            <Input name="contractNo" required defaultValue={contract?.contractNo} placeholder="CT-2026-001" />
          </Field>
          <Field label="契約形態" required>
            <Select name="contractType" defaultValue={contract?.contractType || "QUASI_MANDATE"}>
              <Options map={ContractTypeLabel} />
            </Select>
          </Field>
          <Field label="ステータス" required>
            <Select name="status" defaultValue={contract?.status || "DRAFT"}>
              <Options map={ContractStatusLabel} />
            </Select>
          </Field>
          <Field label="契約開始日">
            <Input type="date" name="startOn" defaultValue={toDateInputValue(contract?.startOn)} />
          </Field>
          <Field label="契約終了日">
            <Input type="date" name="endOn" defaultValue={toDateInputValue(contract?.endOn)} />
          </Field>
          <Field label="締結日">
            <Input type="date" name="signedOn" defaultValue={toDateInputValue(contract?.signedOn)} />
          </Field>
          <Field label="自動更新">
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" name="autoRenew" defaultChecked={contract?.autoRenew ?? true} className="w-4 h-4" />
              自動更新あり
            </label>
          </Field>
        </div>
      </section>

      {/* 単価 */}
      <section className="space-y-4">
        <h3 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-1">単価</h3>
        <Field label="単価区分" required hint="時給を選ぶと「実働時間 × 時給」で月額を自動計算します（精算幅・控除/超過なし）">
          <Select name="rateType" value={rateType} onChange={(e) => setRateType(e.target.value)}>
            <Options map={RateTypeLabel} />
          </Select>
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label={isHourly ? "契約時給（円/時間・実単価）" : "契約単価（実単価・月額）"}
            required
            hint="客先との契約上の単価。スタッフのみ閲覧"
          >
            <Input
              type="number" name="monthlyRate" min={0} step={isHourly ? 100 : 10000}
              value={monthlyRate} onChange={(e) => setMonthlyRate(Number(e.target.value) || 0)}
            />
          </Field>
          {isHourly ? (
            <Field label="エンジニアへの提示額の単位" hint="時給契約でも本人へは月額で提示できます">
              <Select
                name="engineerRateType"
                value={engineerRateType}
                onChange={(e) => setEngineerRateType(e.target.value)}
              >
                <Options map={RateTypeLabel} />
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="engineerRateType" value="MONTHLY" />
          )}
          <Field
            label={presentedHourly ? "エンジニア提示時給（円/時間）" : "エンジニア提示単価（月額）"}
            hint="本人に見せる金額。実単価と分けたい場合に入力（空欄なら本人に単価非表示）"
          >
            <Input
              type="number" name="engineerRate" min={0} step={presentedHourly ? 100 : 10000}
              value={engineerRate} onChange={(e) => setEngineerRate(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder={presentedHourly ? "例: 4200" : "例: 700000"}
            />
          </Field>
        </div>
      </section>

      {isHourly && (
        <div className="rounded-lg bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          時給契約のため、精算幅・控除/超過の設定は不要です。月額は「実働時間 × 時給」で自動計算されます。
        </div>
      )}

      {/* 精算条件（時給契約では非表示） */}
      <section className={`space-y-4 ${isHourly ? "hidden" : ""}`}>
        <h3 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-1">精算条件</h3>
        <Field label="精算タイプ" required>
          <Select name="settlementType" value={settlementType} onChange={(e) => setSettlementType(e.target.value)}>
            <Options map={SettlementTypeLabel} />
          </Select>
        </Field>

        {settlementType === "RANGE" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="精算下限（時間/月）" required>
              <Input type="number" name="lowerHours" min={0} required={!isHourly} value={lowerHours}
                onChange={(e) => setLowerHours(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <Field label="精算上限（時間/月）" required>
              <Input type="number" name="upperHours" min={0} required={!isHourly} value={upperHours}
                onChange={(e) => setUpperHours(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
          </div>
        )}

        {settlementType === "FIXED" && (
          <Field label="固定基準時間（時間/月）" hint="精算する場合の基準時間。空欄なら完全固定（精算なし）">
            <Input type="number" name="fixedHours" min={0} value={fixedHours}
              onChange={(e) => setFixedHours(e.target.value === "" ? "" : Number(e.target.value))} placeholder="160" />
          </Field>
        )}

        {settlementType === "BUSINESSDAY_BUFFER" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="1日の標準稼働時間（h）" required>
              <Input type="number" name="dailyStdHours" min={0} step={0.5} required={!isHourly} value={dailyStdHours}
                onChange={(e) => setDailyStdHours(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <Field label="バッファ（±時間）" required hint="例: ±20時間">
              <Input type="number" name="bufferHours" min={0} required={!isHourly} value={bufferHours}
                onChange={(e) => setBufferHours(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
          </div>
        )}
        {/* タイプ非選択時も値を維持するため hidden で送信 */}
        {settlementType !== "RANGE" && (
          <>
            <input type="hidden" name="lowerHours" value={lowerHours} />
            <input type="hidden" name="upperHours" value={upperHours} />
          </>
        )}
        {settlementType !== "FIXED" && <input type="hidden" name="fixedHours" value={fixedHours} />}
        {settlementType !== "BUSINESSDAY_BUFFER" && (
          <>
            <input type="hidden" name="dailyStdHours" value={dailyStdHours} />
            <input type="hidden" name="bufferHours" value={bufferHours} />
          </>
        )}
      </section>

      {/* 控除・超過（時給契約では非表示） */}
      <section className={`space-y-4 ${isHourly ? "hidden" : ""}`}>
        <h3 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-1">控除・超過単価</h3>
        <Field label="精算方式" required>
          <Select name="settlementMethod" value={settlementMethod} onChange={(e) => setSettlementMethod(e.target.value)}>
            <Options map={SettlementMethodLabel} />
          </Select>
        </Field>

        {settlementMethod === "MANUAL" ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="控除単価（円/時間）" required>
              <Input type="number" name="deductionRate" min={0} step={100} required={!isHourly} defaultValue={contract?.deductionRate ?? ""} placeholder="3500" />
            </Field>
            <Field label="超過単価（円/時間）" required>
              <Input type="number" name="excessRate" min={0} step={100} required={!isHourly} defaultValue={contract?.excessRate ?? ""} placeholder="3000" />
            </Field>
          </div>
        ) : (
          <>
            <input type="hidden" name="deductionRate" value="" />
            <input type="hidden" name="excessRate" value="" />
            {settlementMethod !== "NONE" && (
              <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                <div className="font-medium mb-1">自動算出プレビュー（実単価 {yen(monthlyRate)} 基準）</div>
                <div>精算幅: {hours.lower ?? "—"}〜{hours.upper ?? "—"}h（中央 {hours.mid ?? "—"}h）</div>
                <div className="flex gap-6 mt-1">
                  <span>控除単価: <strong>{previewRates.deduction != null ? yen(previewRates.deduction) : "—"}/h</strong></span>
                  <span>超過単価: <strong>{previewRates.excess != null ? yen(previewRates.excess) : "—"}/h</strong></span>
                </div>
                {hours.dynamic && (
                  <div className="text-xs text-indigo-600 mt-1">※ 営業日数で変動。上記は20営業日換算の目安</div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <Field label="備考">
        <Textarea name="note" rows={2} defaultValue={contract?.note || ""} />
      </Field>

      <div className="flex gap-2 pt-2">
        <SubmitButton>{contract ? "更新する" : "作成する"}</SubmitButton>
        <LinkButton href="/contracts" variant="ghost">
          キャンセル
        </LinkButton>
      </div>
    </form>
  );
}

function num(v: number | ""): number | null {
  return v === "" ? null : v;
}
