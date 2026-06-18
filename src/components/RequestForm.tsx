"use client";

import { useState } from "react";
import { createWorkflowRequest } from "@/lib/actions";
import { Field, Input, Select, Textarea, Options, SubmitButton } from "@/components/form";
import { LinkButton } from "@/components/ui";
import { RequestTypeLabel, LeaveUnitLabel } from "@/lib/enums";

type EngineerOpt = { id: string; name: string };
type Row = { from: string; to: string; roundTrip: string; amount: string; note: string; date: string };

const emptyRow = (): Row => ({ from: "", to: "", roundTrip: "0", amount: "", note: "", date: "" });

export default function RequestForm({
  engineers,
  selfName,
  cancelHref,
}: {
  engineers?: EngineerOpt[]; // スタッフの代行申請時に対象者を選択。未指定＝本人申請
  selfName?: string; // 本人申請時の表示名
  cancelHref: string;
}) {
  const isStaff = !!engineers;
  const [type, setType] = useState("TRANSPORT");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [leaveUnit, setLeaveUnit] = useState("FULL");

  const isTransport = type === "TRANSPORT";
  const isExpense = type === "EXPENSE";
  const isCommuter = type === "COMMUTER_PASS";
  const usesRows = isTransport || isExpense;

  const total = rows.reduce((s, r) => s + (parseInt(r.amount || "0", 10) || 0), 0);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const delRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  return (
    <form action={createWorkflowRequest} className="space-y-5">
      {/* 対象者 */}
      {isStaff ? (
        <Field label="対象者（社員）" required hint="代行申請する社員を選択してください">
          <Select name="engineerId" required defaultValue="">
            <option value="">選択してください</option>
            {engineers!.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div className="text-sm text-gray-500">
          申請者: <span className="font-medium text-gray-800">{selfName} さん</span>
        </div>
      )}

      {/* 申請種別 */}
      <Field label="申請種別" required>
        <Select name="type" value={type} onChange={(e) => setType(e.target.value)}>
          <Options map={RequestTypeLabel} />
        </Select>
      </Field>

      {/* ===== 交通費 / 経費（明細行） ===== */}
      {usesRows && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">{isTransport ? "交通費明細（区間ごと）" : "経費明細"}</div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input type="hidden" name="itemDate" value={r.date} />
                <div className="col-span-2">
                  <Input type="date" aria-label="日付" value={r.date} onChange={(e) => setRow(i, { date: e.target.value })} />
                </div>
                {isTransport ? (
                  <>
                    <input type="hidden" name="fromPlace" value={r.from} />
                    <input type="hidden" name="toPlace" value={r.to} />
                    <input type="hidden" name="roundTrip" value={r.roundTrip} />
                    <input type="hidden" name="itemNote" value={r.note} />
                    <div className="col-span-3">
                      <Input placeholder="出発（例: 品川）" value={r.from} onChange={(e) => setRow(i, { from: e.target.value })} />
                    </div>
                    <div className="col-span-3">
                      <Input placeholder="到着（例: 新宿）" value={r.to} onChange={(e) => setRow(i, { to: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <Select value={r.roundTrip} onChange={(e) => setRow(i, { roundTrip: e.target.value })}>
                        <option value="0">片道</option>
                        <option value="1">往復</option>
                      </Select>
                    </div>
                  </>
                ) : (
                  <>
                    <input type="hidden" name="itemNote" value={r.note} />
                    <input type="hidden" name="fromPlace" value="" />
                    <input type="hidden" name="toPlace" value="" />
                    <input type="hidden" name="roundTrip" value="0" />
                    <div className="col-span-6">
                      <Input placeholder="費目・内容（例: 書籍代）" value={r.note} onChange={(e) => setRow(i, { note: e.target.value })} />
                    </div>
                  </>
                )}
                <div className="col-span-1">
                  <input type="hidden" name="itemAmount" value={r.amount} />
                  <Input type="number" min={0} placeholder="円" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
                </div>
                <div className="col-span-1 text-right">
                  <button type="button" onClick={() => delRow(i)} className="text-xs text-gray-400 hover:text-rose-600">
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={addRow} className="text-sm text-indigo-600 hover:underline">
              ＋ 明細を追加
            </button>
            <div className="text-sm text-gray-700">
              合計: <span className="font-bold text-gray-900">¥{total.toLocaleString("ja-JP")}</span>
            </div>
          </div>
          <Field label={isTransport ? "目的・備考" : "備考"}>
            <Textarea name="reason" rows={2} placeholder={isTransport ? "客先訪問のため など" : ""} />
          </Field>
        </div>
      )}

      {/* ===== 定期券 ===== */}
      {isCommuter && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="区間（出発）" required>
              <Input name="fromPlace" required placeholder="例: 品川" />
            </Field>
            <Field label="区間（到着）" required>
              <Input name="toPlace" required placeholder="例: 新宿" />
            </Field>
            <Field label="期間" required>
              <Select name="passPeriodMonths" defaultValue="6">
                <option value="1">1ヶ月</option>
                <option value="3">3ヶ月</option>
                <option value="6">6ヶ月</option>
              </Select>
            </Field>
            <Field label="利用開始日">
              <Input type="date" name="startDate" />
            </Field>
            <Field label="金額（円）" required>
              <Input type="number" name="itemAmount" min={0} required placeholder="例: 45000" />
            </Field>
          </div>
          <input type="hidden" name="itemDate" value="" />
          <input type="hidden" name="roundTrip" value="0" />
          <input type="hidden" name="itemNote" value="定期券" />
          <Field label="備考">
            <Textarea name="reason" rows={2} />
          </Field>
        </div>
      )}

      {/* ===== 有給休暇 ===== */}
      {type === "PAID_LEAVE" && (
        <div className="space-y-4">
          <Field label="取得単位" required>
            <Select name="leaveUnit" value={leaveUnit} onChange={(e) => setLeaveUnit(e.target.value)}>
              <Options map={LeaveUnitLabel} />
            </Select>
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="取得日" required>
              <Input type="date" name="startDate" required />
            </Field>
            {leaveUnit === "FULL" && (
              <Field label="終了日" hint="連続して全休を取る場合のみ（単日は空欄）">
                <Input type="date" name="endDate" />
              </Field>
            )}
            {leaveUnit === "HOURLY" && (
              <Field label="時間数（h）" required>
                <Input type="number" name="hours" min={0} step={0.5} placeholder="例: 2" />
              </Field>
            )}
          </div>
          <Field label="理由・備考">
            <Textarea name="reason" rows={2} />
          </Field>
        </div>
      )}

      {/* ===== 夏季休暇 ===== */}
      {type === "SUMMER_LEAVE" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 text-amber-800 px-4 py-2 text-xs">
            夏季休暇は対象年の6月〜12月に5日付与されます（7/1以降入社の方は当該年付与なし）。残日数を超える申請はできません。
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="開始日" required>
              <Input type="date" name="startDate" required />
            </Field>
            <Field label="終了日">
              <Input type="date" name="endDate" />
            </Field>
            <Field label="取得日数" required hint="半日は0.5">
              <Input type="number" name="days" min={0} step={0.5} defaultValue={1} />
            </Field>
          </div>
          <Field label="備考">
            <Textarea name="reason" rows={2} />
          </Field>
        </div>
      )}

      {/* ===== 慶弔休暇 ===== */}
      {type === "CONDOLENCE_LEAVE" && (
        <div className="space-y-4">
          <Field label="事由" required hint="例: 本人の結婚 / 配偶者の出産 / 父母の死亡 など">
            <Input name="category" required placeholder="例: 父母の死亡（忌引）" />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="開始日" required>
              <Input type="date" name="startDate" required />
            </Field>
            <Field label="終了日">
              <Input type="date" name="endDate" />
            </Field>
            <Field label="取得日数" required>
              <Input type="number" name="days" min={0} step={0.5} defaultValue={1} />
            </Field>
          </div>
          <Field label="備考">
            <Textarea name="reason" rows={2} />
          </Field>
        </div>
      )}

      {/* ===== 健康診断 ===== */}
      {type === "HEALTH_CHECKUP" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="受診日" required>
              <Input type="date" name="startDate" required />
            </Field>
            <Field label="受診機関">
              <Input name="category" placeholder="例: ◯◯クリニック" />
            </Field>
          </div>
          <Field label="備考">
            <Textarea name="reason" rows={2} />
          </Field>
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <SubmitButton>申請する</SubmitButton>
        <LinkButton href={cancelHref} variant="ghost">
          キャンセル
        </LinkButton>
      </div>
    </form>
  );
}
