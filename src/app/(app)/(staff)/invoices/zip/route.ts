import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadInvoiceExport } from "@/lib/invoice-load";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { buildInvoiceExcel } from "@/lib/invoice-excel";
import JSZip from "jszip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 対象月の全請求書を1人1ファイルでZIPにまとめてダウンロード。
// /invoices/zip?ym=2026-05&type=pdf （type=pdf | excel）
export async function GET(req: Request) {
  await requireStaff();
  const url = new URL(req.url);
  const ym = url.searchParams.get("ym") || "";
  const type = (url.searchParams.get("type") || "pdf").toLowerCase();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return new Response("対象年月が不正です", { status: 400 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { yearMonth: ym },
    select: { id: true },
    orderBy: { invoiceNo: "asc" },
  });
  if (invoices.length === 0) {
    return new Response("対象月の請求がありません", { status: 404 });
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const { id } of invoices) {
    const data = await loadInvoiceExport(id);
    if (!data) continue;

    let name: string;
    let bytes: Uint8Array;
    if (type === "excel") {
      name = `${data.fileBase}.xlsx`;
      bytes = new Uint8Array(buildInvoiceExcel(data.doc));
    } else {
      name = `${data.fileBase}.pdf`;
      bytes = await buildInvoicePdf(data.doc);
    }
    // 同名ファイルの衝突回避
    let finalName = name;
    let n = 1;
    while (usedNames.has(finalName)) {
      n += 1;
      finalName = name.replace(/(\.[^.]+)$/, `_${n}$1`);
    }
    usedNames.add(finalName);
    zip.file(finalName, bytes);
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const label = type === "excel" ? "Excel" : "PDF";
  const zipName = `請求書_${ym}_${label}.zip`;
  return new Response(new Blob([new Uint8Array(zipBytes)], { type: "application/zip" }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "Cache-Control": "no-store",
    },
  });
}
