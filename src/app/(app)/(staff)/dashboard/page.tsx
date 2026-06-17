import Link from "next/link";
import { prisma } from "@/lib/db";
import { yen, manYen, currentYearMonth, formatYearMonth, calcMargin } from "@/lib/utils";
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
} from "@/components/ui";
import {
  EngineerStatusLabel,
  EngineerStatusColor,
  ProjectStatusLabel,
  ProjectStatusColor,
  AssignmentStatusLabel,
  AssignmentStatusColor,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ym = currentYearMonth();

  const [
    engineers,
    activeAssignments,
    openProjects,
    invoicesUnpaid,
    recentAssignments,
    leaveIntents,
    pendingOfferCount,
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

      {/* 離脱希望・未回答オファー アラート */}
      {(leaveIntents.length > 0 || pendingOfferCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
              <h2 className="font-bold text-gray-900 text-sm">📨 回答待ちの案件オファー</h2>
              <Link href="/offers" className="text-xs text-indigo-600 hover:underline">
                一覧へ →
              </Link>
            </div>
            <div className="text-3xl font-bold text-blue-600 mt-2">{pendingOfferCount} 件</div>
            <p className="text-xs text-gray-400 mt-1">エンジニアの回答を待っています</p>
          </Card>
        </div>
      )}

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
