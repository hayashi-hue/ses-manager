import Link from "next/link";
import { prisma } from "@/lib/db";
import { createOffer } from "@/lib/actions";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { Field, Select, Textarea, SubmitButton } from "@/components/form";

export const dynamic = "force-dynamic";

// 営業中の判定対象ステータス（稼働中=ASSIGNED 以外で営業対象になりうる）
const SALES_STATUSES = ["AVAILABLE", "PARTIAL", "LEAVING"];
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

function availLabel(d: Date | null): string {
  if (!d) return "即日";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "即日";
  return `${dt.getFullYear()}年 ${String(dt.getMonth() + 1).padStart(2, "0")}月 ${String(
    dt.getDate()
  ).padStart(2, "0")}日`;
}

function StatPill({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${count > 0 ? "text-indigo-700" : "text-gray-700"}`}>
        {count}
      </span>
      <span className="text-xs text-gray-400">件</span>
    </span>
  );
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ engineerId?: string; projectId?: string }>;
}) {
  const sp = await searchParams;

  const [engineers, projects] = await Promise.all([
    prisma.engineer.findMany({
      where: { status: { not: "RETIRED" } },
      orderBy: { name: "asc" },
      include: {
        offers: { select: { status: true, respondedAt: true } },
        assignments: { select: { status: true } },
      },
    }),
    prisma.project.findMany({
      where: { status: { in: ["OPEN", "PROPOSING", "ONGOING"] } },
      orderBy: { updatedAt: "desc" },
      include: { client: true },
    }),
  ]);

  const now = Date.now();
  const rows = engineers
    .map((e) => {
      const cnt = (arr: { status: string }[], s: string) => arr.filter((x) => x.status === s).length;
      const offered = cnt(e.offers, "OFFERED"); // 保留
      const proceed = cnt(e.offers, "PROCEED"); // 承諾
      const declined = cnt(e.offers, "DECLINED"); // 辞退
      const adjusting = cnt(e.assignments, "PROPOSED"); // 面談 調整中
      const awaiting = cnt(e.assignments, "INTERVIEW"); // 面談 結果待ち
      const hasNew = e.offers.some(
        (o) => o.respondedAt && now - new Date(o.respondedAt).getTime() < RECENT_MS
      );
      const isSales =
        SALES_STATUSES.includes(e.status) ||
        offered > 0 ||
        proceed > 0 ||
        adjusting > 0 ||
        awaiting > 0;
      return { e, offered, proceed, declined, adjusting, awaiting, hasNew, isSales };
    })
    .filter((r) => r.isSales)
    .sort((a, b) => (b.hasNew ? 1 : 0) - (a.hasNew ? 1 : 0));

  const newCount = rows.filter((r) => r.hasNew).length;

  return (
    <div>
      <PageHeader
        title="営業管理"
        subtitle={`営業中の技術者 ${rows.length} 名${newCount > 0 ? `・新着 ${newCount} 名` : ""}`}
      />

      {/* 営業中エンジニア一覧 */}
      <Card className="p-3 mb-6">
        {rows.length === 0 ? (
          <EmptyState
            message="営業中の技術者がいません"
            hint="待機中・一部稼働・退場予定の技術者、または提案/面談が進行中の技術者がここに表示されます"
          />
        ) : (
          <div className="space-y-3">
            {rows.map(({ e, offered, proceed, declined, adjusting, awaiting, hasNew }) => {
              const isOwn = e.employmentType !== "BP";
              const sub = e.affiliation || e.nearestStation || "";
              return (
                <Link
                  key={e.id}
                  href={`/engineers/${e.id}`}
                  className="block rounded-xl border border-gray-200 bg-white px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-4">
                    {/* 左: 区分・所属・氏名・参画可能日 */}
                    <div className="w-56 shrink-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            isOwn ? "bg-indigo-600 text-white" : "bg-amber-500 text-white"
                          }`}
                        >
                          {isOwn ? "自社" : "協力会社"}
                        </span>
                        {sub && <span className="text-xs text-gray-500">{sub}</span>}
                        <span className="text-base font-bold text-gray-900">{e.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">参画可能日: {availLabel(e.availableFrom)}</div>
                    </div>

                    {/* 中央: 提案メール / 面談 のステータス集計 */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-500 w-16 shrink-0">提案メール</span>
                        <StatPill label="保留" count={offered} color="bg-sky-100 text-sky-700" />
                        <StatPill label="承諾" count={proceed} color="bg-blue-100 text-blue-700" />
                        <StatPill label="辞退" count={declined} color="bg-rose-100 text-rose-600" />
                      </div>
                      <div className="flex items-center gap-3 flex-wrap border-t border-gray-100 pt-2">
                        <span className="text-xs text-gray-500 w-16 shrink-0">面談</span>
                        <StatPill label="調整中" count={adjusting} color="bg-amber-100 text-amber-700" />
                        <StatPill label="結果待ち" count={awaiting} color="bg-emerald-100 text-emerald-700" />
                      </div>
                    </div>

                    {/* 右: 新着・遷移 */}
                    <div className="flex items-center gap-3 shrink-0">
                      {hasNew && (
                        <Badge className="bg-amber-500 text-white">新着あり</Badge>
                      )}
                      <span className="text-gray-300 text-xl">›</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* エンジニアへ案件を提案（提案メール送信） */}
      <Card className="p-5">
        <h2 className="font-bold text-gray-900 mb-3 text-sm">エンジニアへ案件を提案（提案メール）</h2>
        <form action={createOffer} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Field label="技術者" required>
            <Select name="engineerId" required defaultValue={sp.engineerId || ""}>
              <option value="">選択してください</option>
              {engineers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="案件" required>
            <Select name="projectId" required defaultValue={sp.projectId || ""}>
              <option value="">選択してください</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client.name}／{p.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-3">
            <Field label="推薦コメント（本人に表示されます）">
              <Textarea name="message" rows={2} placeholder="あなたのAWS経験が活きる案件です。ぜひご検討ください。" />
            </Field>
          </div>
          <div>
            <SubmitButton>提案を送信</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
