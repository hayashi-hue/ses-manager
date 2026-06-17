import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { yen, formatDate, calcMargin } from "@/lib/utils";
import { deleteEngineer } from "@/lib/actions";
import { PageHeader, Card, Badge, LinkButton, Table, Th, Td } from "@/components/ui";
import {
  EngineerStatusLabel,
  EngineerStatusColor,
  EmploymentTypeLabel,
  AssignmentStatusLabel,
  AssignmentStatusColor,
  SkillCategoryLabel,
  RenewalIntentLabel,
  RenewalIntentColor,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function EngineerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const engineer = await prisma.engineer.findUnique({
    where: { id },
    include: {
      skills: { include: { skill: true } },
      assignments: {
        orderBy: { updatedAt: "desc" },
        include: { project: { include: { client: true } } },
      },
    },
  });
  if (!engineer) notFound();

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={engineer.name}
        subtitle={`${engineer.code}　${EmploymentTypeLabel[engineer.employmentType]}　${
          engineer.affiliation || ""
        }`}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/engineers/${engineer.id}/skillsheet`} variant="ghost">
              📄 スキルシート
            </LinkButton>
            <LinkButton href={`/offers?engineerId=${engineer.id}`}>📨 案件をオファー</LinkButton>
            <LinkButton href={`/engineers/${engineer.id}/edit`} variant="ghost">
              編集
            </LinkButton>
            <form action={deleteEngineer}>
              <input type="hidden" name="id" value={engineer.id} />
              <button className="px-4 py-2 rounded-lg text-sm text-rose-600 border border-rose-200 hover:bg-rose-50">
                削除
              </button>
            </form>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">ステータス</div>
          <Badge className={EngineerStatusColor[engineer.status]}>
            {EngineerStatusLabel[engineer.status]}
          </Badge>
          <div className="text-sm text-gray-500 mt-4 mb-1">経験年数</div>
          <div className="font-medium">{engineer.experienceYears} 年</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">提示単価（下限）</div>
          <div className="text-lg font-bold text-indigo-600">{yen(engineer.sellRateMin)}</div>
          <div className="text-sm text-gray-500 mt-4 mb-1">原価単価</div>
          <div className="font-medium">{yen(engineer.costRate)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">連絡先</div>
          <div className="text-sm">{engineer.email || "—"}</div>
          <div className="text-sm text-gray-500">{engineer.phone || ""}</div>
          <div className="text-sm text-gray-500 mt-4 mb-1">参画日</div>
          <div className="font-medium">{formatDate(engineer.joinedOn)}</div>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="font-bold text-gray-900 mb-3">保有スキル</h2>
        {engineer.skills.length === 0 ? (
          <p className="text-sm text-gray-400">スキル未登録</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {engineer.skills.map((s) => (
              <Badge key={s.id} className="bg-slate-100 text-slate-700">
                {s.skill.name}
                <span className="ml-1 text-slate-400">
                  {SkillCategoryLabel[s.skill.category]}・Lv{s.level}
                </span>
              </Badge>
            ))}
          </div>
        )}
        {engineer.note && (
          <p className="text-sm text-gray-600 mt-4 whitespace-pre-wrap border-t border-gray-100 pt-3">
            {engineer.note}
          </p>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">アサイン履歴</h2>
          <Link href="/assignments/new" className="text-xs text-indigo-600 hover:underline">
            ＋ アサインを追加
          </Link>
        </div>
        {engineer.assignments.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">アサイン履歴はありません</p>
        ) : (
          <Table
            head={
              <>
                <Th>案件</Th>
                <Th>取引先</Th>
                <Th>状態</Th>
                <Th>本人の継続意思</Th>
                <Th className="text-right">単価/粗利</Th>
                <Th>期間</Th>
              </>
            }
          >
            {engineer.assignments.map((a) => {
              const { profit, rate } = calcMargin(a.sellRate, a.costRate);
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <Td>
                    <Link href={`/assignments/${a.id}`} className="text-indigo-600 hover:underline">
                      {a.project.title}
                    </Link>
                  </Td>
                  <Td className="text-gray-600">{a.project.client.name}</Td>
                  <Td>
                    <Badge className={AssignmentStatusColor[a.status]}>
                      {AssignmentStatusLabel[a.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge className={RenewalIntentColor[a.renewalIntent]}>
                      {RenewalIntentLabel[a.renewalIntent]}
                    </Badge>
                    {a.renewalNote && (
                      <div className="text-xs text-gray-400 mt-0.5 max-w-[160px] truncate">
                        {a.renewalNote}
                      </div>
                    )}
                  </Td>
                  <Td className="text-right">
                    <div>{yen(a.sellRate)}</div>
                    <div className="text-xs text-emerald-600">
                      粗利 {yen(profit)}（{rate}%）
                    </div>
                  </Td>
                  <Td className="text-gray-500 text-xs">
                    {formatDate(a.startOn)} 〜 {formatDate(a.endOn)}
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
