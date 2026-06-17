import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatDate, yen } from "@/lib/utils";
import { deleteClient, saveActivity } from "@/lib/actions";
import { PageHeader, Card, Badge, LinkButton, Table, Th, Td } from "@/components/ui";
import { Field, Input, Textarea, Select, Options, SubmitButton } from "@/components/form";
import {
  ClientTypeLabel,
  ActivityTypeLabel,
  ProjectStatusLabel,
  ProjectStatusColor,
} from "@/lib/enums";
import { toDateInputValue } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: { updatedAt: "desc" } },
      activities: { orderBy: { activityDate: "desc" } },
    },
  });
  if (!client) notFound();

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={client.name}
        subtitle={`${ClientTypeLabel[client.clientType]}　${client.address || ""}`}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/clients/${client.id}/edit`} variant="ghost">
              編集
            </LinkButton>
            <form action={deleteClient}>
              <input type="hidden" name="id" value={client.id} />
              <button className="px-4 py-2 rounded-lg text-sm text-rose-600 border border-rose-200 hover:bg-rose-50">
                削除
              </button>
            </form>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">担当者</div>
          <div className="font-medium">{client.contactName || "—"}</div>
          <div className="text-sm text-gray-500">{client.contactEmail}</div>
          <div className="text-sm text-gray-500">{client.contactPhone}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">締め日</div>
          <div className="font-medium">
            {client.closingDay === 31 ? "月末締め" : `${client.closingDay}日締め`}
          </div>
          <div className="text-sm text-gray-500 mt-3 mb-1">支払サイト</div>
          <div className="font-medium">{client.paymentTermDays}日</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-gray-500 mb-1">案件数</div>
          <div className="text-2xl font-bold text-indigo-600">{client.projects.length}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 案件 */}
        <Card>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">案件一覧</h2>
            <Link href="/projects/new" className="text-xs text-indigo-600 hover:underline">
              ＋ 案件を追加
            </Link>
          </div>
          {client.projects.length === 0 ? (
            <p className="text-sm text-gray-400 p-8 text-center">案件はありません</p>
          ) : (
            <Table head={<><Th>案件</Th><Th>状態</Th><Th className="text-right">単価</Th></>}>
              {client.projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <Td>
                    <Link href={`/projects/${p.id}`} className="text-indigo-600 hover:underline">
                      {p.title}
                    </Link>
                  </Td>
                  <Td>
                    <Badge className={ProjectStatusColor[p.status]}>
                      {ProjectStatusLabel[p.status]}
                    </Badge>
                  </Td>
                  <Td className="text-right text-gray-600 text-xs">
                    {yen(p.unitPriceMin)}〜{yen(p.unitPriceMax)}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {/* 営業活動 */}
        <Card>
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">営業活動・商談履歴</h2>
          </div>
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <form action={saveActivity} className="space-y-3">
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="種別">
                  <Select name="type" defaultValue="VISIT">
                    <Options map={ActivityTypeLabel} />
                  </Select>
                </Field>
                <Field label="日付">
                  <Input type="date" name="activityDate" defaultValue={toDateInputValue(new Date())} />
                </Field>
              </div>
              <Field label="件名" required>
                <Input name="subject" required placeholder="次期案件のヒアリング" />
              </Field>
              <Field label="内容">
                <Textarea name="body" rows={2} />
              </Field>
              <SubmitButton>商談を記録</SubmitButton>
            </form>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {client.activities.length === 0 ? (
              <p className="text-sm text-gray-400 p-8 text-center">商談履歴はありません</p>
            ) : (
              client.activities.map((a) => (
                <div key={a.id} className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-sky-100 text-sky-700">{ActivityTypeLabel[a.type]}</Badge>
                    <span className="text-sm font-medium">{a.subject}</span>
                    <span className="ml-auto text-xs text-gray-400">
                      {formatDate(a.activityDate)}
                    </span>
                  </div>
                  {a.body && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
