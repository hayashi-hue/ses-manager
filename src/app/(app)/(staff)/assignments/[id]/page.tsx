import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { yen, yenWithUnit, presentedRateUnit, formatDate, calcMargin, formatYearMonth } from "@/lib/utils";
import { deleteAssignment } from "@/lib/actions";
import { settlementHoursText, settlementRatesText, calcMonthlySettlement } from "@/lib/settlement";
import { PageHeader, Card, Badge, LinkButton, Table, Th, Td } from "@/components/ui";
import {
  AssignmentStatusLabel,
  AssignmentStatusColor,
  ContractStatusLabel,
  TimesheetStatusLabel,
  SettlementMethodLabel,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await prisma.assignment.findUnique({
    where: { id },
    include: {
      engineer: true,
      project: { include: { client: true } },
      contract: true,
      timesheets: { orderBy: { yearMonth: "desc" } },
    },
  });
  if (!a) notFound();
  const { profit, rate } = calcMargin(a.sellRate, a.costRate);
  // 契約の控除/超過単価（実単価ベース）
  const staffRates = a.contract
    ? settlementRatesText(a.contract, a.contract.monthlyRate)
    : { deduction: "—", excess: "—", dynamicNote: null };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`${a.engineer.name}　×　${a.project.title}`}
        subtitle={a.project.client.name}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/assignments/${a.id}/edit`} variant="ghost">
              編集
            </LinkButton>
            {!a.contract && (
              <LinkButton href={`/contracts/new?assignmentId=${a.id}`}>＋ 契約を作成</LinkButton>
            )}
            <form action={deleteAssignment}>
              <input type="hidden" name="id" value={a.id} />
              <button className="px-4 py-2 rounded-lg text-sm text-rose-600 border border-rose-200 hover:bg-rose-50">
                削除
              </button>
            </form>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">状態</div>
          <Badge className={AssignmentStatusColor[a.status]}>
            {AssignmentStatusLabel[a.status]}
          </Badge>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">請求 / 原価</div>
          <div className="font-bold">{yen(a.sellRate)}</div>
          <div className="text-xs text-gray-500">原価 {yen(a.costRate)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">月額粗利</div>
          <div className="font-bold text-emerald-600">{yen(profit)}</div>
          <div className="text-xs text-gray-500">{rate}%</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">精算幅</div>
          <div className="font-medium">{a.standardHoursMin}〜{a.standardHoursMax}h</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatDate(a.startOn)}〜{formatDate(a.endOn)}
          </div>
        </Card>
      </div>

      {/* 契約 */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-gray-900">契約</h2>
          {a.contract && (
            <Link href={`/contracts/${a.contract.id}/edit`} className="text-xs text-indigo-600 hover:underline">
              編集
            </Link>
          )}
        </div>
        {a.contract ? (
          <>
            <div className="flex items-center gap-4 text-sm mb-3">
              <span className="font-mono text-gray-600">{a.contract.contractNo}</span>
              <Badge className="bg-emerald-100 text-emerald-700">
                {ContractStatusLabel[a.contract.status]}
              </Badge>
              <span className="text-gray-500">
                {formatDate(a.contract.startOn)}〜{formatDate(a.contract.endOn)}
              </span>
              {a.contract.autoRenew && <Badge className="bg-blue-100 text-blue-700">自動更新</Badge>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t border-gray-100 pt-3">
              <div>
                <div className="text-xs text-gray-400">契約単価（実）</div>
                <div className="font-bold text-gray-900">
                  {yenWithUnit(a.contract.monthlyRate, a.contract.rateType)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">エンジニア提示単価</div>
                <div className="font-medium text-indigo-600">
                  {a.contract.engineerRate != null
                    ? yenWithUnit(a.contract.engineerRate, presentedRateUnit(a.contract))
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">精算条件</div>
                <div className="text-gray-800">{settlementHoursText(a.contract)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">精算方式</div>
                <div className="text-gray-800 text-xs">
                  {SettlementMethodLabel[a.contract.settlementMethod]?.split("（")[0] || a.contract.settlementMethod}
                </div>
              </div>
            </div>
            {a.contract.rateType !== "HOURLY" && a.contract.settlementMethod !== "NONE" && (
              <div className="text-sm text-gray-600 mt-2">
                控除 <strong>{staffRates.deduction}</strong>　超過 <strong>{staffRates.excess}</strong>
                {staffRates.dynamicNote && (
                  <span className="text-xs text-gray-400 ml-2">{staffRates.dynamicNote}</span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">契約は未作成です。</p>
        )}
      </Card>

      {/* 工数 */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">工数実績</h2>
          <Link href="/timesheets" className="text-xs text-indigo-600 hover:underline">
            工数入力へ →
          </Link>
        </div>
        {a.timesheets.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">工数実績がありません</p>
        ) : (
          <Table
            head={
              <>
                <Th>対象月</Th>
                <Th className="text-center">実営業日</Th>
                <Th className="text-right">稼働/基準</Th>
                <Th>状態</Th>
                <Th className="text-right">精算額（実単価）</Th>
              </>
            }
          >
            {a.timesheets.map((t) => {
              const s = a.contract
                ? calcMonthlySettlement(a.contract, {
                    yearMonth: t.yearMonth,
                    workedHours: t.workedHours,
                    baseRate: a.contract.monthlyRate,
                  })
                : null;
              const tagCls =
                s?.status === "deduct"
                  ? "text-orange-600"
                  : s?.status === "excess"
                  ? "text-sky-600"
                  : "text-emerald-600";
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <Td>{formatYearMonth(t.yearMonth)}</Td>
                  <Td className="text-center text-gray-500">{s ? `${s.businessDays}日` : "—"}</Td>
                  <Td className="text-right font-medium">
                    {t.workedHours}h
                    {s?.standard != null && <span className="text-xs text-gray-400"> / {s.standard}h</span>}
                  </Td>
                  <Td>
                    <Badge className="bg-slate-100 text-slate-600">{TimesheetStatusLabel[t.status]}</Badge>
                  </Td>
                  <Td className="text-right">
                    {!s ? (
                      <span className="text-xs text-gray-400">契約未登録</span>
                    ) : (
                      <>
                        <div className="font-bold">{yen(s.amount)}</div>
                        {(s.status === "deduct" || s.status === "excess") && (
                          <div className={`text-xs ${tagCls}`}>
                            {s.status === "deduct" ? "控除" : "超過"} {s.diffHours}h（{yen(s.adjustment)}）
                          </div>
                        )}
                        {s.status === "hourly" && (
                          <div className="text-xs text-violet-600">
                            時給 {yen(s.unitRate || 0)} × {s.workedHours}h
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
    </div>
  );
}
