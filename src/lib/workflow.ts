// 申請ワークフローの共通ロジック（種別分類・夏季休暇ルール・日数計算）。
import { RequestType } from "./enums";

/** 明細（区間/金額）を持つ種別か（交通費・経費・定期券） */
export function isItemType(type: string): boolean {
  return (
    type === RequestType.TRANSPORT ||
    type === RequestType.EXPENSE ||
    type === RequestType.COMMUTER_PASS
  );
}

/** 休暇系の種別か（有給・夏季・慶弔） */
export function isLeaveType(type: string): boolean {
  return (
    type === RequestType.PAID_LEAVE ||
    type === RequestType.SUMMER_LEAVE ||
    type === RequestType.CONDOLENCE_LEAVE
  );
}

/**
 * 夏季休暇の付与日数。
 * ルール: 対象年に5日付与。ただし当該年の7/1以降に入社した社員は付与なし。
 * （前年以前の入社 = 5日 / 当該年6月以前入社 = 5日 / 当該年7/1以降入社 = 0日）
 */
export function summerLeaveGrant(joinedOn: Date | null, year: number): number {
  if (!joinedOn) return 5; // 入社日不明は付与扱い（運用で補正）
  const j = new Date(joinedOn);
  if (isNaN(j.getTime())) return 5;
  const jy = j.getFullYear();
  if (jy < year) return 5;
  if (jy > year) return 0;
  // 同年入社: 7/1（month=6）以降は付与なし
  const julyFirst = new Date(year, 6, 1);
  return j < julyFirst ? 5 : 0;
}

export type SummerLeaveInfo = {
  grant: number;
  used: number;
  remaining: number;
  eligible: boolean;
};

export function summerLeaveInfo(
  joinedOn: Date | null,
  year: number,
  usedDays: number
): SummerLeaveInfo {
  const grant = summerLeaveGrant(joinedOn, year);
  return {
    grant,
    used: usedDays,
    remaining: Math.max(0, grant - usedDays),
    eligible: grant > 0,
  };
}

/** 夏季休暇の取得可能期間（対象年の6/1〜12/31）か */
export function isWithinSummerWindow(d: Date): boolean {
  const y = d.getFullYear();
  const start = new Date(y, 5, 1); // 6/1
  const end = new Date(y, 11, 31, 23, 59, 59); // 12/31
  return d >= start && d <= end;
}

/** 期間（開始〜終了）の暦日数（両端含む）。終了未指定は1日 */
export function inclusiveDays(start: Date | null, end: Date | null): number {
  if (!start) return 0;
  if (!end) return 1;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
  return diff >= 0 ? diff + 1 : 1;
}

/** 申請の表示用サマリー（一覧の補足テキスト） */
export function requestSummary(req: {
  type: string;
  amount: number | null;
  days: number | null;
  hours: number | null;
  startDate: Date | null;
  endDate: Date | null;
  passPeriodMonths: number | null;
}): string {
  if (isItemType(req.type)) {
    const amt = req.amount != null ? `¥${req.amount.toLocaleString("ja-JP")}` : "—";
    if (req.type === RequestType.COMMUTER_PASS && req.passPeriodMonths) {
      return `${amt}（${req.passPeriodMonths}ヶ月）`;
    }
    return amt;
  }
  if (req.type === RequestType.PAID_LEAVE) {
    if (req.hours) return `${req.hours}時間`;
    if (req.days) return `${req.days}日`;
    return "—";
  }
  if (req.days) return `${req.days}日`;
  return "—";
}
