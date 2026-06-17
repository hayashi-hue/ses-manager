import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { yen, formatDate, calcMargin } from "@/lib/utils";
import { deleteProject } from "@/lib/actions";
import { PageHeader, Card, Badge, LinkButton, Table, Th, Td } from "@/components/ui";
import {
  ProjectStatusLabel,
  ProjectStatusColor,
  ContractTypeLabel,
  AssignmentStatusLabel,
  AssignmentStatusColor,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      assignments: { include: { engineer: true }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!project) notFound();

  const skills = (project.requiredSkills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={project.title}
        subtitle={project.code}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/assignments/new?projectId=${project.id}`}>＋ 要員をアサイン</LinkButton>
            <LinkButton href={`/projects/${project.id}/edit`} variant="ghost">
              編集
            </LinkButton>
            <form action={deleteProject}>
              <input type="hidden" name="id" value={project.id} />
              <button className="px-4 py-2 rounded-lg text-sm text-rose-600 border border-rose-200 hover:bg-rose-50">
                削除
              </button>
            </form>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">取引先</div>
          <Link href={`/clients/${project.clientId}`} className="font-medium text-indigo-600 hover:underline">
            {project.client.name}
          </Link>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">状態 / 契約</div>
          <Badge className={ProjectStatusColor[project.status]}>
            {ProjectStatusLabel[project.status]}
          </Badge>
          <div className="text-xs text-gray-500 mt-2">{ContractTypeLabel[project.contractType]}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">想定単価</div>
          <div className="font-bold text-indigo-600">
            {yen(project.unitPriceMin)}〜{yen(project.unitPriceMax)}
          </div>
          <div className="text-xs text-gray-500 mt-2">必要 {project.requiredCount} 名</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">期間 / 勤務地</div>
          <div className="text-sm">{formatDate(project.startOn)}〜{formatDate(project.endOn)}</div>
          <div className="text-xs text-gray-500 mt-1">{project.workLocation || "—"}</div>
        </Card>
      </div>

      {(skills.length > 0 || project.description) && (
        <Card className="p-5 mb-6">
          {skills.length > 0 && (
            <>
              <h2 className="font-bold text-gray-900 mb-2 text-sm">必須スキル</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {skills.map((s) => (
                  <Badge key={s} className="bg-slate-100 text-slate-700">
                    {s}
                  </Badge>
                ))}
              </div>
            </>
          )}
          {project.description && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.description}</p>
          )}
        </Card>
      )}

      <Card>
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">アサイン中の要員</h2>
        </div>
        {project.assignments.length === 0 ? (
          <p className="text-sm text-gray-400 p-8 text-center">
            まだ要員がアサインされていません
          </p>
        ) : (
          <Table
            head={<><Th>技術者</Th><Th>状態</Th><Th className="text-right">単価/粗利</Th><Th>期間</Th></>}
          >
            {project.assignments.map((a) => {
              const { profit, rate } = calcMargin(a.sellRate, a.costRate);
              return (
                <tr key={a.id} className="hover:bg-gray-50">
                  <Td>
                    <Link href={`/engineers/${a.engineerId}`} className="text-indigo-600 hover:underline">
                      {a.engineer.name}
                    </Link>
                  </Td>
                  <Td>
                    <Badge className={AssignmentStatusColor[a.status]}>
                      {AssignmentStatusLabel[a.status]}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div>{yen(a.sellRate)}</div>
                    <div className="text-xs text-emerald-600">粗利 {yen(profit)}（{rate}%）</div>
                  </Td>
                  <Td className="text-gray-500 text-xs">
                    {formatDate(a.startOn)}〜{formatDate(a.endOn)}
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
