"use client";

import { useActionState } from "react";
import { importUploadedTimesheets } from "@/lib/actions";
import { Card, Badge, Table, Th, Td } from "@/components/ui";

const statusBadge: Record<string, { label: string; cls: string }> = {
  ready_create: { label: "新規取込", cls: "bg-emerald-100 text-emerald-700" },
  ready_update: { label: "更新取込", cls: "bg-blue-100 text-blue-700" },
  unmatched_engineer: { label: "技術者不一致", cls: "bg-rose-100 text-rose-700" },
  no_assignment: { label: "アサインなし", cls: "bg-amber-100 text-amber-700" },
  ambiguous: { label: "アサイン複数", cls: "bg-amber-100 text-amber-700" },
  invalid: { label: "読取失敗", cls: "bg-gray-200 text-gray-600" },
};

function formatYM(ym: string | null): string {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

type Row = {
  file: { fileName: string; engineerName: string | null; engineerCode: string | null; dailyCount: number };
  engineerName: string | null;
  yearMonth: string | null;
  projectTitle: string | null;
  totalHours: number | null;
  currentHours: number | null;
  status: string;
  message: string;
};
type State = {
  error?: string | null;
  rows: Row[];
  created: number;
  updated: number;
  previewOnly: boolean;
} | null;

export default function ImportUploader() {
  const [state, action, pending] = useActionState<State, FormData>(
    importUploadedTimesheets,
    null
  );

  const readyCount = state?.rows.filter(
    (r) => r.status === "ready_create" || r.status === "ready_update"
  ).length;

  return (
    <div>
      <Card className="p-5 mb-4">
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Excel勤務表を選択（複数可・.xlsx / .xls）
            </label>
            <input
              type="file"
              name="files"
              multiple
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:text-sm hover:file:bg-indigo-700"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="previewOnly" defaultChecked className="w-4 h-4" />
            プレビューのみ（内容を確認するだけでDBには反映しない）
          </label>
          <p className="text-xs text-gray-400">
            ※ まずプレビューで読み取り結果と突合先を確認し、問題なければチェックを外して再アップロードすると取込が実行されます。
            勤務表には「対象年月」「実働時間（または稼働時間）列」が必要です。氏名・要員番号はファイル名（例: 202601_168_林太郎_…）からも補完します。
          </p>
          <button
            type="submit"
            disabled={pending}
            className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "処理中…" : "アップロードして解析／取込"}
          </button>
        </form>
      </Card>

      {state?.error && (
        <div className="mb-4 rounded-lg bg-rose-50 text-rose-700 px-4 py-3 text-sm">{state.error}</div>
      )}

      {state && !state.error && (
        <>
          <div
            className={`mb-4 rounded-lg px-4 py-3 text-sm ${
              state.previewOnly ? "bg-blue-50 text-blue-800" : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {state.previewOnly ? (
              <>🔍 プレビュー結果です（DBには未反映）。取込可能 {readyCount} 件。問題なければ「プレビューのみ」を外して再アップロードしてください。</>
            ) : (
              <>✅ 取込が完了しました（新規 {state.created} 件・更新 {state.updated} 件）。</>
            )}
          </div>

          {state.rows.length > 0 && (
            <Card>
              <Table
                head={
                  <>
                    <Th>ファイル</Th>
                    <Th>技術者</Th>
                    <Th>対象月</Th>
                    <Th>案件</Th>
                    <Th className="text-right">取込時間</Th>
                    <Th className="text-right">現在値</Th>
                    <Th>判定</Th>
                  </>
                }
              >
                {state.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 align-top">
                    <Td className="text-xs text-gray-600 font-mono">{r.file.fileName}</Td>
                    <Td>
                      {r.engineerName ? (
                        <span className="text-gray-800">{r.engineerName}</span>
                      ) : (
                        <span className="text-gray-400">
                          {r.file.engineerName || r.file.engineerCode || "—"}
                        </span>
                      )}
                    </Td>
                    <Td className="text-gray-600 text-xs">{formatYM(r.yearMonth)}</Td>
                    <Td className="text-gray-600 text-xs">{r.projectTitle || "—"}</Td>
                    <Td className="text-right font-medium">
                      {r.totalHours != null ? `${r.totalHours}h` : "—"}
                      {r.file.dailyCount > 0 && (
                        <div className="text-xs text-gray-400">{r.file.dailyCount}日分</div>
                      )}
                    </Td>
                    <Td className="text-right text-gray-500 text-xs">
                      {r.currentHours != null ? `${r.currentHours}h` : "—"}
                    </Td>
                    <Td>
                      <Badge className={statusBadge[r.status]?.cls || "bg-gray-100 text-gray-600"}>
                        {statusBadge[r.status]?.label || r.status}
                      </Badge>
                      <div className="text-xs text-gray-400 mt-0.5 max-w-xs">{r.message}</div>
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
