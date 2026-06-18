import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge, EmptyState, Table, Th, Td, LinkButton } from "@/components/ui";
import {
  RequestTypeLabel,
  RequestTypeIcon,
  RequestStatusLabel,
  RequestStatusColor,
} from "@/lib/enums";
import { requestSummary } from "@/lib/workflow";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS: { key: string; label: string }[] = [
  { key: "", label: "すべて" },
  { key: "SUBMITTED", label: "承認待ち" },
  { key: "APPROVED", label: "承認" },
  { key: "REJECTED", label: "差戻し" },
  { key: "CANCELLED", label: "取消" },
];

export default async function WorkflowsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; created?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status || "";

  const [requests, pendingCount] = await Promise.all([
    prisma.workflowRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: "desc" },
      include: { engineer: { select: { name: true, code: true } } },
    }),
    prisma.workflowRequest.count({ where: { status: "SUBMITTED" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="申請・承認"
        subtitle={`承認待ち ${pendingCount} 件`}
        action={
          <LinkButton href="/workflows/new">＋ 申請を作成（代行）</LinkButton>
        }
      />

      <Card className="p-2 mb-4 flex items-center gap-1 flex-wrap">
        {TABS.map((t) => {
          const active = status === t.key;
          return (
            <Link
              key={t.key || "all"}
              href={t.key ? `/workflows?status=${t.key}` : "/workflows"}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                active ? "bg-indigo-600 text-white font-medium" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
              {t.key === "SUBMITTED" && pendingCount > 0 && (
                <span className="ml-1 text-xs">({pendingCount})</span>
              )}
            </Link>
          );
        })}
      </Card>

      <Card>
        {requests.length === 0 ? (
          <EmptyState
            message="申請がありません"
            hint="「申請を作成（代行）」から、または社員がマイページから申請できます"
          />
        ) : (
          <Table
            head={
              <>
                <Th>種別</Th>
                <Th>対象者</Th>
                <Th>内容</Th>
                <Th>申請者</Th>
                <Th>状態</Th>
                <Th>申請日</Th>
                <Th></Th>
              </>
            }
          >
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td>
                  <span className="mr-1">{RequestTypeIcon[r.type]}</span>
                  {RequestTypeLabel[r.type]}
                </Td>
                <Td className="text-gray-700">{r.engineer.name}</Td>
                <Td className="text-gray-600">{requestSummary(r)}</Td>
                <Td className="text-xs text-gray-500">{r.submittedByName || "—"}</Td>
                <Td>
                  <Badge className={RequestStatusColor[r.status]}>{RequestStatusLabel[r.status]}</Badge>
                </Td>
                <Td className="text-xs text-gray-400">{formatDate(r.createdAt)}</Td>
                <Td>
                  <Link href={`/workflows/${r.id}`} className="text-xs text-indigo-600 hover:underline">
                    詳細 →
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
