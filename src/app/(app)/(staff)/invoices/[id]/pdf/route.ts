import { requireStaff } from "@/lib/auth";
import { loadInvoiceExport } from "@/lib/invoice-load";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

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

  const bytes = await buildInvoicePdf(data.doc);
  const filename = `${data.fileBase}.pdf`;
  return new Response(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
