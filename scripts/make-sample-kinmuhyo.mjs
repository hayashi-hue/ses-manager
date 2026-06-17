// サンプル勤務表(Excel)を生成して 勤務表/ フォルダに置く（取込テスト用）
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const inbox = path.join(projectRoot, "勤務表");
fs.mkdirSync(inbox, { recursive: true });

const WDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function buildWorkbook({ name, code, project, year, month, overtimeDays = [] }) {
  const aoa = [];
  aoa.push(["勤務表"]);
  aoa.push(["氏名", name, "", "要員番号", code]);
  aoa.push(["対象年月", `${year}-${String(month).padStart(2, "0")}`, "", "案件", project]);
  aoa.push([]);
  aoa.push(["日付", "曜日", "出社", "退社", "稼働時間", "備考"]);

  const daysInMonth = new Date(year, month, 0).getDate();
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // 土日は稼働なし（行も作らない）
    const ot = overtimeDays.includes(d);
    const hours = ot ? 10 : 8;
    total += hours;
    aoa.push([
      `${year}/${month}/${d}`,
      WDAYS[dow],
      "09:00",
      ot ? "20:00" : "18:00",
      hours,
      ot ? "残業" : "",
    ]);
  }
  aoa.push(["合計", "", "", "", total, ""]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "勤務表");
  return { wb, total };
}

// 山田太郎 2026-06：22営業日中5日残業 → 合計186h（精算上限180h超過のデモ）
const s1 = buildWorkbook({
  name: "山田 太郎",
  code: "ENG-001",
  project: "基幹システム刷新 / Javaエンジニア",
  year: 2026,
  month: 6,
  overtimeDays: [3, 10, 17, 24, 30],
});
XLSX.writeFile(s1.wb, path.join(inbox, "勤務表_山田太郎_2026-06.xlsx"));
console.log(`生成: 勤務表_山田太郎_2026-06.xlsx（合計 ${s1.total}h）`);

// 中村由美 2026-06：残業なし → 合計176h（基準176h・範囲内のデモ）
const s2 = buildWorkbook({
  name: "中村 由美",
  code: "ENG-008",
  project: "基幹システム刷新 / Javaエンジニア",
  year: 2026,
  month: 6,
  overtimeDays: [],
});
XLSX.writeFile(s2.wb, path.join(inbox, "勤務表_中村由美_2026-06.xlsx"));
console.log(`生成: 勤務表_中村由美_2026-06.xlsx（合計 ${s2.total}h）`);

console.log(`出力先: ${inbox}`);
