import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { yen } from "@/lib/utils";
import { PageHeader, Card, Badge, LinkButton, EmptyState, Table, Th, Td } from "@/components/ui";
import {
  EngineerStatusLabel,
  EngineerStatusColor,
  EmploymentTypeLabel,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function EngineersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const where: Record<string, unknown> = {};
  if (sp.status) where.status = sp.status;
  if (sp.q)
    where.OR = [
      { name: { contains: sp.q } },
      { code: { contains: sp.q } },
      { affiliation: { contains: sp.q } },
    ];

  const engineers = await prisma.engineer.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { skills: { include: { skill: true } } },
  });

  const statusTabs = [
    { key: "", label: "すべて" },
    { key: "AVAILABLE", label: "待機中" },
    { key: "ASSIGNED", label: "稼働中" },
    { key: "PARTIAL", label: "一部稼働" },
    { key: "LEAVING", label: "退場予定" },
  ];

  return (
    <div>
      <PageHeader
        title="技術者管理"
        subtitle={`在籍・協力会社要員 ${engineers.length} 名`}
        action={<LinkButton href="/engineers/new">＋ 技術者を登録</LinkButton>}
      />

      <Card className="p-4 mb-4">
        <form className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {statusTabs.map((t) => (
              <Link
                key={t.key}
                href={t.key ? `/engineers?status=${t.key}` : "/engineers"}
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
          <input
            name="q"
            defaultValue={sp.q || ""}
            placeholder="氏名・要員番号・所属で検索"
            className="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm w-64"
          />
          <button className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm">
            検索
          </button>
        </form>
      </Card>

      <Card>
        {engineers.length === 0 ? (
          <EmptyState message="技術者が登録されていません" hint="右上の「技術者を登録」から追加できます" />
        ) : (
          <Table
            head={
              <>
                <Th>要員番号</Th>
                <Th>氏名</Th>
                <Th>区分</Th>
                <Th>所属</Th>
                <Th>ステータス</Th>
                <Th>経験</Th>
                <Th className="text-right">提示単価</Th>
                <Th>主要スキル</Th>
              </>
            }
          >
            {engineers.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <Td className="text-gray-500 font-mono text-xs">{e.code}</Td>
                <Td>
                  <Link href={`/engineers/${e.id}`} className="font-medium text-indigo-600 hover:underline">
                    {e.name}
                  </Link>
                  {e.nameKana && <div className="text-xs text-gray-400">{e.nameKana}</div>}
                </Td>
                <Td className="text-gray-600">{EmploymentTypeLabel[e.employmentType]}</Td>
                <Td className="text-gray-600">{e.affiliation || "—"}</Td>
                <Td>
                  <Badge className={EngineerStatusColor[e.status]}>
                    {EngineerStatusLabel[e.status]}
                  </Badge>
                </Td>
                <Td className="text-gray-600">{e.experienceYears}年</Td>
                <Td className="text-right text-gray-700">{yen(e.sellRateMin)}〜</Td>
                <Td>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {e.skills.slice(0, 4).map((s) => (
                      <Badge key={s.id} className="bg-slate-100 text-slate-600">
                        {s.skill.name}
                      </Badge>
                    ))}
                    {e.skills.length > 4 && (
                      <span className="text-xs text-gray-400">+{e.skills.length - 4}</span>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
