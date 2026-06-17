import Link from "next/link";
import { prisma } from "@/lib/db";
import { createOffer, withdrawOffer } from "@/lib/actions";
import { yen, formatDate } from "@/lib/utils";
import { PageHeader, Card, Badge, EmptyState, Table, Th, Td } from "@/components/ui";
import { Field, Select, Textarea, SubmitButton } from "@/components/form";
import { OfferStatusLabel, OfferStatusColor } from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ engineerId?: string; projectId?: string }>;
}) {
  const sp = await searchParams;

  const [offers, engineers, projects] = await Promise.all([
    prisma.projectOffer.findMany({
      orderBy: { updatedAt: "desc" },
      include: { engineer: true, project: { include: { client: true } } },
    }),
    prisma.engineer.findMany({
      where: { status: { not: "RETIRED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { status: { in: ["OPEN", "PROPOSING", "ONGOING"] } },
      orderBy: { updatedAt: "desc" },
      include: { client: true },
    }),
  ]);

  const pending = offers.filter((o) => o.status === "OFFERED").length;
  const proceeded = offers.filter((o) => o.status === "PROCEED").length;

  return (
    <div>
      <PageHeader
        title="案件オファー"
        subtitle={`全 ${offers.length} 件・回答待ち ${pending} 件・応諾 ${proceeded} 件`}
      />

      {/* オファー作成 */}
      <Card className="p-5 mb-6">
        <h2 className="font-bold text-gray-900 mb-3 text-sm">エンジニアへ案件をオファー</h2>
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
            <SubmitButton>オファーを送信</SubmitButton>
          </div>
        </form>
      </Card>

      {/* オファー一覧 */}
      <Card>
        {offers.length === 0 ? (
          <EmptyState
            message="オファーがまだありません"
            hint="上のフォームから、または「マッチング検索」からエンジニアに案件をオファーできます"
          />
        ) : (
          <Table
            head={
              <>
                <Th>技術者</Th>
                <Th>案件 / 取引先</Th>
                <Th className="text-right">想定単価</Th>
                <Th>状態</Th>
                <Th>本人コメント</Th>
                <Th>更新日</Th>
                <Th></Th>
              </>
            }
          >
            {offers.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <Td>
                  <Link href={`/engineers/${o.engineerId}`} className="font-medium text-indigo-600 hover:underline">
                    {o.engineer.name}
                  </Link>
                </Td>
                <Td>
                  <div className="text-gray-800">{o.project.title}</div>
                  <div className="text-xs text-gray-400">{o.project.client.name}</div>
                </Td>
                <Td className="text-right text-xs text-gray-600">
                  {yen(o.project.unitPriceMin)}〜{yen(o.project.unitPriceMax)}
                </Td>
                <Td>
                  <Badge className={OfferStatusColor[o.status]}>{OfferStatusLabel[o.status]}</Badge>
                </Td>
                <Td className="text-xs text-gray-500 max-w-xs">{o.engineerComment || "—"}</Td>
                <Td className="text-xs text-gray-400">{formatDate(o.updatedAt)}</Td>
                <Td>
                  {o.status === "OFFERED" && (
                    <form action={withdrawOffer}>
                      <input type="hidden" name="offerId" value={o.id} />
                      <button className="text-xs text-gray-400 hover:text-rose-600">取下げ</button>
                    </form>
                  )}
                  {o.status === "PROCEED" && (
                    <Link
                      href={`/assignments/new?engineerId=${o.engineerId}&projectId=${o.projectId}`}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      アサイン化 →
                    </Link>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
