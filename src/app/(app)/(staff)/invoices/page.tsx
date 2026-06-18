import Link from "next/link";
import { prisma } from "@/lib/db";
import { generateInvoices, updateInvoiceStatus, deleteInvoice } from "@/lib/actions";
import { yen, formatYearMonth, currentYearMonth } from "@/lib/utils";
import { PageHeader, Card, Badge, EmptyState, Table, Th, Td } from "@/components/ui";
import { InvoiceStatusLabel, InvoiceStatusColor } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string; generated?: string }>;
}) {
  const sp = await searchParams;
  const ym = sp.ym || currentYearMonth();

  const invoices = await prisma.invoice.findMany({
    where: { yearMonth: ym },
    orderBy: { invoiceNo: "asc" },
    include: {
      client: true,
      items: { include: { assignment: { include: { engineer: true } } } },
    },
  });

  const total = invoices.reduce((s, i) => s + i.total, 0);
  const paid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);

  return (
    <div>
      <PageHeader
        title="請求管理"
        subtitle={`${formatYearMonth(ym)}　請求 ${invoices.length} 件・合計 ${yen(total)}・入金済 ${yen(paid)}`}
        action={
          <div className="flex items-center gap-2">
            {invoices.length > 0 && (
              <>
                <a
                  href={`/invoices/zip?ym=${ym}&type=pdf`}
                  className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-sm font-medium hover:bg-rose-100"
                >
                  PDF一括DL
                </a>
                <a
                  href={`/invoices/zip?ym=${ym}&type=excel`}
                  className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100"
                >
                  Excel一括DL
                </a>
              </>
            )}
            <form action={generateInvoices} className="flex items-center gap-2">
              <input type="hidden" name="yearMonth" value={ym} />
              <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                ＋ 当月分の請求を自動生成
              </button>
            </form>
          </div>
        }
      />

      <Card className="p-3 mb-4 flex items-center gap-3">
        <form className="flex items-center gap-2">
          <label className="text-sm text-gray-600">対象月</label>
          <input
            type="month"
            name="ym"
            defaultValue={ym}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white"
          />
          <button className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm">表示</button>
        </form>
        {sp.generated && (
          <Badge className="bg-emerald-100 text-emerald-700">
            {sp.generated} 件の請求を生成しました
          </Badge>
        )}
      </Card>

      <Card>
        {invoices.length === 0 ? (
          <EmptyState
            message={`${formatYearMonth(ym)}の請求はありません`}
            hint="「当月分の請求を自動生成」で稼働中アサインから請求を作成できます"
          />
        ) : (
          <Table
            head={
              <>
                <Th>請求番号</Th>
                <Th>取引先</Th>
                <Th>担当</Th>
                <Th className="text-right">税抜</Th>
                <Th className="text-right">税込</Th>
                <Th className="text-center">出力</Th>
                <Th>状態</Th>
                <Th></Th>
              </>
            }
          >
            {invoices.map((inv) => {
              const eng = inv.items.find((it) => it.assignment?.engineer)?.assignment
                ?.engineer;
              return (
              <tr key={inv.id} className="hover:bg-gray-50">
                <Td>
                  <Link href={`/invoices/${inv.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                    {inv.invoiceNo}
                  </Link>
                </Td>
                <Td className="text-gray-700">{inv.client.name}</Td>
                <Td className="text-gray-700">
                  {eng ? `${eng.name}（${eng.code}）` : "—"}
                </Td>
                <Td className="text-right text-gray-600">{yen(inv.subtotal)}</Td>
                <Td className="text-right font-medium">{yen(inv.total)}</Td>
                <Td className="text-center whitespace-nowrap">
                  <a
                    href={`/invoices/${inv.id}/pdf`}
                    className="text-xs px-2 py-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 mr-1"
                  >
                    PDF
                  </a>
                  <a
                    href={`/invoices/${inv.id}/excel`}
                    className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  >
                    Excel
                  </a>
                </Td>
                <Td>
                  <Badge className={InvoiceStatusColor[inv.status]}>
                    {InvoiceStatusLabel[inv.status]}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-2 justify-end">
                    <form action={updateInvoiceStatus} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={inv.id} />
                      <select
                        name="status"
                        defaultValue={inv.status}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs bg-white"
                      >
                        {Object.entries(InvoiceStatusLabel).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <button className="text-xs px-2 py-1 rounded bg-gray-700 text-white">更新</button>
                    </form>
                    <form action={deleteInvoice}>
                      <input type="hidden" name="id" value={inv.id} />
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
