// 請求書エクスポート用ローダー（Excel/PDFルートで共有）。サーバー専用。
import { prisma } from "./db";
import { buildInvoiceDoc, invoiceFileBase } from "./invoice-doc";
import { getCompany } from "./company";

export async function loadInvoiceExport(id: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      items: { include: { assignment: { include: { engineer: true } } } },
    },
  });
  if (!inv) return null;

  const company = await getCompany();
  const doc = buildInvoiceDoc(inv, company);

  // ファイル名用にエンジニアを集計（1名のみなら要員番号・氏名を付与）
  const engineers = new Map<string, { code: string; name: string }>();
  for (const it of inv.items) {
    const e = it.assignment?.engineer;
    if (e) engineers.set(e.id, { code: e.code, name: e.name });
  }
  const only = engineers.size === 1 ? [...engineers.values()][0] : null;
  const fileBase = invoiceFileBase({
    clientName: inv.client.name,
    yearMonth: inv.yearMonth,
    engineerCode: only?.code ?? null,
    engineerName: only?.name ?? null,
  });

  return { inv, doc, fileBase };
}
