// 勤務表(Excel)フォルダ取込: 日次明細から月次稼働時間を自動集計する
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

/** 取込フォルダ名（ses-manager直下のデフォルト） */
const INBOX_DIRNAME = "勤務表";

/** デフォルトの取込フォルダパスを解決（dev起動時のcwdの違いに対応） */
export function defaultInboxDir(): string {
  const candidates = [
    path.join(process.cwd(), INBOX_DIRNAME),
    path.join(process.cwd(), "ses-manager", INBOX_DIRNAME),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
    } catch {
      /* noop */
    }
  }
  return candidates[candidates.length - 1];
}

/** 取込フォルダパスを解決（明示指定があればそれを優先） */
export function resolveInboxDir(explicit?: string | null): string {
  const dir = (explicit || "").trim();
  if (dir) return path.normalize(dir);
  return defaultInboxDir();
}

/** フォルダ内のExcelファイル一覧 */
export function listWorkbooks(dir: string): string[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(xlsx|xls)$/i.test(f) && !f.startsWith("~$"))
      .sort();
  } catch {
    return [];
  }
}

export type ParsedTimesheet = {
  fileName: string;
  engineerName: string | null;
  engineerCode: string | null;
  yearMonth: string | null; // "YYYY-MM"
  projectHint: string | null; // 案件名らしき文字列（複数アサイン時の絞り込み用）
  totalHours: number | null;
  dailyCount: number; // 稼働日数（0時間でない日数）
  warnings: string[];
};

const NAME_LABELS = ["氏名", "名前", "技術者名", "社員名", "従業員名", "担当者"];
const CODE_LABELS = ["要員番号", "社員番号", "技術者番号", "社員ID", "要員ID", "従業員番号"];
const YM_LABELS = ["対象年月", "対象月", "対象期間", "年月", "勤務月", "稼働月"];
const PROJECT_LABELS = ["案件", "現場", "プロジェクト", "常駐先", "就業先", "業務"];
// 稼働時間列ヘッダー: 強一致（具体的な語）を優先。弱一致は「時間」を含むが除外語を含まないもの
const HOURS_HEADERS_STRONG = [
  "実働時間", "実労働時間", "稼働時間", "労働時間", "作業時間", "就業時間", "勤務時間", "実働", "稼働",
];
const HOURS_HEADER_EXCLUDE = ["始業", "終業", "休憩", "開始", "終了", "予定", "残業", "深夜", "出社", "退社"];
const TOTAL_LABELS = ["合計", "総計", "総合計", "月合計", "総労働時間", "総稼働"];

/** ファイル名から氏名・要員番号・対象年月を推測（セルに無い場合の補完）
 *  例: "202601_168_林太郎_現場勤務表.xlsx" → ym=2026-01, code=168, name=林太郎 */
function parseFilenameMeta(fileName: string): {
  yearMonth: string | null;
  code: string | null;
  name: string | null;
} {
  const base = fileName.replace(/\.(xlsx|xls)$/i, "");
  const tokens = base.split(/[_\-\s　]+/).filter(Boolean);
  let yearMonth: string | null = null;
  let code: string | null = null;
  let name: string | null = null;

  for (const t of tokens) {
    const ym = t.match(/^(\d{4})(\d{2})$/);
    if (ym && Number(ym[2]) >= 1 && Number(ym[2]) <= 12) {
      yearMonth = `${ym[1]}-${ym[2]}`;
      break;
    }
    const ym2 = normalizeYearMonth(t);
    if (ym2) {
      yearMonth = ym2;
      break;
    }
  }
  // 要員番号: 6桁(年月)以外の数字トークン
  for (const t of tokens) {
    if (/^\d{1,5}$/.test(t)) {
      code = t;
      break;
    }
  }
  // 氏名: CJK文字を含み、帳票名キーワードを含まないトークン
  const NG = ["勤務表", "勤怠", "現場", "出勤簿", "タイムシート", "報告"];
  for (const t of tokens) {
    if (/[぀-ヿ一-龯]/.test(t) && !NG.some((k) => t.includes(k))) {
      name = t;
      break;
    }
  }
  return { yearMonth, code, name };
}

/** セル値を文字列化 */
function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** "8:00" / "8.5" / "8時間30分" / "8" などを時間(float)に変換 */
function parseHours(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excelのシリアルでないただのhならそのままだが、1未満は時刻シリアルの可能性 → ×24
    if (v > 0 && v < 1) return Math.round(v * 24 * 100) / 100;
    return v;
  }
  const s = String(v).trim();
  if (!s) return null;
  // h:mm 形式
  const hm = s.match(/^(\d+):(\d{1,2})$/);
  if (hm) return Math.round((Number(hm[1]) + Number(hm[2]) / 60) * 100) / 100;
  // 8時間30分 / 8時間
  const jp = s.match(/(\d+(?:\.\d+)?)\s*時間(?:\s*(\d+)\s*分)?/);
  if (jp) return Math.round((Number(jp[1]) + (jp[2] ? Number(jp[2]) / 60 : 0)) * 100) / 100;
  // 単純数値
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return isNaN(n) ? null : n;
}

