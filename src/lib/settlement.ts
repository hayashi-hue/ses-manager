// 精算条件・控除/超過単価の算出ロジック
import { yen } from "./utils";

export type SettlementInput = {
  rateType?: string; // MONTHLY(月額) / HOURLY(時給)。未指定は MONTHLY 扱い
  settlementType: string; // RANGE / FIXED / BUSINESSDAY_BUFFER
  lowerHours: number | null;
  upperHours: number | null;
  fixedHours: number | null;
  dailyStdHours: number | null;
  bufferHours: number | null;
  settlementMethod: string; // MIDDLE / UPPER_LOWER / MANUAL / NONE
  deductionRate: number | null;
  excessRate: number | null;
};

// BUSINESSDAY_BUFFER の目安算出に使う標準営業日数
const NOMINAL_BUSINESS_DAYS = 20;

// 日本の祝日（2025〜2027）。振替休日含む。運用では毎年メンテナンス推奨
const JP_HOLIDAYS = new Set<string>([
  // 2025
  "2025-01-01", "2025-01-13", "2025-02-11", "2025-02-23", "2025-02-24",
  "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-04", "2025-05-05",
  "2025-05-06", "2025-07-21", "2025-08-11", "2025-09-15", "2025-09-23",
  "2025-10-13", "2025-11-03", "2025-11-23", "2025-11-24",
  // 2026
  "2026-01-01", "2026-01-12", "2026-02-11", "2026-02-23", "2026-03-20",
  "2026-04-29", "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
  "2026-07-20", "2026-08-11", "2026-09-21", "2026-09-22", "2026-09-23",
  "2026-10-12", "2026-11-03", "2026-11-23",
  // 2027
  "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23", "2027-03-21",
  "2027-03-22", "2027-04-29", "2027-05-03", "2027-05-04", "2027-05-05",
  "2027-07-19", "2027-08-11", "2027-09-20", "2027-09-23", "2027-10-11",
  "2027-11-03", "2027-11-23",
]);

/** 指定年月("2026-06")の実営業日数（土日・祝日を除く） */
export function businessDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return 0;
  const daysInMonth = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m - 1, d);
    const dow = date.getDay(); // 0=日, 6=土
    const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dow !== 0 && dow !== 6 && !JP_HOLIDAYS.has(key)) count++;
  }
  return count;
}

/** 精算幅（下限/上限/中央）の時間。dynamic=true は月の営業日数で変動することを示す */
export function settlementHours(c: SettlementInput): {
  lower: number | null;
  upper: number | null;
  mid: number | null;
  dynamic: boolean;
} {
  if (c.settlementType === "RANGE") {
    const lower = c.lowerHours ?? null;
    const upper = c.upperHours ?? null;
    const mid = lower != null && upper != null ? (lower + upper) / 2 : null;
    return { lower, upper, mid, dynamic: false };
  }
  if (c.settlementType === "FIXED") {
    const h = c.fixedHours ?? null;
    return { lower: h, upper: h, mid: h, dynamic: false };
  }
  if (c.settlementType === "BUSINESSDAY_BUFFER") {
    const std = c.dailyStdHours != null ? c.dailyStdHours * NOMINAL_BUSINESS_DAYS : null;
    const buf = c.bufferHours ?? 0;
    if (std == null) return { lower: null, upper: null, mid: null, dynamic: true };
    return { lower: std - buf, upper: std + buf, mid: std, dynamic: true };
  }
  return { lower: null, upper: null, mid: null, dynamic: false };
}

/** 指定の基準単価(baseRate)から控除・超過単価(円/h)を算出 */
export function computeRates(
  c: SettlementInput,
  baseRate: number
): { deduction: number | null; excess: number | null } {
  if (c.settlementMethod === "NONE") return { deduction: null, excess: null };
  if (c.settlementMethod === "MANUAL") {
    return { deduction: c.deductionRate ?? null, excess: c.excessRate ?? null };
  }
  const { lower, upper, mid } = settlementHours(c);
  if (c.settlementMethod === "MIDDLE") {
    if (!mid || mid <= 0) return { deduction: null, excess: null };
    const r = Math.round(baseRate / mid);
    return { deduction: r, excess: r };
  }
  if (c.settlementMethod === "UPPER_LOWER") {
    const deduction = lower && lower > 0 ? Math.round(baseRate / lower) : null;
    const excess = upper && upper > 0 ? Math.round(baseRate / upper) : null;
    return { deduction, excess };
  }
  return { deduction: null, excess: null };
}

/** 精算時間条件を日本語テキストで返す */
export function settlementHoursText(c: SettlementInput): string {
  if (c.rateType === "HOURLY") return "時給精算（実働時間 × 時給）";
  if (c.settlementType === "RANGE") {
    if (c.lowerHours != null && c.upperHours != null) {
      return `${c.lowerHours}〜${c.upperHours}時間／月`;
    }
    return "上限・下限（未設定）";
  }
  if (c.settlementType === "FIXED") {
    return c.fixedHours != null ? `${c.fixedHours}時間固定（精算なし）` : "固定（精算なし）";
  }
  if (c.settlementType === "BUSINESSDAY_BUFFER") {
    const d = c.dailyStdHours != null ? c.dailyStdHours : "—";
    const b = c.bufferHours != null ? c.bufferHours : "—";
    return `営業日数 × ${d}時間 ± ${b}時間`;
  }
  return "—";
}

