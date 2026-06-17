import Link from "next/link";
import { prisma } from "@/lib/db";
import { yen, formatDate, calcMargin } from "@/lib/utils";
import { PageHeader, Card, Badge, LinkButton, EmptyState, Table, Th, Td } from "@/components/ui";
import { AssignmentStatusLabel, AssignmentStatusColor } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.status) where.status = sp.status;

  const assignments = await prisma.assignment.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      engineer: true,
      project: { include: { client: true } },
      contract: true,
    },
  });

  const tabs = [
    { key: "", label: "すべて" },
    { key: "PROPOSED", label: "提案" },
    { key: "INTERVIEW", label: "面談" },
    { key: "ORDERED", label: "参画決定" },
    { key: "ACTIVE", label: "稼働中" },
    { key: "ENDED", label: "終了" },
  ];

  // 集計
  const active = assignments.filter((a) => a.status === "ACTIVE" || a.status === "ORDERED");
  const totalSell = active.reduce((s, a) => s + a.sellRate, 0);
  const totalProfit = active.reduce((s, a) => s + (a.sellRate - a.costRate), 0);

  return (
    <div>
      <PageHeader
        title="アサイン・要員配置"
        subtitle={`稼働中 ${active.length} 件・月額売上 ${yen(totalSell)}・月額粗利 ${yen(totalProfit)}`}
        action={<LinkButton href="/assignments/new">＋ アサインを作成</LinkButton>}
      />
      <Card className="p-3 mb-4">
        <div className="flex gap-1 flex-wrap">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key ? `/assignments?status=${t.key}` : "/assignments"}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                (sp.status || "") === t.key
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </Card>
      <Card>
        {assignments.length === 0 ? (
          <EmptyState message="アサインがありません" hint="技術者を案件に割り当てましょう" />
        ) : (
          <Table
            head={
              <>
                <Th>技術者</Th>
                <Th>案件 / 取引先</Th>
                <Th>状態</Th>
                <Th className="text-right">請求/原価</Th>
                <Th className="text-right">粗利</Th>
                <Th>期間</Th>
                <Th className="text-center">契約</Th>
              </>
            }
          >
            {assignments.map((a) => {
              const { profit, rate } = calcMargin(a.sellRate, a.costRate);
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <Td>
                    <Link href={`/assignments/${a.id}`} className="font-medium text-indigo-600 hover:underline">
                      {a.engineer.name}
                    </Link>
                  </Td>
                  <Td>
                    <div className="text-gray-800">{a.project.title}</div>
                    <div className="text-xs text-gray-400">{a.project.client.name}</div>
                  </Td>
                  <Td>
                    <Badge className={AssignmentStatusColor[a.status]}>
                      {AssignmentStatusLabel[a.status]}
                    </Badge>
                  </Td>
                  <Td className="text-right text-xs">
                    <div>{yen(a.sellRate)}</div>
                    <div className="text-gray-400">{yen(a.costRate)}</div>
                  </Td>
                  <Td className="text-right">
                    <div className="text-emerald-600 font-medium">{yen(profit)}</div>
                    <div className="text-xs text-gray-400">{rate}%</div>
                  </Td>
                  <Td className="text-gray-500 text-xs">
                    {formatDate(a.startOn)}〜{formatDate(a.endOn)}
                  </Td>
                  <Td className="text-center">
                    {a.contract ? (
                      <Badge className="bg-emerald-100 text-emerald-700">有</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-400">未</Badge>
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
