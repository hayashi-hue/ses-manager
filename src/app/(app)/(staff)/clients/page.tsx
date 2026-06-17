import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Card, Badge, LinkButton, EmptyState, Table, Th, Td } from "@/components/ui";
import { ClientTypeLabel } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { projects: true, activities: true } } },
  });

  return (
    <div>
      <PageHeader
        title="取引先・営業"
        subtitle={`取引先 ${clients.length} 社`}
        action={<LinkButton href="/clients/new">＋ 取引先を登録</LinkButton>}
      />
      <Card>
        {clients.length === 0 ? (
          <EmptyState message="取引先が登録されていません" hint="エンド・元請・協力会社を登録しましょう" />
        ) : (
          <Table
            head={
              <>
                <Th>取引先名</Th>
                <Th>区分</Th>
                <Th>担当者</Th>
                <Th>締め/支払</Th>
                <Th className="text-center">案件</Th>
                <Th className="text-center">商談</Th>
              </>
            }
          >
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td>
                  <Link href={`/clients/${c.id}`} className="font-medium text-indigo-600 hover:underline">
                    {c.name}
                  </Link>
                  {c.nameKana && <div className="text-xs text-gray-400">{c.nameKana}</div>}
                </Td>
                <Td>
                  <Badge className="bg-slate-100 text-slate-600">{ClientTypeLabel[c.clientType]}</Badge>
                </Td>
                <Td className="text-gray-600">
                  {c.contactName || "—"}
                  {c.contactEmail && <div className="text-xs text-gray-400">{c.contactEmail}</div>}
                </Td>
                <Td className="text-gray-600 text-xs">
                  {c.closingDay === 31 ? "月末" : `${c.closingDay}日`}締 / {c.paymentTermDays}日サイト
                </Td>
                <Td className="text-center text-gray-700">{c._count.projects}</Td>
                <Td className="text-center text-gray-700">{c._count.activities}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
