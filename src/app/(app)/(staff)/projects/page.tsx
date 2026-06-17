import Link from "next/link";
import { prisma } from "@/lib/db";
import { yen, formatDate } from "@/lib/utils";
import { PageHeader, Card, Badge, LinkButton, EmptyState, Table, Th, Td } from "@/components/ui";
import {
  ProjectStatusLabel,
  ProjectStatusColor,
  ContractTypeLabel,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.status) where.status = sp.status;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { client: true, _count: { select: { assignments: true } } },
  });

  const tabs = [
    { key: "", label: "すべて" },
    { key: "OPEN", label: "募集中" },
    { key: "PROPOSING", label: "提案中" },
    { key: "ONGOING", label: "稼働中" },
    { key: "CLOSED", label: "終了" },
  ];

  return (
    <div>
      <PageHeader
        title="案件管理"
        subtitle={`案件 ${projects.length} 件`}
        action={<LinkButton href="/projects/new">＋ 案件を登録</LinkButton>}
      />
      <Card className="p-3 mb-4">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key ? `/projects?status=${t.key}` : "/projects"}
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
        {projects.length === 0 ? (
          <EmptyState message="案件が登録されていません" hint="取引先からの引き合いを案件として登録しましょう" />
        ) : (
          <Table
            head={
              <>
                <Th>案件名</Th>
                <Th>取引先</Th>
                <Th>契約</Th>
                <Th>状態</Th>
                <Th className="text-center">人数</Th>
                <Th className="text-right">想定単価</Th>
                <Th>期間</Th>
              </>
            }
          >
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Td>
                  <Link href={`/projects/${p.id}`} className="font-medium text-indigo-600 hover:underline">
                    {p.title}
                  </Link>
                  <div className="text-xs text-gray-400 font-mono">{p.code}</div>
                </Td>
                <Td className="text-gray-600">{p.client.name}</Td>
                <Td className="text-gray-600 text-xs">{ContractTypeLabel[p.contractType]}</Td>
                <Td>
                  <Badge className={ProjectStatusColor[p.status]}>
                    {ProjectStatusLabel[p.status]}
                  </Badge>
                </Td>
                <Td className="text-center text-gray-700">
                  {p._count.assignments}/{p.requiredCount}
                </Td>
                <Td className="text-right text-gray-700 text-xs">
                  {yen(p.unitPriceMin)}〜{yen(p.unitPriceMax)}
                </Td>
                <Td className="text-gray-500 text-xs">
                  {formatDate(p.startOn)}〜{formatDate(p.endOn)}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
