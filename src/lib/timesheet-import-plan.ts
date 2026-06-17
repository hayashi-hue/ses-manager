// 勤務表の解析結果を、エンジニア・アサインに突合して取込プランを作る（DB読取のみ）
import { prisma } from "./db";
import { parseInboxFolder, type ParsedTimesheet } from "./timesheet-import";

export type ImportStatus =
  | "ready_create"
  | "ready_update"
  | "unmatched_engineer"
  | "no_assignment"
  | "ambiguous"
  | "invalid";

export type ImportRow = {
  file: ParsedTimesheet;
  engineerId: string | null;
  engineerName: string | null;
  assignmentId: string | null;
  projectTitle: string | null;
  yearMonth: string | null;
  totalHours: number | null;
  currentHours: number | null;
  status: ImportStatus;
  message: string;
};

const statusMessage: Record<ImportStatus, string> = {
  ready_create: "新規取込（当月の工数を作成）",
  ready_update: "更新取込（当月の工数を上書き）",
  unmatched_engineer: "氏名/要員番号に一致する技術者が見つかりません",
  no_assignment: "対象月に有効なアサインがありません",
  ambiguous: "対象月のアサインが複数あり特定できません（案件名を勤務表に記載してください）",
  invalid: "対象年月または稼働時間が読み取れませんでした",
};

function stripSpace(s: string): string {
  return s.replace(/[\s　]/g, "");
}

function monthBounds(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
}

/** 解析済みファイル群を技術者・アサインに突合してプラン化（アップロード/フォルダ共通） */
export async function buildPlanFromParsed(files: ParsedTimesheet[]): Promise<ImportRow[]> {
  const engineers = await prisma.engineer.findMany({
    include: {
      assignments: {
        where: { status: { in: ["ACTIVE", "ORDERED", "ENDED"] } },
        include: { project: true, timesheets: true },
      },
    },
  });

  const rows: ImportRow[] = [];
  for (const f of files) {
    const row: ImportRow = {
      file: f,
      engineerId: null,
      engineerName: null,
      assignmentId: null,
      projectTitle: null,
      yearMonth: f.yearMonth,
      totalHours: f.totalHours,
      currentHours: null,
      status: "invalid",
      message: "",
    };

    if (!f.yearMonth || f.totalHours == null) {
      row.status = "invalid";
      row.message = statusMessage.invalid + (f.warnings.length ? `（${f.warnings.join(" / ")}）` : "");
      rows.push(row);
      continue;
    }

    // 技術者の特定（要員番号 → 氏名）
    let eng = f.engineerCode
      ? engineers.find((e) => stripSpace(e.code).toLowerCase() === stripSpace(f.engineerCode!).toLowerCase())
      : undefined;
    if (!eng && f.engineerName) {
      const target = stripSpace(f.engineerName);
      eng =
        engineers.find((e) => stripSpace(e.name) === target) ||
        engineers.find((e) => stripSpace(e.name).includes(target) || target.includes(stripSpace(e.name)));
    }
    if (!eng) {
      row.status = "unmatched_engineer";
      row.message = `${statusMessage.unmatched_engineer}（勤務表: ${f.engineerName || f.engineerCode || "氏名不明"}）`;
      rows.push(row);
      continue;
    }
    row.engineerId = eng.id;
    row.engineerName = eng.name;

    // 対象月に有効なアサイン
    const { start, end } = monthBounds(f.yearMonth);
    let candidates = eng.assignments.filter((a) => {
      const s = a.startOn ? new Date(a.startOn) : null;
      const e = a.endOn ? new Date(a.endOn) : null;
      const startsOk = !s || s <= end;
      const endsOk = !e || e >= start;
      return startsOk && endsOk;
    });
    // 案件名ヒントで絞り込み
    if (candidates.length > 1 && f.projectHint) {
      const hint = stripSpace(f.projectHint);
      const narrowed = candidates.filter(
        (a) => stripSpace(a.project.title).includes(hint) || hint.includes(stripSpace(a.project.title))
      );
      if (narrowed.length >= 1) candidates = narrowed;
    }

    if (candidates.length === 0) {
      row.status = "no_assignment";
      row.message = statusMessage.no_assignment;
      rows.push(row);
      continue;
    }
    if (candidates.length > 1) {
      row.status = "ambiguous";
      row.message = statusMessage.ambiguous;
      rows.push(row);
      continue;
    }

    const a = candidates[0];
    row.assignmentId = a.id;
    row.projectTitle = a.project.title;
    const existing = a.timesheets.find((t) => t.yearMonth === f.yearMonth);
    row.currentHours = existing ? existing.workedHours : null;
    row.status = existing ? "ready_update" : "ready_create";
    row.message = statusMessage[row.status];
    rows.push(row);
  }

  return rows;
}

/** ローカルフォルダ取込（dev用）。アップロードは buildPlanFromParsed を使用 */
export async function buildImportPlan(explicitDir?: string | null): Promise<{
  dir: string;
  exists: boolean;
  fileCount: number;
  rows: ImportRow[];
}> {
  const { dir, exists, files } = parseInboxFolder(explicitDir);
  const rows = await buildPlanFromParsed(files);
  return { dir, exists, fileCount: files.length, rows };
}
