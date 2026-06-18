// 請求書PDF生成（pdf-lib + fontkit）。添付フォーマットを座標で再現。
// 純JSのため Vercel サーバーレスで安全に動作する（外部送信なし）。
import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { InvoiceDoc } from "./invoice-doc";
import { yen, yenAccounting } from "./invoice-doc";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const INK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.4, 0.4, 0.45);
const LINE = rgb(0.8, 0.8, 0.82);

// public/ 配下の資産を読む
function pub(p: string) {
  return path.join(process.cwd(), "public", p);
}

/** pymupdf流の「上端からのy」をpdf-libの「下端からのbaseline y」に変換 */
function ty(yTop: number, size: number): number {
  return PAGE_H - yTop - size;
}

export async function buildInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await readFile(pub(path.join("fonts", "SawarabiGothic-Regular.ttf")));
  // subset:false（フル埋め込み）。このTTFは subset:true だと pdf-lib のサブセット化で
  // 多くのグリフが欠落するため、確実なフル埋め込みにする（出力 約1.1MB）。
  const font = await pdf.embedFont(fontBytes, { subset: false });

  let logo: PDFImage | null = null;
  let seal: PDFImage | null = null;
  try {
    logo = await pdf.embedPng(await readFile(pub(doc.company.logoPath)));
  } catch {
    /* ロゴ無しでも継続 */
  }
  try {
    seal = await pdf.embedPng(await readFile(pub(doc.company.sealPath)));
  } catch {
    /* 角印無しでも継続 */
  }

  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const text = (
    s: string,
    xLeft: number,
    yTop: number,
    size: number,
    color = INK
  ) => page.drawText(s, { x: xLeft, y: ty(yTop, size), size, font, color });

  const right = (
    s: string,
    xRight: number,
    yTop: number,
    size: number,
    color = INK
  ) => {
    const w = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: xRight - w, y: ty(yTop, size), size, font, color });
  };

  const center = (s: string, xCenter: number, yTop: number, size: number, color = INK) => {
    const w = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: xCenter - w / 2, y: ty(yTop, size), size, font, color });
  };

  // ===== タイトル =====
  center("ご請求書", PAGE_W / 2, 66, 18);

  // ===== 宛先 =====
  text(`${doc.billToName} 御中`, 78, 100, 12);

  // ===== 請求元（自社）ブロック（右上）=====
  const c = doc.company;
  const issuerX = 360;
  if (logo) {
    const dim = 38;
    page.drawImage(logo, { x: issuerX, y: ty(116, 0) - dim, width: dim, height: dim });
  }
  text(c.name, issuerX + 44, 122, 10);
  text(`登録番号：${c.registrationNumber}`, issuerX + 44, 138, 8.5, GRAY);
  text(`〒${c.postalCode}`, issuerX, 158, 8.5, GRAY);
  text(c.address1, issuerX, 171, 8.5, GRAY);
  text(c.address2, issuerX, 184, 8.5, GRAY);
  text(`Tel:${c.tel}`, issuerX, 197, 8.5, GRAY);
  text(`請求日: ${doc.issueDateText}`, issuerX, 220, 9);
  text(`お支払期限日: ${doc.dueDateText}`, issuerX, 233, 9);

  // ===== ご請求額（左・大）=====
  text("ご請求額：", 78, 176, 10);
  text(yen(doc.total), 150, 168, 18);
  // 角印（請求額に重ねて押印）
  if (seal) {
    const dim = 56;
    page.drawImage(seal, { x: 250, y: ty(196, 0) - dim, width: dim, height: dim, opacity: 0.92 });
  }

  // ===== 明細テーブル =====
  const TOP = 280; // ヘッダー上端
  const X_NO = 80;
  const X_DESC = 96;
  const X_UNIT_R = 392; // 単価 右端
  const X_QTY_R = 446; // 数量 右端
  const X_AMT_R = 520; // 計 右端
  const TABLE_L = 74;
  const TABLE_R = 521;

  // ヘッダー
  page.drawLine({ start: { x: TABLE_L, y: ty(TOP, 0) }, end: { x: TABLE_R, y: ty(TOP, 0) }, thickness: 0.8, color: LINE });
  text("#", X_NO, TOP + 4, 9, GRAY);
  text("摘要", X_DESC + 90, TOP + 4, 9, GRAY);
  right("単価", X_UNIT_R, TOP + 4, 9, GRAY);
  right("数量", X_QTY_R, TOP + 4, 9, GRAY);
  right("計", X_AMT_R, TOP + 4, 9, GRAY);
  page.drawLine({ start: { x: TABLE_L, y: ty(TOP + 18, 0) }, end: { x: TABLE_R, y: ty(TOP + 18, 0) }, thickness: 0.8, color: LINE });

  // 行
  let y = TOP + 25;
  for (const row of doc.rows) {
    text(String(row.idx), X_NO, y, 9);
    // 摘要（複数行）
    let dy = y;
    row.descLines.forEach((ln, i) => {
      text(ln, X_DESC, dy, i === 0 ? 9 : 8.5, i === 0 ? INK : GRAY);
      dy += i === 0 ? 13 : 12;
    });
    // 金額（1行目の高さに合わせて右寄せ）
    right(yenAccounting(row.unitPrice), X_UNIT_R, y, 9);
    right(String(row.quantity), X_QTY_R, y, 9);
    right(yenAccounting(row.amount), X_AMT_R, y, 9);
    const rowH = Math.max(dy - y + 8, 22);
    y += rowH;
    page.drawLine({ start: { x: TABLE_L, y: ty(y - 6, 0) }, end: { x: TABLE_R, y: ty(y - 6, 0) }, thickness: 0.4, color: LINE });
  }

  // ===== 合計（右下に固定）=====
  const totalsTop = 624;
  right("小計 (課税10%対象)", X_UNIT_R + 30, totalsTop, 9, GRAY);
  right(yen(doc.subtotal), X_AMT_R, totalsTop, 9);
  right(`消費税 (${doc.taxRate}%対象)`, X_UNIT_R + 30, totalsTop + 14, 9, GRAY);
  right(yen(doc.taxAmount), X_AMT_R, totalsTop + 14, 9);
  page.drawLine({ start: { x: 350, y: ty(totalsTop + 28, 0) }, end: { x: TABLE_R, y: ty(totalsTop + 28, 0) }, thickness: 0.6, color: LINE });
  right("合計 (税込)", X_UNIT_R + 30, totalsTop + 33, 10.5);
  right(yen(doc.total), X_AMT_R, totalsTop + 33, 10.5);

  // ===== 振込先 =====
  let by = 678;
  text("振込先", 74, by, 9);
  by += 13;
  for (const b of c.banks) {
    text(b, 74, by, 9, GRAY);
    by += 12;
  }
  by += 6;
  text(c.feeNote, 74, by, 9, GRAY);

  if (doc.note) {
    text(doc.note, 74, by + 16, 8.5, GRAY);
  }

  return pdf.save();
}
