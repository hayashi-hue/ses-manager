import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  yen,
  manYen,
  yenWithUnit,
  formatDate,
  currentYearMonth,
  formatYearMonth,
  calcMargin,
} from "@/lib/utils";
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  Table,
  Th,
  Td,
} from "@/components/ui";
import {
  EngineerStatusLabel,
  EngineerStatusColor,
  ProjectStatusLabel,
  ProjectStatusColor,
  AssignmentStatusLabel,
  AssignmentStatusColor,
} from "@/lib/enums";
import {
  statutoryAnnualLeaveDays,
  paidLeaveDaysTaken,
  overtimeHours,
  staleRateForEngineer,
  type RateContractInput,
  type StaleRate,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ym = currentYearMonth();
  const now = new Date();
  // 直近1年の起点（有給取得率・平均残業の集計範囲）
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const ymFrom = `${oneYearAgo.getFullYear()}-${String(
    oneYearAgo.getMonth() + 1
  ).padStart(2, "0")}`;

  const [
    engineers,
    activeAssignments,
    openProjects,
    invoicesUnpaid,
    recentAssignments,
    leaveIntents,
    pendingOfferCount,
    pendingRequestCount,
    paidLeaves,
    recentTimesheets,
    allContracts,
  ] = await Promise.all([
    prisma.engineer.findMany({ where: { status: { not: "RETIRED" } } }),
    prisma.assignment.findMany({
      where: { status: { in: ["ACTIVE", "ORDERED"] } },
      include: { engineer: true, project: { include: { client: true } } },
    }),
    prisma.project.findMany({ where: { status: { in: ["OPEN", "PROPOSING"] } } }),
    prisma.invoice.findMany({
      where: { status: { in: ["ISSUED", "SENT", "OVERDUE"] } },
    }),
    prisma.assignment.findMany({
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: { engineer: true, project: { include: { client: true } } },
    }),
    prisma.assignment.findMany({
      where: { renewalIntent: "LEAVE", status: { in: ["ACTIVE", "ORDERED"] } },
      include: { engineer: true, project: { include: { client: true } } },
    }),
    prisma.projectOffer.count({ where: { status: "OFFERED" } }),
    prisma.workflowRequest.count({ where: { status: "SUBMITTED" } }),
    // 直近1年に承認された有給休暇（取得実績）
    prisma.workflowRequest.findMany({
      where: {
        type: "PAID_LEAVE",
        status: "APPROVED",
        startDate: { gte: oneYearAgo },
      },
      select: { days: true, hours: true },
    }),
    // 直近12ヶ月の工数（残業集計用）
    prisma.timesheet.findMany({
      where: { yearMonth: { gte: ymFrom }, workedHours: { gt: 0 } },
      select: { workedHours: true, yearMonth: true },
    }),
    // 単価据え置き判定用：全契約＋アサイン・要員・案件
    prisma.contract.findMany({
      include: {
        assignment: {
          include: { engineer: true, project: { include: { client: true } } },
        },
      },
    }),
  ]);

  const totalActive = engineers.length;
  const assigned = engineers.filter((e) => e.status === "ASSIGNED").length;
  const available = engineers.filter(
    (e) => e.status === "AVAILABLE" || e.status === "PARTIAL"
  ).length;
  const utilization = totalActive > 0 ? Math.round((assigned / totalActive) * 100) : 0;

  // 当月の想定売上・原価・粗利（稼働中アサインの月額合計）
  let sellSum = 0;
  let costSum = 0;
  for (const a of activeAssignments) {
    sellSum += a.sellRate;
    costSum += a.costRate;
  }
  const { profit, rate } = calcMargin(sellSum, costSum);
  const unpaidTotal = invoicesUnpaid.reduce((s, i) => s + i.total, 0);

  // 有給取得率（直近1年・法定付与日数ベース）。協力会社(BP)は自社付与対象外として除外
  const grantEngineers = engineers.filter((e) => e.employmentType !== "BP");
  const grantedLeaveDays = grantEngineers.reduce(
    (s, e) => s + statutoryAnnualLeaveDays(e.joinedOn, now),
    0
  );
  const takenLeaveDays = paidLeaves.reduce((s, r) => s + paidLeaveDaysTaken(r), 0);
  const leaveRate =
    grantedLeaveDays > 0
      ? Math.round((takenLeaveDays / grantedLeaveDays) * 1000) / 10
      : 0;

  // 平均残業時間（直近12ヶ月・1人月あたり。所定=営業日数×8時間）
  const totalOvertime = recentTimesheets.reduce(
    (s, t) => s + overtimeHours(t.workedHours, t.yearMonth),
    0
  );
  const avgOvertime =
    recentTimesheets.length > 0
      ? Math.round((totalOvertime / recentTimesheets.length) * 10) / 10
      : 0;

  // 平均単価（稼働中アサインの客先請求単価・月額）
  const sellRates = activeAssignments.filter((a) => a.sellRate > 0);
  const avgSellRate =
    sellRates.length > 0
      ? Math.round(sellRates.reduce((s, a) => s + a.sellRate, 0) / sellRates.length)
      : 0;

  // 単価据え置き（実単価が6ヶ月以上変わっていない要員）。要員ごとに契約タイムラインから判定
  const byEngineer = new Map<
    string,
    { engineer: (typeof engineers)[number]; items: RateContractInput[] }
  >();
  for (const c of allContracts) {
    const a = c.assignment;
    const e = a?.engineer;
    if (!e || e.status === "RETIRED") continue;
    const entry = byEngineer.get(e.id) ?? { engineer: e, items: [] };
    entry.items.push({
      contractId: c.id,
      monthlyRate: c.monthlyRate,
      engineerRate: c.engineerRate,
      rateType: c.rateType,
      startOn: c.startOn,
      signedOn: c.signedOn,
      createdAt: c.createdAt,
      active: a.status === "ACTIVE" || a.status === "ORDERED",
      clientName: a.project?.client?.name ?? "—",
      projectTitle: a.project?.title ?? "—",
    });
    byEngineer.set(e.id, entry);
  }
  const staleRates: (StaleRate & { engineer: (typeof engineers)[number] })[] = [];
  for (const { engineer, items } of byEngineer.values()) {
    const r = staleRateForEngineer(items, now, 6);
    if (r) staleRates.push({ ...r, engineer });
  }
  staleRates.sort((a, b) => b.monthsHeld - a.monthsHeld);

  return (
    <div>
      <PageHeader
        title="ダッシュボード"
        subtitle={`${formatYearMonth(ym)} 時点の経営サマリー`}
      />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="稼働率"
          value={`${utilization}%`}
          sub={`稼働 ${assigned} / 在籍 ${totalActive} 名`}
          accent={utilization >= 80 ? "text-emerald-600" : "text-amber-600"}
          icon="📈"
        />
        <StatCard
          label="待機要員"
          value={`${available} 名`}
          sub="早期アサインが必要"
          accent={available > 0 ? "text-amber-600" : "text-emerald-600"}
          icon="🧑‍💻"
        />
        <StatCard
          label="当月想定売上"
          value={manYen(sellSum)}
          sub={`粗利 ${manYen(profit)}（${rate}%）`}
          accent="text-indigo-600"
          icon="💴"
        />
        <StatCard
          label="未入金請求"
          value={yen(unpaidTotal)}
          sub={`${invoicesUnpaid.length} 件`}
          accent={unpaidTotal > 0 ? "text-rose-600" : "text-emerald-600"}
          icon="🧾"
        />
      </div>

      {/* 追加KPI: 有給取得率・平均残業時間・平均単価 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="有給取得率"
          value={`${leaveRate}%`}
          sub={`取得 ${Math.round(takenLeaveDays * 10) / 10}日 / 付与 ${grantedLeaveDays}日（直近1年・法定付与基準）`}
          accent={leaveRate >= 50 ? "text-emerald-600" : "text-amber-600"}
          icon="🏖️"
        />
        <StatCard
          label="平均残業時間"
          value={`${avgOvertime} h`}
          sub="直近12ヶ月・1人月あたり（所定8h/日換算）"
          accent={
            avgOvertime <= 20
              ? "text-emerald-600"
              : avgOvertime <= 45
                ? "text-amber-600"
                : "text-rose-600"
          }
          icon="⏱️"
        />
        <StatCard
          label="平均単価"
          value={manYen(avgSellRate)}
          sub={`稼働中 ${sellRates.length} 名の客先請求単価（月額）`}
          accent="text-indigo-600"
          icon="💹"
        />
      </div>

      {/* 離脱希望・未回答提案・承認待ち申請 アラート */}
      {(leaveIntents.length > 0 || pendingOfferCount > 0 || pendingRequestCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-5 border-l-4 border-l-orange-400">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-900 text-sm">
                🚪 離脱を希望している要員
                {leaveIntents.length > 0 && (
                  <Badge className="ml-2 bg-orange-100 text-orange-700">{leaveIntents.length} 名</Badge>
                )}
              </h2>
            </div>
            {leaveIntents.length === 0 ? (
              <p className="text-sm text-gray-400">離脱希望はありません</p>
            ) : (
              <div className="space-y-1">
                {leaveIntents.map((a) => (
                  <Link
                    key={a.id}
                    href={`/engineers/${a.engineerId}`}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-800">{a.engineer.name}</span>
                    <span className="text-xs text-gray-400">{a.project.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-5 border-l-4 border-l-blue-400">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-sm">📨 回答待ちの提案案件</h2>
              <Link href="/offers" className="text-xs text-indigo-600 hover:underline">
                一覧へ →
              </Link>
            </div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{pendingOfferCount} 件</div>
            <p className="text-xs text-gray-400 mt-1">エンジニアの回答を待っています</p>
          </Card>
          <Card className="p-5 border-l-4 border-l-amber-400">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-sm">📋 承認待ちの申請</h2>
              <Link href="/workflows?status=SUBMITTED" className="text-xs text-indigo-600 hover:underline">
                一覧へ →
              </Link>
            </div>
            <div className="text-3xl font-bold text-amber-600 mt-2">{pendingRequestCount} 件</div>
            <p className="text-xs text-gray-400 mt-1">交通費・休暇などの承認待ち</p>
          </Card>
        </div>
      )}

      {/* 単価据え置き（実単価が半年以上変わっていない要員） */}
      <Card className="p-5 mb-6 border-l-4 border-l-rose-400">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 text-sm">
            💰 単価が半年以上変わっていない要員
            {staleRates.length > 0 && (
              <Badge className="ml-2 bg-rose-100 text-rose-700">
                {staleRates.length} 名
              </Badge>
            )}
          </h2>
          <Link href="/contracts" className="text-xs text-indigo-600 hover:underline">
            契約一覧へ →
          </Link>
        </div>
        {staleRates.length === 0 ? (
          <p className="text-sm text-gray-400">
            半年以上単価が据え置かれている要員はいません
          </p>
        ) : (
          <Table
            head={
              <>
                <Th>氏名</Th>
                <Th>取引先／案件</Th>
                <Th className="text-right">現在単価（実単価）</Th>
                <Th className="text-right">据え置き</Th>
                <Th>適用開始</Th>
                <Th></Th>
              </>
            }
          >
            {staleRates.map((s) => (
              <tr key={s.contractId} className="hover:bg-gray-50">
                <Td>
                  <Link
                    href={`/engineers/${s.engineer.id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {s.engineer.name}
                  </Link>
                </Td>
                <Td className="text-gray-500 text-xs">
                  {s.clientName}／{s.projectTitle}
                </Td>
                <Td className="text-right">
                  <div className="text-gray-900">
                    {yenWithUnit(s.currentRate, s.rateType)}
                  </div>
                  {s.currentEngineerRate != null && (
                    <div className="text-xs text-blue-500">
                      提示 {yen(s.currentEngineerRate)}
                    </div>
                  )}
                </Td>
                <Td className="text-right">
                  <Badge
                    className={
                      s.monthsHeld >= 12
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700"
                    }
                  >
                    {s.monthsHeld}ヶ月
                  </Badge>
                </Td>
                <Td className="text-gray-500 text-xs">
                  {formatDate(s.unchangedSince)}
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/contracts/${s.contractId}/edit`}
                    className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                  >
                    単価を見直す →
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 待機要員リスト */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">待機・一部稼働の要員</h2>
            <Link href="/engineers" className="text-xs text-indigo-600 hover:underline">
              一覧へ →
            </Link>
          </div>
          <div className="space-y-2">
            {engineers
              .filter((e) => e.status === "AVAILABLE" || e.status === "PARTIAL")
              .slice(0, 8)
              .map((e) => (
                <Link
                  key={e.id}
                  href={`/engineers/${e.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-800">{e.name}</span>
                  <Badge className={EngineerStatusColor[e.status]}>
                    {EngineerStatusLabel[e.status]}
                  </Badge>
                </Link>
              ))}
            {available === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">
                待機要員はいません 🎉
              </p>
            )}
          </div>
        </Card>

        {/* 募集中・提案中の案件 */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">募集中・提案中の案件</h2>
            <Link href="/projects" className="text-xs text-indigo-600 hover:underline">
              一覧へ →
            </Link>
          </div>
          <div className="space-y-2">
            {openProjects.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm text-gray-800 truncate mr-2">{p.title}</span>
                <Badge className={ProjectStatusColor[p.status]}>
                  {ProjectStatusLabel[p.status]}
                </Badge>
              </Link>
            ))}
            {openProjects.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">
                募集中の案件はありません
              </p>
            )}
          </div>
        </Card>

        {/* 直近のアサイン動向 */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">直近のアサイン動向</h2>
            <Link href="/assignments" className="text-xs text-indigo-600 hover:underline">
              一覧へ →
            </Link>
          </div>
          <div className="space-y-2">
            {recentAssignments.map((a) => (
              <div key={a.id} className="px-3 py-2 rounded-lg hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-800">{a.engineer.name}</span>
                  <Badge className={AssignmentStatusColor[a.status]}>
                    {AssignmentStatusLabel[a.status]}
                  </Badge>
                </div>
                <div className="text-xs text-gray-400 mt-0.5 truncate">
                  {a.project.client.name}／{a.project.title}
                </div>
              </div>
            ))}
            {recentAssignments.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">
                アサイン履歴がありません
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
