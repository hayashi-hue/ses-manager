import { requireStaff } from "@/lib/auth";
import { loadInvoiceExport } from "@/lib/invoice-load";
import { buildInvoiceExcel } from "@/lib/invoice-excel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireStaff();
  const { id } = await params;
  const data = await loadInvoiceExport(id);
  if (!data) return new Response("請求書が見つかりません", { status: 404 });

  const buf = buildInvoiceExcel(data.doc);
  const filename = `${data.fileBase}.xlsx`;
  return new Response(
    new Blob([new Uint8Array(buf)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
