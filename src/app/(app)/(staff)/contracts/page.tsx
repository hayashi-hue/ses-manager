import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentYearMonth } from "@/lib/utils";
import { PageHeader, Card, Badge, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

const YM_RE = /^\d{4}-\d{2}$/;

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(from: string, to: string): { y: number; m: number; key: string }[] {
  const out: { y: number; m: number; key: string }[] = [];
  let cur = from;
  for (let i = 0; i < 24; i++) {
    const [y, m] = cur.split("-").map(Number);
    out.push({ y, m, key: cur });
    if (cur === to) break;
    cur = addMonths(cur, 1);
    if (cur > to) break;
  }
  return out;
}

type RowContract = {
  monthlyRate: number;
  rateType: string;
  startOn: Date | null;
  endOn: Date | null;
  asgStart: Date | null;
  asgEnd: Date | null;
  clientName: string;
};
type Row = {
  engineer: { id: string; name: string; code: string; employmentType: string; status: string };
  client: { id: string; name: string };
  contracts: RowContract[];
};

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    clientId?: string;
    employ?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "client" ? "client" : "engineer";
  const from = sp.from && YM_RE.test(sp.from) ? sp.from : currentYearMonth();
  let to = sp.to && YM_RE.test(sp.to) ? sp.to : addMonths(currentYearMonth(), 6);
  if (to < from) to = from;
  const clientId = sp.clientId || "";
  const employ = sp.employ || "ACTIVE_ALL";
  const q = (sp.q || "").trim();

  const months = monthsBetween(from, to);
  const nowYm = currentYearMonth();
  const rangeStart = new Date(Number(from.slice(0, 4)), Number(from.slice(5)) - 1, 1);
  const rangeEnd = new Date(Number(to.slice(0, 4)), Number(to.slice(5)), 0, 23, 59, 59);

  const [contracts, clients] = await Promise.all([
    prisma.contract.findMany({
      include: {
        assignment: { include: { engineer: true, project: { include: { client: true } } } },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // 期間と重なる契約のみ＋各フィルタ
  const filtered = contracts.filter((c) => {
    const e = c.assignment.engineer;
    const cs = c.startOn ?? c.assignment.startOn;
    const ce = c.endOn ?? c.assignment.endOn;
    if (cs && new Date(cs) > rangeEnd) return false;
    if (ce && new Date(ce) < rangeStart) return false;
    if (clientId && c.assignment.project.clientId !== clientId) return false;
    if (q && !e.name.includes(q)) return false;
    if (employ === "ACTIVE_ALL" && e.status === "RETIRED") return false;
    if (employ === "OWN" && (e.employmentType === "BP" || e.status === "RETIRED")) return false;
    if (employ === "PARTNER" && e.employmentType !== "BP") return false;
    return true;
  });

  // 行へグルーピング（エンジニア別 or 取引先×エンジニア別）
  const rowMap = new Map<string, Row>();
  for (const c of filtered) {
    const e = c.assignment.engineer;
    const cl = c.assignment.project.client;
    const key = tab === "client" ? `${cl.id}__${e.id}` : e.id;
    if (!rowMap.has(key)) {
      rowMap.set(key, {
        engineer: { id: e.id, name: e.name, code: e.code, employmentType: e.employmentType, status: e.status },
        client: { id: cl.id, name: cl.name },
        contracts: [],
      });
    }
    rowMap.get(key)!.contracts.push({
      monthlyRate: c.monthlyRate,
      rateType: c.rateType,
      startOn: c.startOn,
      endOn: c.endOn,
      asgStart: c.assignment.startOn,
      asgEnd: c.assignment.endOn,
      clientName: cl.name,
    });
  }
  const rows = [...rowMap.values()].sort((a, b) =>
    tab === "client"
      ? a.client.name.localeCompare(b.client.name, "ja") || a.engineer.name.localeCompare(b.engineer.name, "ja")
      : a.engineer.name.localeCompare(b.engineer.name, "ja")
  );

  type Cell = {
    rate: number | null;
    hourly: boolean;
    bench: boolean;
    trend: "up" | "down" | "none";
    isEnd: boolean;
  };
  function buildCells(row: Row): Cell[] {
    const raw = months.map(({ y, m }) => {
      const mStart = new Date(y, m - 1, 1);
      const mEnd = new Date(y, m, 0, 23, 59, 59);
      for (const c of row.contracts) {
        const cs = c.startOn ?? c.asgStart;
        const ce = c.endOn ?? c.asgEnd;
        const afterStart = !cs || new Date(cs) <= mEnd;
        const beforeEnd = !ce || new Date(ce) >= mStart;
        if (afterStart && beforeEnd) {
          // 契約終了月＝契約終了日がその月に含まれる
          const isEnd = !!ce && new Date(ce) >= mStart && new Date(ce) <= mEnd;
          return { rate: c.monthlyRate, hourly: c.rateType === "HOURLY", isEnd };
        }
      }
      return null;
    });
    const firstIdx = raw.findIndex((x) => x);
    const lastIdx = raw.length - 1 - [...raw].reverse().findIndex((x) => x);
    let prevRate: number | null = null;
    return raw.map((x, i) => {
      if (x) {
        let trend: "up" | "down" | "none" = "none";
        if (prevRate != null && x.rate > prevRate) trend = "up";
        else if (prevRate != null && x.rate < prevRate) trend = "down";
        prevRate = x.rate;
        return { rate: x.rate, hourly: x.hourly, bench: false, trend, isEnd: x.isEnd };
      }
      // 稼動がない月（契約の谷間＝待機・育休・休職など）
      const bench = firstIdx >= 0 && i > firstIdx && i < lastIdx;
      return { rate: null, hourly: false, bench, trend: "none" as const, isEnd: false };
    });
  }

  const EMPLOY_OPTS: { v: string; label: string }[] = [
    { v: "ACTIVE_ALL", label: "在籍中の自社社員／パートナー社員" },
    { v: "OWN", label: "自社社員のみ" },
    { v: "PARTNER", label: "パートナー社員のみ" },
    { v: "ALL", label: "すべて（退職含む）" },
  ];

  return (
    <div>
      <PageHeader
        title="契約一覧"
        subtitle={`${rows.length} 件（${from} 〜 ${to}）`}
        action={<LinkButton href="/contracts/new">＋ 契約を作成</LinkButton>}
      />

      <div className="flex items-center gap-1 mb-3 border-b border-gray-200">
        {[
          { k: "engineer", label: "エンジニア別" },
          { k: "client", label: "取引先別" },
        ].map((t) => {
          const params = new URLSearchParams({ tab: t.k, from, to, employ });
          if (clientId) params.set("clientId", clientId);
          if (q) params.set("q", q);
          const active = tab === t.k;
          return (
            <Link
              key={t.k}
              href={`/contracts?${params.toString()}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                active ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <Card className="p-5 mb-4">
        <form method="get" className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <input type="hidden" name="tab" value={tab} />
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="block text-sm font-medium text-gray-700 mb-1">期間（開始）</span>
              <input type="month" name="from" defaultValue={from} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
            </label>
            <span className="pb-2 text-gray-400">〜</span>
            <label className="block flex-1">
              <span className="block text-sm font-medium text-gray-700 mb-1">期間（終了）</span>
              <input type="month" name="to" defaultValue={to} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">取引先会社</span>
            <select name="clientId" defaultValue={clientId} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
              <option value="">指定なし</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">在籍の状態</span>
            <select name="employ" defaultValue={employ} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
              {EMPLOY_OPTS.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="block text-sm font-medium text-gray-700 mb-1">社員名</span>
              <input type="text" name="q" defaultValue={q} placeholder="検索したい社員名を入力してください" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
            </label>
            <button className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shrink-0">
              検索
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState message="該当する契約がありません" hint="期間・条件を変更して再検索してください" />
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-600 border-b border-r border-gray-200 min-w-[160px]">
                    {tab === "client" ? "取引先 / 社員" : "社員"}
                  </th>
                  {months.map((mo) => (
                    <th
                      key={mo.key}
                      className={`px-2 py-2 text-center font-medium border-b border-gray-200 whitespace-nowrap ${
                        mo.key === nowYm ? "bg-indigo-100 text-indigo-700" : "text-gray-500"
                      }`}
                    >
                      {mo.y}/{String(mo.m).padStart(2, "0")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const cells = buildCells(row);
                  const isOwn = row.engineer.employmentType !== "BP";
                  return (
                    <tr key={`${row.client.id}-${row.engineer.id}`} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r border-gray-200">
                        {tab === "client" && (
                          <div className="text-xs text-gray-400">{row.client.name}</div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Link href={`/engineers/${row.engineer.id}`} className="font-medium text-gray-800 hover:text-indigo-600">
                            {row.engineer.name}
                          </Link>
                          <Badge className={isOwn ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}>
                            {isOwn ? "自社" : "PT"}
                          </Badge>
                        </div>
                      </td>
                      {cells.map((cell, i) => (
                        <td
                          key={i}
                          className={`px-2 py-2 text-center whitespace-nowrap border-b border-gray-100 tabular-nums ${
                            cell.bench
                              ? "bg-rose-100 text-rose-700 font-bold"
                              : cell.isEnd
                              ? "bg-blue-100 text-blue-700"
                              : cell.trend === "up"
                              ? "bg-yellow-100 text-yellow-800"
                              : cell.trend === "down"
                              ? "bg-violet-100 text-violet-700"
                              : cell.rate != null
                              ? "text-gray-700"
                              : ""
                          } ${months[i].key === nowYm ? "ring-1 ring-inset ring-indigo-300" : ""}`}
                        >
                          {cell.bench
                            ? "待機"
                            : cell.rate != null
                            ? `${cell.rate.toLocaleString("ja-JP")}${cell.hourly ? "/h" : ""}`
                            : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-500 mt-3 flex flex-wrap gap-x-3 gap-y-1">
        <span>セル＝客先単価（実単価）</span>
        <span><span className="inline-block w-3 h-3 align-middle bg-blue-100 border border-blue-300 mr-1"></span>契約終了月</span>
        <span><span className="inline-block w-3 h-3 align-middle bg-yellow-100 border border-yellow-300 mr-1"></span>単価アップ</span>
        <span><span className="inline-block w-3 h-3 align-middle bg-violet-100 border border-violet-300 mr-1"></span>単価ダウン</span>
        <span><span className="inline-block w-3 h-3 align-middle bg-rose-100 border border-rose-300 mr-1"></span>稼動なし（待機・育休・休職）</span>
        <span className="text-gray-400">／ 自社＝自社社員・PT＝パートナー社員</span>
      </p>
    </div>
  );
}
