import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { yen, formatYearMonth, formatDate } from "@/lib/utils";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { InvoiceStatusLabel, InvoiceStatusColor } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { client: true, items: true },
  });
  if (!inv) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`請求書 ${inv.invoiceNo}`}
        subtitle={`${inv.client.name}　${formatYearMonth(inv.yearMonth)} 稼働分`}
        action={
          <div className="flex items-center gap-2">
            <Badge className={InvoiceStatusColor[inv.status]}>
              {InvoiceStatusLabel[inv.status]}
            </Badge>
            <LinkButton href="/invoices" variant="ghost">
              一覧へ
            </LinkButton>
          </div>
        }
      />

      <Card className="p-8">
        {/* 請求書ヘッダー */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="text-lg font-bold text-gray-900">{inv.client.name} 御中</div>
            <div className="text-sm text-gray-500 mt-1">
              締め日: {inv.client.closingDay === 31 ? "月末" : `${inv.client.closingDay}日`} ／
              支払サイト: {inv.client.paymentTermDays}日
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm text-gray-600">{inv.invoiceNo}</div>
            <div className="text-xs text-gray-400 mt-1">発行日: {formatDate(inv.issueDate) }</div>
            <div className="text-xs text-gray-400">対象: {formatYearMonth(inv.yearMonth)}</div>
          </div>
        </div>

        <div className="bg-indigo-50 rounded-lg px-5 py-4 mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-600">ご請求金額（税込）</span>
          <span className="text-2xl font-bold text-indigo-700">{yen(inv.total)}</span>
        </div>

        {/* 明細 */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300 text-left text-gray-500">
              <th className="py-2">内容</th>
              <th className="py-2 text-right">単価</th>
              <th className="py-2 text-right">数量</th>
              <th className="py-2 text-right">金額</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-3">{item.description}</td>
                <td className="py-3 text-right">{yen(item.unitPrice)}</td>
                <td className="py-3 text-right">{item.quantity}</td>
                <td className="py-3 text-right font-medium">{yen(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 合計 */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">小計（税抜）</span>
              <span>{yen(inv.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">消費税（{inv.taxRate}%）</span>
              <span>{yen(inv.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-2 font-bold text-base">
              <span>合計</span>
              <span className="text-indigo-700">{yen(inv.total)}</span>
            </div>
          </div>
        </div>

        {inv.note && (
          <p className="text-sm text-gray-500 mt-6 border-t border-gray-100 pt-4">{inv.note}</p>
        )}
      </Card>

      <p className="text-xs text-gray-400 mt-4">
        ※ この請求書は稼働中アサインから自動生成されています。明細の調整が必要な場合は{" "}
        <Link href={`/clients/${inv.clientId}`} className="text-indigo-600 hover:underline">
          取引先ページ
        </Link>
        から各アサインをご確認ください。
      </p>
    </div>
  );
}
