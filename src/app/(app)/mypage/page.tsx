import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser, getCurrentEngineerId } from "@/lib/auth";
import { respondRenewal, respondOffer, cancelWorkflowRequest } from "@/lib/actions";
import { yen, formatDate, formatYearMonth, presentedRateUnit } from "@/lib/utils";
import RequestForm from "@/components/RequestForm";
import { requestSummary } from "@/lib/workflow";
import {
  settlementHoursText,
  settlementRatesText,
  calcMonthlySettlement,
  type SettlementInput,
} from "@/lib/settlement";
import { SettlementMethodLabel } from "@/lib/enums";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import {
  AssignmentStatusLabel,
  AssignmentStatusColor,
  RenewalIntentLabel,
  RenewalIntentColor,
  OfferStatusLabel,
  OfferStatusColor,
  ContractTypeLabel,
  RequestTypeLabel,
  RequestTypeIcon,
  RequestStatusLabel,
  RequestStatusColor,
} from "@/lib/enums";

export const dynamic = "force-dynamic";

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ requested?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const engineerId = await getCurrentEngineerId();

  if (!engineerId) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="マイページ" />
        <Card className="p-8">
          <EmptyState
            message="このアカウントには技術者プロフィールが紐づいていません"
            hint="管理者にお問い合わせください（技術者アカウントでログインするとマイページが表示されます）"
          />
          <p className="text-center text-sm text-gray-400 mt-4">
            管理者の方は <Link href="/dashboard" className="text-indigo-600 hover:underline">ダッシュボード</Link> へ
          </p>
        </Card>
      </div>
    );
  }

  const engineer = await prisma.engineer.findUnique({
    where: { id: engineerId },
    include: {
      skills: { include: { skill: true } },
      assignments: {
        where: { status: { in: ["ACTIVE", "ORDERED"] } },
        include: {
          project: { include: { client: true } },
          contract: true,
          timesheets: { orderBy: { yearMonth: "desc" }, take: 3 },
        },
        orderBy: { startOn: "asc" },
      },
      offers: {
        include: { project: { include: { client: true } } },
        orderBy: { updatedAt: "desc" },
      },
      workflowRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!engineer) return null;

  const openOffers = engineer.offers.filter((o) => o.status === "OFFERED");
  const pastOffers = engineer.offers.filter((o) => o.status !== "OFFERED");

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`こんにちは、${engineer.name} さん`}
        subtitle="現在の参画状況の確認・継続意思の表明、案件提案への回答ができます"
      />

      {/* スキルサマリー */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-gray-900 text-sm">あなたのスキル</h2>
          <div className="flex items-center gap-3">
            <Link
              href={`/engineers/${engineer.id}/skillsheet`}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              📄 スキルシートを作成・編集 →
            </Link>
            <span className="text-xs text-gray-400">経験 {engineer.experienceYears} 年</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {engineer.skills.length === 0 ? (
            <span className="text-sm text-gray-400">未登録</span>
          ) : (
            engineer.skills.map((s) => (
              <Badge key={s.id} className="bg-slate-100 text-slate-700">
                {s.skill.name}
              </Badge>
            ))
          )}
        </div>
      </Card>

      {/* 現在の参画 + 継続意思 */}
      <h2 className="font-bold text-gray-900 mb-3">現在の参画案件</h2>
      <div className="space-y-4 mb-8">
        {engineer.assignments.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-gray-400 text-center">現在参画中の案件はありません。</p>
          </Card>
        ) : (
          engineer.assignments.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{a.project.title}</span>
                    <Badge className={AssignmentStatusColor[a.status]}>
                      {AssignmentStatusLabel[a.status]}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {a.project.client.name}／{ContractTypeLabel[a.project.contractType]}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    期間: {formatDate(a.startOn)} 〜 {formatDate(a.endOn)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-400 mb-1">現在の継続意思</div>
                  <Badge className={RenewalIntentColor[a.renewalIntent]}>
                    {RenewalIntentLabel[a.renewalIntent]}
                  </Badge>
                  {a.renewalRespondedAt && (
                    <div className="text-xs text-gray-400 mt-1">
                      回答日 {formatDate(a.renewalRespondedAt)}
                    </div>
                  )}
                </div>
              </div>

              {/* 契約内容（本人が見られる範囲） */}
              <ContractInfo assignment={a} />

              {/* 延長 / 離脱 選択 */}
              <form action={respondRenewal} className="mt-4 border-t border-gray-100 pt-4">
                <input type="hidden" name="assignmentId" value={a.id} />
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  契約更新タイミングのご希望（延長条件・離脱理由など）
                </label>
                <textarea
                  name="renewalNote"
                  rows={2}
                  defaultValue={a.renewalNote || ""}
                  placeholder="例: 単価アップ条件で延長希望 / 別技術にチャレンジしたく離脱希望 など"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
                />
                <div className="flex gap-2">
                  <button
                    name="intent"
                    value="EXTEND"
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    ✋ 延長を希望する
                  </button>
                  <button
                    name="intent"
                    value="LEAVE"
                    className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600"
                  >
                    🚪 離脱を希望する
                  </button>
                  <button
                    name="intent"
                    value="UNDECIDED"
                    className="px-4 py-2 rounded-lg bg-white text-gray-600 border border-gray-300 text-sm hover:bg-gray-50"
                  >
                    保留にする
                  </button>
                </div>
              </form>
            </Card>
          ))
        )}
      </div>

      {/* あなたへの案件一覧 */}
      <h2 className="font-bold text-gray-900 mb-3">
        あなたへの案件一覧
        {openOffers.length > 0 && (
          <Badge className="ml-2 bg-blue-100 text-blue-700">{openOffers.length} 件 未回答</Badge>
        )}
      </h2>
      <div className="space-y-4 mb-8">
        {openOffers.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-gray-400 text-center">
              現在、回答待ちの案件はありません。
            </p>
          </Card>
        ) : (
          openOffers.map((o) => (
            <Card key={o.id} className="p-5 border-l-4 border-l-blue-400">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{o.project.title}</span>
                <Badge className={OfferStatusColor[o.status]}>{OfferStatusLabel[o.status]}</Badge>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {o.project.client.name}／{ContractTypeLabel[o.project.contractType]}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                想定単価: {yen(o.project.unitPriceMin)} 〜 {yen(o.project.unitPriceMax)}
                {o.project.workLocation && <>／勤務地: {o.project.workLocation}</>}
              </div>
              {o.project.requiredSkills && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {o.project.requiredSkills.split(",").map((s) => (
                    <Badge key={s} className="bg-slate-100 text-slate-600">
                      {s.trim()}
                    </Badge>
                  ))}
                </div>
              )}
              {o.message && (
                <div className="text-sm text-gray-700 bg-blue-50 rounded-lg px-3 py-2 mt-3">
                  💬 営業より: {o.message}
                </div>
              )}

              <form action={respondOffer} className="mt-4 border-t border-gray-100 pt-4">
                <input type="hidden" name="offerId" value={o.id} />
                <textarea
                  name="engineerComment"
                  rows={2}
                  placeholder="ご質問・希望条件・辞退理由などあればご記入ください（任意）"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
                />
                <div className="flex gap-2">
                  <button
                    name="decision"
                    value="PROCEED"
                    className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                  >
                    ✅ 進めたい（応諾）
                  </button>
                  <button
                    name="decision"
                    value="DECLINED"
                    className="px-5 py-2 rounded-lg bg-white text-rose-600 border border-rose-300 text-sm font-medium hover:bg-rose-50"
                  >
                    ✖ 辞退する
                  </button>
                </div>
              </form>
            </Card>
          ))
        )}
      </div>

      {/* 回答済み提案履歴 */}
      {pastOffers.length > 0 && (
        <>
          <h2 className="font-bold text-gray-900 mb-3">案件回答履歴</h2>
          <Card>
            <div className="divide-y divide-gray-100">
              {pastOffers.map((o) => (
                <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-800">{o.project.title}</span>
                    <span className="text-xs text-gray-400 ml-2">{o.project.client.name}</span>
                    {o.engineerComment && (
                      <p className="text-xs text-gray-500 mt-0.5">コメント: {o.engineerComment}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge className={OfferStatusColor[o.status]}>{OfferStatusLabel[o.status]}</Badge>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDate(o.respondedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* 各種申請（交通費・経費・休暇など） */}
      <h2 className="font-bold text-gray-900 mb-3 mt-8">各種申請</h2>
      {sp.requested && (
        <div className="mb-3">
          <Badge className="bg-emerald-100 text-emerald-700">申請を受け付けました</Badge>
        </div>
      )}
      <Card className="p-5 mb-4">
        <RequestForm selfName={engineer.name} cancelHref="/mypage" />
      </Card>

      {engineer.workflowRequests.length > 0 && (
        <Card className="mb-8">
          <div className="divide-y divide-gray-100">
            {engineer.workflowRequests.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-gray-800">
                    {RequestTypeIcon[r.type]} {RequestTypeLabel[r.type]}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">{requestSummary(r)}</span>
                  <div className="text-xs text-gray-400 mt-0.5">
                    申請日 {formatDate(r.createdAt)}
                    {r.decisionComment && <>／{r.decisionComment}</>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={RequestStatusColor[r.status]}>{RequestStatusLabel[r.status]}</Badge>
                  {r.status === "SUBMITTED" && (
                    <form action={cancelWorkflowRequest}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-xs text-gray-400 hover:text-rose-600">取消</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-gray-400 mt-6">
        ※ 継続意思・案件回答は営業担当に共有されます。条件面の詳細はあらためて担当者よりご連絡します。
        {user && <>（ログイン: {user.email}）</>}
      </p>
    </div>
  );
}

type ContractFields = SettlementInput & {
  engineerRate: number | null;
  startOn: Date | null;
  endOn: Date | null;
};

/** エンジニア本人に見せる契約内容（提示単価・精算条件・控除/超過） */
function ContractInfo({
  assignment,
}: {
  assignment: {
    contract: ContractFields | null;
    startOn: Date | null;
    endOn: Date | null;
    timesheets?: { id: string; yearMonth: string; workedHours: number; status: string }[];
  };
}) {
  const c = assignment.contract;
  if (!c) {
    return (
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-400">
          📄 契約情報は準備中です。詳細は営業担当にご確認ください。
        </p>
      </div>
    );
  }
  // 本人にはエンジニア提示単価を基準に表示（実単価は見せない）
  const base = c.engineerRate ?? 0;
  const rates = settlementRatesText(c, base);
  const showRates = c.settlementMethod === "MANUAL" || base > 0;
  // 提示額の単位（時給契約でも本人へは月額提示が可能）
  const presentedUnit = presentedRateUnit(c);
  const presentedHourly = presentedUnit === "HOURLY";
  // 精算条件テキスト（本人視点）
  const condText = presentedHourly
    ? "時給精算（実働時間 × 時給）"
    : c.rateType === "HOURLY"
    ? "月額提示（実働に依らず固定）"
    : settlementHoursText(c);
  // 月次精算実績を出すか（時給提示 or 月額契約で精算ありのときのみ。月額提示の時給契約は固定なので非表示）
  const showHistory =
    c.engineerRate != null &&
    (assignment.timesheets?.length ?? 0) > 0 &&
    (presentedHourly || (c.rateType !== "HOURLY" && c.settlementMethod !== "NONE"));

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 text-right">{value}</span>
    </div>
  );

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <h4 className="text-sm font-bold text-gray-900 mb-2">📄 契約内容</h4>
      <div className="text-sm bg-gray-50 rounded-lg px-4 py-3">
        <Row
          label={presentedHourly ? "提示単価（時給）" : "提示単価（月額）"}
          value={
            c.engineerRate != null ? (
              <span className="font-bold text-indigo-600">
                {yen(c.engineerRate)}
                {presentedHourly && <span className="text-indigo-400 text-xs">／時間</span>}
              </span>
            ) : (
              <span className="text-gray-400">営業担当にご確認ください</span>
            )
          }
        />
        <Row
          label="契約期間"
          value={`${formatDate(c.startOn ?? assignment.startOn)} 〜 ${formatDate(c.endOn ?? assignment.endOn)}`}
        />
        <Row label="精算条件" value={condText} />
        {c.rateType !== "HOURLY" && (
          <Row label="精算方式" value={SettlementMethodLabel[c.settlementMethod] || c.settlementMethod} />
        )}
        {c.rateType !== "HOURLY" && showRates && c.settlementMethod !== "NONE" && (
          <>
            <Row label="控除単価" value={rates.deduction} />
            <Row label="超過単価" value={rates.excess} />
          </>
        )}
      </div>
      {showRates && rates.dynamicNote && (
        <p className="text-xs text-gray-400 mt-1">{rates.dynamicNote}</p>
      )}

      {/* 月次精算実績（提示単価ベース） */}
      {showHistory && (
        <div className="mt-3">
          <div className="text-xs font-medium text-gray-500 mb-1">月次精算実績（提示単価ベース）</div>
          <div className="space-y-1">
            {assignment.timesheets!.map((t) => {
              const s = calcMonthlySettlement(c, {
                yearMonth: t.yearMonth,
                workedHours: t.workedHours,
                baseRate: c.engineerRate!,
              });
              const tag =
                s.status === "deduct" ? "控除"
                : s.status === "excess" ? "超過"
                : s.status === "within" ? "範囲内"
                : s.status === "hourly" ? "時給精算"
                : "—";
              const tagCls =
                s.status === "deduct"
                  ? "text-orange-600"
                  : s.status === "excess"
                  ? "text-sky-600"
                  : s.status === "hourly"
                  ? "text-violet-600"
                  : "text-emerald-600";
              return (
                <div key={t.id} className="flex items-center justify-between text-sm bg-white border border-gray-100 rounded px-3 py-1.5">
                  <span className="text-gray-600">
                    {formatYearMonth(t.yearMonth)}　稼働 {t.workedHours}h
                    {s.status === "hourly" ? (
                      <span className="text-xs text-gray-400 ml-1">（{yen(c.engineerRate!)}/h × {t.workedHours}h）</span>
                    ) : (
                      <span className="text-xs text-gray-400 ml-1">（実営業{s.businessDays}日 / 基準{s.standard ?? "—"}h）</span>
                    )}
                  </span>
                  <span className="text-right">
                    <span className={`text-xs mr-2 ${tagCls}`}>
                      {tag}
                      {s.status === "deduct" || s.status === "excess" ? `（${s.diffHours}h ${yen(s.adjustment)}）` : ""}
                    </span>
                    <strong className="text-gray-900">{yen(s.amount)}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