/** 年月文字列を "YYYY-MM" に正規化 */
function normalizeYearMonth(s: string): string | null {
  const m = s.match(/(\d{4})\s*[年\/\-.]\s*(\d{1,2})/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  return null;
}

function includesAny(text: string, labels: string[]): boolean {
  return labels.some((l) => text.includes(l));
}

/** ファイルパスから解析（ローカルフォルダ取込用） */
export function parseWorkbookFile(filePath: string): ParsedTimesheet {
  return parseWorkbookBuffer(path.basename(filePath), fs.readFileSync(filePath));
}

/** Buffer から解析（アップロード取込用・クラウド対応） */
export function parseWorkbookBuffer(fileName: string, buf: Buffer): ParsedTimesheet {
  const warnings: string[] = [];
  const result: ParsedTimesheet = {
    fileName,
    engineerName: null,
    engineerCode: null,
    yearMonth: null,
    projectHint: null,
    totalHours: null,
    dailyCount: 0,
    warnings,
  };

  let rows: unknown[][];
  try {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
  } catch (e) {
    warnings.push(`ファイル読込エラー: ${(e as Error).message}`);
    return result;
  }

  // ラベル隣接値の取得（右→下の順）
  const findLabelValue = (labels: string[]): string | null => {
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const text = cellStr(rows[r][c]);
        if (text && includesAny(text, labels)) {
          // 右方向
          for (let cc = c + 1; cc < rows[r].length; cc++) {
            const rv = cellStr(rows[r][cc]);
            if (rv) return rv;
          }
          // 下方向
          if (rows[r + 1]) {
            const dv = cellStr(rows[r + 1][c]);
            if (dv) return dv;
          }
          // ラベルと値が同一セル（例: "氏名: 山田太郎"）
          const inline = text.replace(new RegExp(`.*(?:${labels.join("|")})\\s*[:：]?\\s*`), "");
          if (inline && inline !== text) return inline;
        }
      }
    }
    return null;
  };

  // 氏名・要員番号・対象年月・案件
  result.engineerName = findLabelValue(NAME_LABELS);
  result.engineerCode = findLabelValue(CODE_LABELS);
  result.projectHint = findLabelValue(PROJECT_LABELS);

  const ymRaw = findLabelValue(YM_LABELS);
  if (ymRaw) result.yearMonth = normalizeYearMonth(ymRaw);
  if (!result.yearMonth) {
    // どこかのセルに年月パターンがあれば拾う
    outer: for (const row of rows) {
      for (const cell of row) {
        const ym = normalizeYearMonth(cellStr(cell));
        if (ym) {
          result.yearMonth = ym;
          break outer;
        }
      }
    }
  }

  // ファイル名から氏名・要員番号・年月を補完（セルに無い場合）
  const meta = parseFilenameMeta(fileName);
  if (!result.engineerName && meta.name) result.engineerName = meta.name;
  if (!result.engineerCode && meta.code) result.engineerCode = meta.code;
  if (!result.yearMonth && meta.yearMonth) result.yearMonth = meta.yearMonth;

  // 稼働時間列を特定（強一致を優先、無ければ「時間」を含み除外語を含まない列）
  let hoursCol = -1;
  let headerRow = -1;
  // 強一致パス
  for (let r = 0; r < rows.length && hoursCol < 0; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const text = cellStr(rows[r][c]);
      if (text && includesAny(text, HOURS_HEADERS_STRONG)) {
        hoursCol = c;
        headerRow = r;
        break;
      }
    }
  }
  // 弱一致パス
  if (hoursCol < 0) {
    for (let r = 0; r < rows.length && hoursCol < 0; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const text = cellStr(rows[r][c]);
        if (text && text.includes("時間") && !HOURS_HEADER_EXCLUDE.some((k) => text.includes(k))) {
          hoursCol = c;
          headerRow = r;
          break;
        }
      }
    }
  }

  if (hoursCol < 0) {
    warnings.push("稼働時間の列が見つかりませんでした（ヘッダーに『実働時間』『稼働時間』等が必要）");
    return result;
  }

  // 合計行があれば優先、なければ日次を合算
  let totalFromLabel: number | null = null;
  let sum = 0;
  let dailyCount = 0;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const firstCells = rows[r].map(cellStr).join(" ");
    const isTotalRow =
      includesAny(firstCells.replace(/[\s　]/g, ""), TOTAL_LABELS) ||
      /^[\s　]*計[\s　]*$/.test(cellStr(rows[r][0]));
    if (isTotalRow) {
      // 合計列がhoursCol以外（備考列等）にある場合も拾えるよう行全体から最大の時間値を採用
      let best: number | null = null;
      for (const cell of rows[r]) {
        const hv2 = parseHours(cell);
        if (hv2 != null && hv2 > 0 && (best == null || hv2 > best)) best = hv2;
      }
      if (best != null) totalFromLabel = best;
      continue;
    }
    const hv = parseHours(rows[r][hoursCol]);
    if (hv != null && hv > 0) {
      sum += hv;
      dailyCount++;
    }
  }

  result.dailyCount = dailyCount;
  // 合計行の値と日次合算が大きく食い違う場合は日次合算を優先（合計列の誤検出対策）
  let total = sum;
  if (totalFromLabel != null) {
    if (sum === 0 || Math.abs(totalFromLabel - sum) <= Math.max(2, sum * 0.05)) {
      total = totalFromLabel;
    }
  }
  result.totalHours = total > 0 ? Math.round(total * 100) / 100 : null;

  if (!result.engineerName && !result.engineerCode)
    warnings.push("氏名・要員番号が見つかりませんでした");
  if (!result.yearMonth) warnings.push("対象年月が見つかりませんでした");
  if (result.totalHours == null) warnings.push("稼働時間の合計が0でした");

  return result;
}

/** フォルダ全体を解析（DB書込なし）。explicitDir 指定で任意フォルダを対象にできる */
export function parseInboxFolder(explicitDir?: string | null): {
  dir: string;
  exists: boolean;
  files: ParsedTimesheet[];
} {
  const dir = resolveInboxDir(explicitDir);
  const exists = (() => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  })();
  const files = exists
    ? listWorkbooks(dir).map((f) => parseWorkbookFile(path.join(dir, f)))
    : [];
  return { dir, exists, files };
}
