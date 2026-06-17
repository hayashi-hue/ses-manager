// 共通ユーティリティ（日本円・日付・稼働率など）

/** 円表記（例: 650000 → ¥650,000） */
export function yen(amount: number | null | undefined): string {
  if (amount == null) return "¥0";
  return "¥" + Math.round(amount).toLocaleString("ja-JP");
}

/** 単価＋単位（例: 月額→¥720,000／月、時給→¥4,500／時間） */
export function yenWithUnit(amount: number | null | undefined, rateType: string): string {
  if (amount == null) return "—";
  return yen(amount) + (rateType === "HOURLY" ? "／時間" : "／月");
}

/** エンジニア提示額の単位を判定（時給契約でも本人へは月額提示が可能） */
export function presentedRateUnit(c: {
  rateType?: string | null;
  engineerRateType?: string | null;
}): "MONTHLY" | "HOURLY" {
  if (c.rateType === "HOURLY") return c.engineerRateType === "HOURLY" ? "HOURLY" : "MONTHLY";
  return "MONTHLY";
}

/** 千円単位表記（例: 650000 → 65万円） */
export function manYen(amount: number | null | undefined): string {
  if (!amount) return "0円";
  const man = amount / 10000;
  return `${man.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円`;
}

/** 日付を YYYY/MM/DD 表記に */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/** 当月の年月文字列（"2026-06"） */
export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-06" → "2026年6月" */
export function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${y}年${Number(m)}月`;
}

/** 消費税計算（税抜→税込） */
export function calcTax(subtotal: number, taxRate = 10): { tax: number; total: number } {
  const tax = Math.floor((subtotal * taxRate) / 100);
  return { tax, total: subtotal + tax };
}

/** 粗利・粗利率 */
export function calcMargin(sell: number, cost: number): { profit: number; rate: number } {
  const profit = sell - cost;
  const rate = sell > 0 ? Math.round((profit / sell) * 1000) / 10 : 0;
  return { profit, rate };
}

/** 入力文字列を整数に（空・不正は0） */
export function toInt(v: FormDataEntryValue | null | undefined): number {
  if (v == null) return 0;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

/** 入力文字列を浮動小数に */
export function toFloat(v: FormDataEntryValue | null | undefined): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/** 入力を日付に（空は null） */
export function toDate(v: FormDataEntryValue | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

/** input[type=date] 用 value（YYYY-MM-DD） */
export function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
