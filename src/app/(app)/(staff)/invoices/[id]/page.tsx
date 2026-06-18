import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { yen, formatYearMonth } from "@/lib/utils";
import { yenAccounting } from "@/lib/invoice-doc";
import { getCompany } from "@/lib/company";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { InvoiceStatusLabel, InvoiceStatusColor } from "@/lib/enums";

export const dynamic = "force-dynamic";

function jpDate(d: Date | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}年${m}月${day}日`;
}

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
  const COMPANY = await getCompany();

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
            {/* ファイルダウンロード（Content-Disposition: attachment のため素の <a> を使用） */}
            <a
              href={`/invoices/${inv.id}/pdf`}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 transition"
            >
              PDF
            </a>
            <a
              href={`/invoices/${inv.id}/excel`}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              Excel
            </a>
            <LinkButton href="/invoices" variant="ghost">
              一覧へ
            </LinkButton>
          </div>
        }
      />

      <Card className="p-8">
        <div className="text-center text-lg font-bold tracking-widest text-gray-900 mb-6">
          ご請求書
        </div>

        {/* 宛先 ＋ 請求元 */}
        <div className="flex justify-between items-start mb-6">
          <div className="pt-2">
            <div className="text-lg font-bold text-gray-900 border-b border-gray-400 pb-1 inline-block">
              {inv.client.name} 御中
            </div>
          </div>
          <div className="text-right text-xs text-gray-600 leading-relaxed">
            <div className="flex items-center justify-end gap-2 mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/${COMPANY.logoPath}`} alt="" className="w-9 h-9 object-contain" />
              <span className="text-sm font-bold text-gray-900">{COMPANY.name}</span>
            </div>
            <div className="text-gray-500">登録番号：{COMPANY.registrationNumber}</div>
            <div className="mt-1">〒{COMPANY.postalCode}</div>
            <div>{COMPANY.address1}</div>
            <div>{COMPANY.address2}</div>
            <div>Tel:{COMPANY.tel}</div>
            <div className="mt-2 text-gray-700">請求日: {jpDate(inv.issueDate)}</div>
            <div className="text-gray-700">お支払期限日: {jpDate(inv.dueDate)}</div>
          </div>
        </div>

        {/* ご請求額（角印重ね） */}
        <div className="relative bg-indigo-50 rounded-lg px-5 py-4 mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-600">ご請求額（税込）</span>
          <span className="text-2xl font-bold text-indigo-700">{yen(inv.total)}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/${COMPANY.sealPath}`}
            alt=""
            className="absolute right-28 -top-2 w-14 h-14 object-contain opacity-90 pointer-events-none"
          />
        </div>

        {/* 明細 */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300 text-left text-gray-500">
              <th className="py-2 w-8">#</th>
              <th className="py-2">摘要</th>
              <th className="py-2 text-right">単価</th>
              <th className="py-2 text-right">数量</th>
              <th className="py-2 text-right">計</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((item, i) => (
              <tr key={item.id} className="border-b border-gray-100 align-top">
                <td className="py-3 text-gray-500">{i + 1}</td>
                <td className="py-3 whitespace-pre-line">{item.description}</td>
                <td className="py-3 text-right tabular-nums">{yenAccounting(item.unitPrice)}</td>
                <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right font-medium tabular-nums">{yenAccounting(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 合計 */}
        <div className="flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">小計（課税{inv.taxRate}%対象）</span>
              <span className="tabular-nums">{yen(inv.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">消費税（{inv.taxRate}%対象）</span>
              <span className="tabular-nums">{yen(inv.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-2 font-bold text-base">
              <span>合計（税込）</span>
              <span className="text-indigo-700 tabular-nums">{yen(inv.total)}</span>
            </div>
          </div>
        </div>

        {/* 振込先 */}
        <div className="mt-8 border-t border-gray-100 pt-4 text-xs text-gray-600 leading-relaxed">
          <div className="font-medium text-gray-700 mb-1">振込先</div>
          {COMPANY.banks.map((b) => (
            <div key={b}>{b}</div>
          ))}
          <div className="mt-2 text-gray-500">{COMPANY.feeNote}</div>
        </div>

        {inv.note && (
          <p className="text-sm text-gray-500 mt-4 border-t border-gray-100 pt-4">{inv.note}</p>
        )}
      </Card>

      <p className="text-xs text-gray-400 mt-4">
        ※ この請求書は稼働中アサインから自動生成されています（基準額＋控除/超過精算を明細展開）。明細の調整が必要な場合は{" "}
        <Link href={`/clients/${inv.clientId}`} className="text-indigo-600 hover:underline">
          取引先ページ
        </Link>
        から各アサインをご確認ください。
      </p>
    </div>
  );
}
