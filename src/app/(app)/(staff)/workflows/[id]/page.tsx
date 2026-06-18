import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import {
  decideWorkflowRequest,
  cancelWorkflowRequest,
  deleteWorkflowRequest,
} from "@/lib/actions";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import {
  RequestTypeLabel,
  RequestTypeIcon,
  RequestStatusLabel,
  RequestStatusColor,
  LeaveUnitLabel,
} from "@/lib/enums";
import { isItemType } from "@/lib/workflow";
import { yen, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-sm shrink-0">{label}</span>
      <span className="text-gray-900 text-sm text-right">{value}</span>
    </div>
  );
}

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  const { id } = await params;
  const req = await prisma.workflowRequest.findUnique({
    where: { id },
    include: {
      engineer: { select: { name: true, code: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!req) notFound();

  const isAdmin = user.role === "ADMIN";
  const canDecide = isAdmin && req.status === "SUBMITTED";
  const canCancel = req.status === "SUBMITTED";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`${RequestTypeIcon[req.type]} ${RequestTypeLabel[req.type]}`}
        subtitle={`${req.engineer.name}（${req.engineer.code}）`}
        action={
          <div className="flex items-center gap-2">
            <Badge className={RequestStatusColor[req.status]}>{RequestStatusLabel[req.status]}</Badge>
            <LinkButton href="/workflows" variant="ghost">
              一覧へ
            </LinkButton>
          </div>
        }
      />

      <Card className="p-6 mb-4">
        <Row label="対象者" value={`${req.engineer.name}（${req.engineer.code}）`} />
        <Row label="申請者" value={req.submittedByName || "—"} />
        <Row label="申請日" value={formatDate(req.createdAt)} />

        {/* 金額系 */}
        {isItemType(req.type) && (
          <>
            {req.type === "COMMUTER_PASS" && req.passPeriodMonths && (
              <Row label="期間" value={`${req.passPeriodMonths}ヶ月`} />
            )}
            {req.startDate && req.type === "COMMUTER_PASS" && (
              <Row label="利用開始日" value={formatDate(req.startDate)} />
            )}
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-2">明細</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-1">日付</th>
                    {req.type === "TRANSPORT" || req.type === "COMMUTER_PASS" ? (
                      <>
                        <th className="py-1">区間</th>
                        <th className="py-1">往復</th>
                      </>
                    ) : (
                      <th className="py-1">内容</th>
                    )}
                    <th className="py-1 text-right">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {req.items.map((it) => (
                    <tr key={it.id} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-600">{it.itemDate ? formatDate(it.itemDate) : "—"}</td>
                      {req.type === "TRANSPORT" || req.type === "COMMUTER_PASS" ? (
                        <>
                          <td className="py-1.5">{it.fromPlace || "—"} → {it.toPlace || "—"}</td>
                          <td className="py-1.5">{it.roundTrip ? "往復" : "片道"}</td>
                        </>
                      ) : (
                        <td className="py-1.5">{it.note || "—"}</td>
                      )}
                      <td className="py-1.5 text-right tabular-nums">{yen(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end mt-2 text-sm">
                <span className="text-gray-500 mr-3">合計</span>
                <span className="font-bold text-gray-900">{yen(req.amount ?? 0)}</span>
              </div>
            </div>
          </>
        )}

        {/* 休暇系 */}
        {req.type === "PAID_LEAVE" && (
          <>
            <Row label="取得単位" value={req.leaveUnit ? LeaveUnitLabel[req.leaveUnit] : "—"} />
            <Row label="取得日" value={formatDate(req.startDate)} />
            {req.endDate && <Row label="終了日" value={formatDate(req.endDate)} />}
            {req.leaveUnit === "HOURLY" && <Row label="時間数" value={`${req.hours ?? 0} 時間`} />}
            {req.days != null && <Row label="日数" value={`${req.days} 日`} />}
          </>
        )}
        {(req.type === "SUMMER_LEAVE" || req.type === "CONDOLENCE_LEAVE") && (
          <>
            {req.category && <Row label="事由" value={req.category} />}
            <Row label="期間" value={`${formatDate(req.startDate)}${req.endDate ? ` 〜 ${formatDate(req.endDate)}` : ""}`} />
            <Row label="取得日数" value={`${req.days ?? 0} 日`} />
          </>
        )}
        {req.type === "HEALTH_CHECKUP" && (
          <>
            <Row label="受診日" value={formatDate(req.startDate)} />
            {req.category && <Row label="受診機関" value={req.category} />}
          </>
        )}

        {req.reason && <Row label="理由・備考" value={<span className="whitespace-pre-line">{req.reason}</span>} />}

        {/* 承認結果 */}
        {req.status !== "SUBMITTED" && req.decidedAt && (
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm">
            <div className="font-medium text-gray-700">
              {RequestStatusLabel[req.status]}
              <span className="text-gray-400 font-normal ml-2">
                {req.approverName} ／ {formatDate(req.decidedAt)}
              </span>
            </div>
            {req.decisionComment && <p className="text-gray-600 mt-1">{req.decisionComment}</p>}
          </div>
        )}
      </Card>

      {/* 承認・差戻し（管理者のみ） */}
      {canDecide && (
        <Card className="p-6 mb-4">
          <h2 className="font-bold text-gray-900 text-sm mb-3">承認 / 差戻し</h2>
          <form action={decideWorkflowRequest} className="space-y-3">
            <input type="hidden" name="id" value={req.id} />
            <textarea
              name="decisionComment"
              rows={2}
              placeholder="コメント（任意）"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                name="decision"
                value="APPROVED"
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
              >
                ✅ 承認する
              </button>
              <button
                name="decision"
                value="REJECTED"
                className="px-5 py-2 rounded-lg bg-white text-rose-600 border border-rose-300 text-sm font-medium hover:bg-rose-50"
              >
                ↩ 差戻し
              </button>
            </div>
          </form>
        </Card>
      )}

      {!isAdmin && req.status === "SUBMITTED" && (
        <p className="text-xs text-gray-400 mb-4">※ 承認・差戻しは管理者のみ可能です。</p>
      )}

      {/* 取消・削除 */}
      <div className="flex items-center gap-3">
        {canCancel && (
          <form action={cancelWorkflowRequest}>
            <input type="hidden" name="id" value={req.id} />
            <button className="text-sm text-gray-500 hover:text-gray-800">申請を取消す</button>
          </form>
        )}
        {isAdmin && (
          <form action={deleteWorkflowRequest}>
            <input type="hidden" name="id" value={req.id} />
            <button className="text-sm text-rose-400 hover:text-rose-600">削除</button>
          </form>
        )}
      </div>
    </div>
  );
}
