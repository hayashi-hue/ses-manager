// 請求書ドキュメントモデル。DBの Invoice(+client,+items) を
// Excel / PDF / 画面プレビューで共有する正規化済みデータへ変換する。
import { yen, formatDate, formatYearMonth } from "./utils";
import type { CompanyInfo } from "./company";

/** 会計表記。負値は括弧表記（例: -53500 → "(¥53,500)"）。添付請求書フォーマット準拠 */
export function yenAccounting(amount: number | null | undefined): string {
  if (amount == null) return "¥0";
  const n = Math.round(amount);
  if (n < 0) return `(${yen(-n)})`;
  return yen(n);
}

export type InvoiceRow = {
  idx: number;
  /** 摘要（複数行。1行目=件名/控除タイトル、2行目=明細） */
  descLines: string[];
  unitPrice: number;
  quantity: number;
  amount: number;
};

export type InvoiceDoc = {
  invoiceNo: string;
  billToName: string; // 例: 株式会社◯◯◯
  yearMonth: string;
  issueDateText: string; // 例: 2026年05月31日
  dueDateText: string;
  rows: InvoiceRow[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  note: string | null;
  company: CompanyInfo;
};

type InvoiceWithRels = {
  invoiceNo: string;
  yearMonth: string;
  issueDate: Date | null;
  dueDate: Date | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  note: string | null;
  client: { name: string };
  items: {
    description: string;
    unitPrice: number;
    quantity: number;
    amount: number;
  }[];
};

/** 和暦ではなく西暦の「YYYY年MM月DD日」表記（添付フォーマット準拠） */
function jpDate(d: Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}年${m}月${day}日`;
}

export function buildInvoiceDoc(inv: InvoiceWithRels, company: CompanyInfo): InvoiceDoc {
  const rows: InvoiceRow[] = inv.items.map((it, i) => ({
    idx: i + 1,
    descLines: it.description.split("\n"),
    unitPrice: it.unitPrice,
    quantity: it.quantity,
    amount: it.amount,
  }));
  return {
    invoiceNo: inv.invoiceNo,
    billToName: inv.client.name,
    yearMonth: inv.yearMonth,
    issueDateText: jpDate(inv.issueDate),
    dueDateText: jpDate(inv.dueDate),
    rows,
    subtotal: inv.subtotal,
    taxRate: inv.taxRate,
    taxAmount: inv.taxAmount,
    total: inv.total,
    note: inv.note,
    company,
  };
}

/** ダウンロードファイル名（添付の命名規則に準拠）。
 * 例: 株式会社◯◯◯御中_139_林太郎_2026-05.pdf
 * 1エンジニア1請求の場合は要員番号・氏名を付与、複数の場合は取引先＋年月のみ。 */
export function invoiceFileBase(opts: {
  clientName: string;
  yearMonth: string;
  engineerCode?: string | null;
  engineerName?: string | null;
}): string {
  const { clientName, yearMonth, engineerCode, engineerName } = opts;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "");
  const parts = [`${safe(clientName)}御中`];
  if (engineerCode) parts.push(safe(engineerCode));
  if (engineerName) parts.push(safe(engineerName));
  parts.push(yearMonth);
  return parts.join("_");
}

// 再エクスポート（呼び出し側の利便のため）
export { yen, formatDate, formatYearMonth };
