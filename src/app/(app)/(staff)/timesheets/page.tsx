import Link from "next/link";
import { prisma } from "@/lib/db";
import { saveTimesheet } from "@/lib/actions";
import { currentYearMonth, formatYearMonth, yen } from "@/lib/utils";
import {
  monthlyRange,
  calcMonthlySettlement,
  type SettlementInput,
} from "@/lib/settlement";
import { PageHeader, Card, Badge, EmptyState, Table, Th, Td } from "@/components/ui";
import { TimesheetStatusLabel } from "@/lib/enums";
import MonthPicker from "./MonthPicker";

export const dynamic = "force-dynamic";

const settlementBadge: Record<string, { label: string; cls: string }> = {
  within: { label: "範囲内", cls: "bg-emerald-100 text-emerald-700" },
  deduct: { label: "控除", cls: "bg-orange-100 text-orange-700" },
  excess: { label: "超過", cls: "bg-sky-100 text-sky-700" },
  none: { label: "精算なし", cls: "bg-gray-100 text-gray-500" },
  hourly: { label: "時給精算", cls: "bg-violet-100 text-violet-700" },
};

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const sp = await searchParams;
  const ym = sp.ym || currentYearMonth();

  const assignments = await prisma.assignment.findMany({
    where: { status: { in: ["ACTIVE", "ORDERED", "ENDED"] } },
    orderBy: { engineer: { name: "asc" } },
    include: {
      engineer: true,
      project: { include: { client: true } },
      contract: true,
      timesheets: { where: { yearMonth: ym } },
    },
  });

  const businessDays = monthlyRange(
    { settlementType: "RANGE", lowerHours: 0, upperHours: 0, fixedHours: null, dailyStdHours: null, bufferHours: null, settlementMethod: "MIDDLE", deductionRate: null, excessRate: null },
    ym
  ).businessDays;

  const totalHours = assignments.reduce((s, a) => s + (a.timesheets[0]?.workedHours || 0), 0);
  const submitted = assignments.filter((a) => a.timesheets[0]).length;

  // 当月精算額合計（実単価ベース）
  let totalSettlement = 0;
  for (const a of assignments) {
    const ts = a.timesheets[0];
    if (ts && a.contract) {
      totalSettlement += calcMonthlySettlement(a.contract as SettlementInput, {
        yearMonth: ym,
        workedHours: ts.workedHours,
        baseRate: a.contract.monthlyRate,
      }).amount;
    }
  }

  return (
    <div>
      <PageHeader
        title="工数・稼働実績／月次精算"
        subtitle={`${formatYearMonth(ym)}　実営業日数 ${businessDays}日・稼働 ${assignments.length}名・入力済 ${submitted}/${assignments.length}・精算額合計(実) ${yen(totalSettlement)}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/timesheets/import"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              📥 勤務表をアップロード取込
            </Link>
            <MonthPicker value={ym} />
          </div>
        }
      />
      <Card>
        {assignments.length === 0 ? (
          <EmptyState message="稼働中のアサインがありません" hint="アサインを「稼働中」にすると工数入力できます" />
        ) : (
          <Table
            head={
              <>
                <Th>技術者</Th>
                <Th>案件 / 取引先</Th>
                <Th>当月精算幅</Th>
                <Th>稼働時間入力</Th>
                <Th className="text-right">精算額（実単価）</Th>
              </>
            }
          >
            {assignments.map((a) => {
              const ts = a.timesheets[0];
              const c = a.contract;
              const range = c ? monthlyRange(c as SettlementInput, ym) : null;
              const settlement =
                c && ts
                  ? calcMonthlySettlement(c as SettlementInput, {
                      yearMonth: ym,
                      workedHours: ts.workedHours,
                      baseRate: c.monthlyRate,
                    })
                  : null;
              return (
                <tr key={a.id} className="hover:bg-gray-50 align-top">
                  <Td className="font-medium">{a.engineer.name}</Td>
                  <Td>
                    <div className="text-gray-800">{a.project.title}</div>
                    <div className="text-xs text-gray-400">{a.project.client.name}</div>
                  </Td>
                  <Td className="text-xs text-gray-600">
                    {!c ? (
                      <span className="text-gray-400">契約未登録</span>
                    ) : c.rateType === "HOURLY" ? (
                      <span className="text-violet-600">時給精算（{yen(c.monthlyRate)}/h）</span>
                    ) : range && range.lower != null && range.upper != null ? (
                      <>
                        <div>{range.lower}〜{range.upper}h</div>
                        {range.standard != null && (
                          <div className="text-gray-400">基準 {range.standard}h</div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">固定（精算なし）</span>
                    )}
                  </Td>
                  <Td>
                    <form action={saveTimesheet} className="flex items-center gap-2">
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <input type="hidden" name="yearMonth" value={ym} />
                      <input
                        type="number" name="workedHours" step="0.5" min="0"
                        defaultValue={ts?.workedHours ?? ""} placeholder="h"
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right"
                      />
                      <select
                        name="status" defaultValue={ts?.status || "DRAFT"}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
                      >
                        {Object.entries(TimesheetStatusLabel).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <button className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">
                        保存
                      </button>
                    </form>
                  </Td>
                  <Td className="text-right">
                    {!settlement ? (
                      <span className="text-xs text-gray-400">{ts ? "—" : "未入力"}</span>
                    ) : (
                      <>
                        <div className="font-bold text-gray-900">{yen(settlement.amount)}</div>
                        <div className="mt-0.5">
                          <Badge className={settlementBadge[settlement.status].cls}>
                            {settlementBadge[settlement.status].label}
                          </Badge>
                        </div>
                        {(settlement.status === "deduct" || settlement.status === "excess") && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {settlement.status === "deduct" ? "不足" : "超過"} {settlement.diffHours}h ×{" "}
                            {yen(settlement.unitRate || 0)} = {yen(settlement.adjustment)}
                          </div>
                        )}
                        {settlement.status === "hourly" && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {yen(settlement.unitRate || 0)}/h × {settlement.workedHours}h
                          </div>
                        )}
                      </>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <p className="text-xs text-gray-400 mt-3">
        ※ 精算額は契約の精算条件・当月の実営業日数（土日祝を除く）と稼働時間から自動計算しています。控除は不足時間、超過は超過時間に各単価を乗じて算定します。
      </p>
    </div>
  );
}
