// ダッシュボード指標の算出ロジック（有給取得率・平均残業・単価据え置き判定）。
// 値の根拠を1か所に集約し、画面側は表示に専念する。
import { businessDaysInMonth } from "./settlement";

/** 2日付間の満経過月数（日が満たない分は切り捨て。負値は0） */
export function monthsBetween(from: Date, to: Date): number {
  let m =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) m -= 1; // 月途中で未到達の分を減算
  return Math.max(0, m);
}

/**
 * 法定の年次有給休暇 付与日数（フルタイム前提・勤続年数ベース）。
 * 0.5年=10 / 1.5年=11 / 2.5年=12 / 3.5年=14 / 4.5年=16 / 5.5年=18 / 6.5年〜=20。
 * 入社6ヶ月未満・入社日不明は0（付与前）扱い。
 */
export function statutoryAnnualLeaveDays(
  joinedOn: Date | null | undefined,
  asOf: Date = new Date()
): number {
  if (!joinedOn) return 0;
  const j = new Date(joinedOn);
  if (isNaN(j.getTime())) return 0;
  const months = monthsBetween(j, asOf);
  if (months < 6) return 0;
  if (months < 18) return 10;
  if (months < 30) return 11;
  if (months < 42) return 12;
  if (months < 54) return 14;
  if (months < 66) return 16;
  if (months < 78) return 18;
  return 20;
}

/** 有給申請を取得日数に換算（全休/半休=days、時間休=hours÷8時間） */
export function paidLeaveDaysTaken(req: {
  days: number | null;
  hours: number | null;
}): number {
  const d = req.days ?? 0;
  const h = req.hours ? req.hours / 8 : 0;
  return d + h;
}

/** 指定月の残業時間（所定労働時間=その月の実営業日数×8時間 を超えた分） */
export function overtimeHours(workedHours: number, yearMonth: string): number {
  const std = businessDaysInMonth(yearMonth) * 8;
  return Math.max(0, workedHours - std);
}

/** 単価据え置き判定の入力（あるエンジニアの契約1件） */
export type RateContractInput = {
  contractId: string;
  monthlyRate: number; // 実単価（月額 or 時給）
  engineerRate: number | null; // 提示単価
  rateType: string; // MONTHLY / HOURLY
  startOn: Date | null;
  signedOn: Date | null;
  createdAt: Date;
  active: boolean; // 紐づくアサインが ACTIVE/ORDERED か
  clientName: string;
  projectTitle: string;
};

/** 単価据え置きの判定結果 */
export type StaleRate = {
  contractId: string;
  unchangedSince: Date; // 現在単価が適用され始めた日
  monthsHeld: number; // 据え置き月数
  currentRate: number;
  currentEngineerRate: number | null;
  rateType: string;
  clientName: string;
  projectTitle: string;
};

/** 契約の適用開始日（startOn → signedOn → createdAt の順で確定） */
function effectiveDate(c: RateContractInput): Date {
  return c.startOn ?? c.signedOn ?? c.createdAt;
}

/**
 * あるエンジニアの契約群から「現在の実単価が何ヶ月据え置かれているか」を算出する。
 * 現役契約（ACTIVE/ORDERED）の最新を現在単価とし、過去へ同一単価が続く限り遡って
 * 据え置き開始日を確定する。現役契約が無い／閾値未満なら null。
 */
export function staleRateForEngineer(
  contracts: RateContractInput[],
  asOf: Date = new Date(),
  thresholdMonths = 6
): StaleRate | null {
  if (contracts.length === 0) return null;
  const sorted = [...contracts].sort(
    (a, b) => effectiveDate(a).getTime() - effectiveDate(b).getTime()
  );
  const activeOnes = sorted.filter((c) => c.active);
  if (activeOnes.length === 0) return null;

  // 現役契約のうち最新の適用開始を「現在単価」とする
  const current = activeOnes[activeOnes.length - 1];
  const currentRate = current.monthlyRate;
  const idx = sorted.indexOf(current);

  // 現在契約から過去へ、同一単価が連続する限り据え置き開始日を遡る
  let since = effectiveDate(current);
  for (let i = idx - 1; i >= 0; i--) {
    if (sorted[i].monthlyRate === currentRate) {
      since = effectiveDate(sorted[i]);
    } else {
      break;
    }
  }

  const monthsHeld = monthsBetween(since, asOf);
  if (monthsHeld < thresholdMonths) return null;

  return {
    contractId: current.contractId,
    unchangedSince: since,
    monthsHeld,
    currentRate,
    currentEngineerRate: current.engineerRate,
    rateType: current.rateType,
    clientName: current.clientName,
    projectTitle: current.projectTitle,
  };
}
