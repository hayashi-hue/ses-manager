import Link from "next/link";
import { prisma } from "@/lib/db";
import { yen } from "@/lib/utils";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import {
  EngineerStatusLabel,
  EngineerStatusColor,
  ProjectStatusLabel,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; maxRate?: string; onlyAvailable?: string; projectId?: string }>;
}) {
  const sp = await searchParams;
  const skill = (sp.skill || "").trim();
  const maxRate = sp.maxRate ? parseInt(sp.maxRate, 10) : 0;
  const onlyAvailable = sp.onlyAvailable === "1";

  const openProjects = await prisma.project.findMany({
    where: { status: { in: ["OPEN", "PROPOSING"] } },
    orderBy: { updatedAt: "desc" },
    include: { client: true },
  });

  let results: Awaited<ReturnType<typeof searchEngineers>> = [];
  if (skill || maxRate || onlyAvailable) {
    results = await searchEngineers(skill, maxRate, onlyAvailable);
  }

  return (
    <div>
      <PageHeader
        title="マッチング検索"
        subtitle="案件要件に合う要員を、スキル・単価・稼働状況で横断検索"
      />

      {/* 募集中案件のクイック参照 */}
      {openProjects.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="text-sm text-gray-500 mb-2">募集中の案件（クリックで必須スキルを検索条件に反映）</div>
          <div className="flex flex-wrap gap-2">
            {openProjects.map((p) => (
              <Link
                key={p.id}
                href={`/matching?skill=${encodeURIComponent(
                  (p.requiredSkills || "").split(",")[0]?.trim() || p.title
                )}&maxRate=${p.unitPriceMax}`}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs hover:bg-slate-200"
              >
                {p.client.name}／{p.title}
                <span className="ml-1 text-slate-400">
                  〜{yen(p.unitPriceMax)}・{ProjectStatusLabel[p.status]}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* 検索フォーム */}
      <Card className="p-4 mb-4">
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">スキル / キーワード</label>
            <input
              name="skill"
              defaultValue={skill}
              placeholder="Java, AWS, PM など"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-56"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">提示単価上限（円）</label>
            <input
              type="number"
              name="maxRate"
              step={10000}
              defaultValue={maxRate || ""}
              placeholder="800000"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-40"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
            <input type="checkbox" name="onlyAvailable" value="1" defaultChecked={onlyAvailable} className="w-4 h-4" />
            待機・一部稼働のみ
          </label>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
            検索
          </button>
        </form>
      </Card>

      <Card>
        {results.length === 0 ? (
          <EmptyState
            message={skill || maxRate || onlyAvailable ? "条件に合う要員が見つかりません" : "条件を入力して検索してください"}
            hint="スキル名・単価上限・稼働状況で絞り込めます"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {results.map((e) => (
              <div key={e.id} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/engineers/${e.id}`} className="font-medium text-indigo-600 hover:underline">
                      {e.name}
                    </Link>
                    <Badge className={EngineerStatusColor[e.status]}>
                      {EngineerStatusLabel[e.status]}
                    </Badge>
                    <span className="text-xs text-gray-400">経験{e.experienceYears}年</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {e.skills.map((s) => (
                      <Badge key={s.id} className="bg-slate-100 text-slate-600">
                        {s.skill.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-800">{yen(e.sellRateMin)}〜</div>
                  <div className="flex gap-2 justify-end mt-1">
                    <Link
                      href={`/offers?engineerId=${e.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      📨 案件をオファー
                    </Link>
                    <Link
                      href={`/assignments/new?engineerId=${e.id}`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      アサイン →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

async function searchEngineers(skill: string, maxRate: number, onlyAvailable: boolean) {
  const where: Record<string, unknown> = { status: { not: "RETIRED" } };
  if (onlyAvailable) where.status = { in: ["AVAILABLE", "PARTIAL"] };
  if (maxRate > 0) where.sellRateMin = { lte: maxRate };
  if (skill) {
    where.OR = [
      { name: { contains: skill } },
      { note: { contains: skill } },
      { skills: { some: { skill: { name: { contains: skill } } } } },
    ];
  }
  return prisma.engineer.findMany({
    where,
    orderBy: [{ status: "asc" }, { sellRateMin: "asc" }],
    include: { skills: { include: { skill: true } } },
    take: 50,
  });
}