/** 指定年月における精算幅（その月の実営業日数を考慮） */
export function monthlyRange(
  c: SettlementInput,
  yearMonth: string
): {
  businessDays: number;
  lower: number | null;
  upper: number | null;
  standard: number | null;
} {
  const businessDays = businessDaysInMonth(yearMonth);
  if (c.settlementType === "RANGE") {
    const lower = c.lowerHours ?? null;
    const upper = c.upperHours ?? null;
    const standard = lower != null && upper != null ? (lower + upper) / 2 : null;
    return { businessDays, lower, upper, standard };
  }
  if (c.settlementType === "FIXED") {
    const h = c.fixedHours ?? null;
    return { businessDays, lower: h, upper: h, standard: h };
  }
  if (c.settlementType === "BUSINESSDAY_BUFFER") {
    if (c.dailyStdHours == null) return { businessDays, lower: null, upper: null, standard: null };
    const standard = Math.round(businessDays * c.dailyStdHours * 10) / 10;
    const buf = c.bufferHours ?? 0;
    return { businessDays, lower: standard - buf, upper: standard + buf, standard };
  }
  return { businessDays, lower: null, upper: null, standard: null };
}

/** 指定年月・基準単価における控除/超過単価（その月の幅を基準に算出） */
function monthlyRates(
  c: SettlementInput,
  baseRate: number,
  range: { lower: number | null; upper: number | null; standard: number | null }
): { deduction: number | null; excess: number | null } {
  if (c.settlementMethod === "NONE") return { deduction: null, excess: null };
  if (c.settlementMethod === "MANUAL") {
    return { deduction: c.deductionRate ?? null, excess: c.excessRate ?? null };
  }
  if (c.settlementMethod === "MIDDLE") {
    if (!range.standard || range.standard <= 0) return { deduction: null, excess: null };
    const r = Math.round(baseRate / range.standard);
    return { deduction: r, excess: r };
  }
  if (c.settlementMethod === "UPPER_LOWER") {
    return {
      deduction: range.lower && range.lower > 0 ? Math.round(baseRate / range.lower) : null,
      excess: range.upper && range.upper > 0 ? Math.round(baseRate / range.upper) : null,
    };
  }
  return { deduction: null, excess: null };
}

export type MonthlySettlement = {
  businessDays: number;
  lower: number | null;
  upper: number | null;
  standard: number | null;
  workedHours: number;
  status: "within" | "deduct" | "excess" | "none" | "hourly";
  diffHours: number; // 不足/超過した時間（絶対値）
  unitRate: number | null; // 適用された控除 or 超過単価（時給契約では時給）
  adjustment: number; // 増減額（控除は負、超過は正）
  amount: number; // 最終精算額
};

/** 月ごとの実営業日数を考慮した精算額を自動計算 */
export function calcMonthlySettlement(
  c: SettlementInput,
  opts: { yearMonth: string; workedHours: number; baseRate: number }
): MonthlySettlement {
  const { yearMonth, workedHours, baseRate } = opts;
  const range = monthlyRange(c, yearMonth);

  // 時給契約: 実働時間 × 時給（精算幅・控除/超過なし）
  if (c.rateType === "HOURLY") {
    return {
      businessDays: range.businessDays,
      lower: null,
      upper: null,
      standard: null,
      workedHours,
      status: "hourly",
      diffHours: 0,
      unitRate: baseRate, // 時給そのもの
      adjustment: 0,
      amount: Math.round(baseRate * workedHours),
    };
  }

  const rates = monthlyRates(c, baseRate, range);

  // 精算しないケース
  if (c.settlementMethod === "NONE" || range.lower == null || range.upper == null) {
    return {
      businessDays: range.businessDays,
      lower: range.lower,
      upper: range.upper,
      standard: range.standard,
      workedHours,
      status: "none",
      diffHours: 0,
      unitRate: null,
      adjustment: 0,
      amount: baseRate,
    };
  }

  if (workedHours < range.lower && rates.deduction != null) {
    const diff = Math.round((range.lower - workedHours) * 10) / 10;
    const adjustment = -Math.round(diff * rates.deduction);
    return {
      businessDays: range.businessDays, lower: range.lower, upper: range.upper, standard: range.standard,
      workedHours, status: "deduct", diffHours: diff, unitRate: rates.deduction,
      adjustment, amount: baseRate + adjustment,
    };
  }
  if (workedHours > range.upper && rates.excess != null) {
    const diff = Math.round((workedHours - range.upper) * 10) / 10;
    const adjustment = Math.round(diff * rates.excess);
    return {
      businessDays: range.businessDays, lower: range.lower, upper: range.upper, standard: range.standard,
      workedHours, status: "excess", diffHours: diff, unitRate: rates.excess,
      adjustment, amount: baseRate + adjustment,
    };
  }
  // 範囲内
  return {
    businessDays: range.businessDays, lower: range.lower, upper: range.upper, standard: range.standard,
    workedHours, status: "within", diffHours: 0, unitRate: null,
    adjustment: 0, amount: baseRate,
  };
}

/** 控除・超過単価を表示用に整形（baseRate 基準で算出 or 個別指定値） */
export function settlementRatesText(c: SettlementInput, baseRate: number): {
  deduction: string;
  excess: string;
  dynamicNote: string | null;
} {
  if (c.rateType === "HOURLY") {
    return { deduction: "—", excess: "—", dynamicNote: null };
  }
  if (c.settlementMethod === "NONE") {
    return { deduction: "精算なし", excess: "精算なし", dynamicNote: null };
  }
  const { deduction, excess } = computeRates(c, baseRate);
  const { dynamic } = settlementHours(c);
  return {
    deduction: deduction != null ? `${yen(deduction)}／時間` : "—",
    excess: excess != null ? `${yen(excess)}／時間` : "—",
    dynamicNote:
      dynamic && c.settlementMethod !== "MANUAL"
        ? `※ 営業日数で変動。上記は${NOMINAL_BUSINESS_DAYS}営業日換算の目安`
        : null,
  };
}
