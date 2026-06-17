import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate, yen, presentedRateUnit } from "@/lib/utils";
import { deleteContract } from "@/lib/actions";
import { settlementHoursText } from "@/lib/settlement";
import { PageHeader, Card, Badge, LinkButton, EmptyState, Table, Th, Td } from "@/components/ui";
import { ContractStatusLabel } from "@/lib/enums";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-gray-200 text-gray-600",
  SENT: "bg-sky-100 text-sky-700",
  SIGNED: "bg-emerald-100 text-emerald-700",
  EXPIRED: "bg-rose-100 text-rose-700",
};

export default async function ContractsPage() {
  const contracts = await prisma.contract.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      assignment: { include: { engineer: true, project: { include: { client: true } } } },
    },
  });

  // 期限30日以内アラート
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);

  return (
    <div>
      <PageHeader
        title="契約管理"
        subtitle={`契約 ${contracts.length} 件`}
        action={<LinkButton href="/contracts/new">＋ 契約を作成</LinkButton>}
      />
      <Card>
        {contracts.length === 0 ? (
          <EmptyState message="契約がありません" hint="アサインから契約を作成できます" />
        ) : (
          <Table
            head={
              <>
                <Th>契約番号</Th>
                <Th>技術者 / 案件</Th>
                <Th>取引先</Th>
                <Th className="text-right">単価(実/提示)</Th>
                <Th>精算条件</Th>
                <Th>状態</Th>
                <Th>期間</Th>
                <Th></Th>
              </>
            }
          >
            {contracts.map((c) => {
              const expiring =
                c.endOn && new Date(c.endOn) <= soon && c.status !== "EXPIRED";
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td className="font-mono text-xs text-gray-600">{c.contractNo}</Td>
                  <Td>
                    <Link href={`/assignments/${c.assignmentId}`} className="text-indigo-600 hover:underline">
                      {c.assignment.engineer.name}
                    </Link>
                    <div className="text-xs text-gray-400">{c.assignment.project.title}</div>
                  </Td>
                  <Td className="text-gray-600">{c.assignment.project.client.name}</Td>
                  <Td className="text-right text-xs">
                    <div className="text-gray-800">
                      {yen(c.monthlyRate)}
                      {c.rateType === "HOURLY" && <span className="text-gray-400">/h</span>}
                    </div>
                    <div className="text-indigo-500">
                      {c.engineerRate != null ? yen(c.engineerRate) : "—"}
                      {c.engineerRate != null && presentedRateUnit(c) === "HOURLY" && (
                        <span className="text-indigo-300">/h</span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-xs text-gray-600">
                    {c.rateType === "HOURLY" ? (
                      <span className="text-violet-600">時給精算</span>
                    ) : (
                      settlementHoursText(c)
                    )}
                  </Td>
                  <Td>
                    <Badge className={statusColor[c.status]}>{ContractStatusLabel[c.status]}</Badge>
                  </Td>
                  <Td className="text-xs text-gray-500">
                    {formatDate(c.startOn)}〜{formatDate(c.endOn)}
                    {expiring && (
                      <Badge className="ml-1 bg-amber-100 text-amber-700">満了間近</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-2 justify-end">
                      <Link href={`/contracts/${c.id}/edit`} className="text-xs text-gray-500 hover:text-indigo-600">
                        編集
                      </Link>
                      <form action={deleteContract}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-xs text-rose-400 hover:text-rose-600">削除</button>
                      </form>
                    </div>
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
