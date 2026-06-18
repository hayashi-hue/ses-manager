// 請求書Excel生成（xlsx / SheetJS）。既存依存を再利用（新規依存なし）。
// 金額はセル数値＋表示書式（負値は括弧）で出力し、編集・再計算可能にする。
// ※ SheetJS コミュニティ版は画像埋め込み非対応のため、角印・ロゴはPDF側で対応。
import * as XLSX from "xlsx";
import type { InvoiceDoc } from "./invoice-doc";

const YEN_FMT = "¥#,##0;(¥#,##0)"; // 負値は括弧表記

export function buildInvoiceExcel(doc: InvoiceDoc): Buffer {
  const c = doc.company;
  const aoa: (string | number)[][] = [];

  aoa.push(["ご請求書"]);
  aoa.push([]);
  aoa.push([`${doc.billToName} 御中`, "", "", "", c.name]);
  aoa.push(["", "", "", "", `登録番号：${c.registrationNumber}`]);
  aoa.push(["ご請求額：", "", "", "", `〒${c.postalCode}`]);
  aoa.push([{ v: doc.total } as never, "", "", "", c.address1]);
  aoa.push(["", "", "", "", c.address2]);
  aoa.push(["", "", "", "", `Tel:${c.tel}`]);
  aoa.push([`請求日: ${doc.issueDateText}`, "", "", "", ""]);
  aoa.push([`お支払期限日: ${doc.dueDateText}`, "", "", "", ""]);
  aoa.push([]);

  const headerRow = aoa.length; // 0-based index of header row
  aoa.push(["#", "摘要", "単価", "数量", "計"]);

  const rowStart = aoa.length;
  for (const r of doc.rows) {
    aoa.push([r.idx, r.descLines.join("\n"), r.unitPrice, r.quantity, r.amount]);
  }
  const rowEnd = aoa.length; // exclusive

  aoa.push([]);
  const subRow = aoa.length;
  aoa.push(["", "", "", "小計 (課税10%対象)", doc.subtotal]);
  const taxRow = aoa.length;
  aoa.push(["", "", "", `消費税 (${doc.taxRate}%対象)`, doc.taxAmount]);
  const totalRow = aoa.length;
  aoa.push(["", "", "", "合計 (税込)", doc.total]);
  aoa.push([]);
  aoa.push(["振込先"]);
  for (const b of c.banks) aoa.push([b]);
  aoa.push([c.feeNote]);
  if (doc.note) aoa.push([doc.note]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 列幅
  ws["!cols"] = [{ wch: 4 }, { wch: 46 }, { wch: 14 }, { wch: 8 }, { wch: 16 }];

  // 金額セルに表示書式（負値括弧）を付与
  const setMoney = (rowIdx: number, colIdx: number) => {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
    const cell = ws[addr];
    if (cell && typeof cell.v === "number") {
      cell.t = "n";
      cell.z = YEN_FMT;
    }
  };
  // ご請求額（A6 = row index 5, col 0）
  setMoney(5, 0);
  // 明細の単価(C)・計(E)
  for (let r = rowStart; r < rowEnd; r++) {
    setMoney(r, 2);
    setMoney(r, 4);
  }
  // 合計類（E列）
  setMoney(subRow, 4);
  setMoney(taxRow, 4);
  setMoney(totalRow, 4);

  // タイトル・宛先のセル結合
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // タイトル
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "請求書");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
