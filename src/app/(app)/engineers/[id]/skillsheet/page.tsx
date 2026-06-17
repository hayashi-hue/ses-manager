import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, getCurrentEngineerId } from "@/lib/auth";
import {
  saveSkillSheetProfile,
  addSkill,
  removeSkill,
  saveQualification,
  deleteQualification,
  saveWorkHistory,
  deleteWorkHistory,
} from "@/lib/actions";
import { formatDate, toDateInputValue } from "@/lib/utils";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { Field, Input, Textarea, Select, Options, SubmitButton } from "@/components/form";
import {
  EmploymentTypeLabel,
  SkillCategoryLabel,
  WorkRoleLabel,
  PhaseTypeShort,
} from "@/lib/enums";
import PrintButton from "./PrintButton";
import WorkHistoryFields from "./WorkHistoryFields";

export const dynamic = "force-dynamic";

export default async function SkillSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const myEngineerId = await getCurrentEngineerId();
  const isStaff = user?.role === "ADMIN" || user?.role === "SALES";
  const canEdit = isStaff || myEngineerId === id;

  // 他人のスキルシートをエンジニアが見るのは禁止
  if (!isStaff && myEngineerId !== id) redirect("/mypage");

  const e = await prisma.engineer.findUnique({
    where: { id },
    include: {
      skills: { include: { skill: true }, orderBy: { skill: { category: "asc" } } },
      qualifications: { orderBy: { acquiredOn: "desc" } },
      workHistories: { orderBy: [{ sortOrder: "asc" }, { startOn: "desc" }] },
    },
  });
  if (!e) notFound();

  // スキルをカテゴリ別にグルーピング
  const skillsByCat = new Map<string, typeof e.skills>();
  for (const s of e.skills) {
    const c = s.skill.category;
    if (!skillsByCat.has(c)) skillsByCat.set(c, []);
    skillsByCat.get(c)!.push(s);
  }

  const backHref = isStaff ? `/engineers/${e.id}` : "/mypage";

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="スキルシート"
        subtitle={`${e.name}（${e.code}）の経歴書・営業提案用`}
        action={
          <div className="flex gap-2 no-print">
            <PrintButton />
            <LinkButton href={backHref} variant="ghost">
              戻る
            </LinkButton>
          </div>
        }
      />

      {/* ===== 印刷プレビュー（スキルシート本体） ===== */}
      <Card className="p-8 mb-8 print-card">
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4 mb-5">
          <div>
            <div className="text-xl font-bold">{e.initial || e.name}</div>
            <div className="text-sm text-gray-500 mt-1">
              {[e.ageRange, EmploymentTypeLabel[e.employmentType], `経験${e.experienceYears}年`]
                .filter(Boolean)
                .join("　／　")}
            </div>
          </div>
          <div className="text-right text-sm text-gray-600 space-y-0.5">
            {e.nearestStation && <div>最寄駅: {e.nearestStation}</div>}
            <div>稼働可能: {e.availableFrom ? formatDate(e.availableFrom) : "応相談"}</div>
            {e.finalEducation && <div>最終学歴: {e.finalEducation}</div>}
          </div>
        </div>

        {/* 得意分野・自己PR */}
        <SheetSection title="得意分野・自己PR">
          {e.prText ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.prText}</p>
          ) : (
            <p className="text-sm text-gray-400">未記入</p>
          )}
        </SheetSection>

        {/* 保有資格 */}
        <SheetSection title="保有資格">
          {e.qualifications.length === 0 ? (
            <p className="text-sm text-gray-400">未登録</p>
          ) : (
            <ul className="text-sm text-gray-700 space-y-1">
              {e.qualifications.map((q) => (
                <li key={q.id} className="flex justify-between border-b border-gray-100 pb-1">
                  <span>{q.name}</span>
                  <span className="text-gray-400">{q.acquiredOn ? formatDate(q.acquiredOn) : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </SheetSection>

        {/* 保有スキル */}
        <SheetSection title="保有スキル">
          {e.skills.length === 0 ? (
            <p className="text-sm text-gray-400">未登録</p>
          ) : (
            <div className="space-y-2">
              {[...skillsByCat.entries()].map(([cat, list]) => (
                <div key={cat} className="flex gap-2 text-sm">
                  <span className="w-20 shrink-0 text-gray-500">{SkillCategoryLabel[cat] || cat}</span>
                  <div className="flex flex-wrap gap-2">
                    {list.map((s) => (
                      <Badge key={s.id} className="bg-slate-100 text-slate-700">
                        {s.skill.name}
                        <span className="ml-1 text-amber-500">{"★".repeat(s.level)}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SheetSection>

        {/* 職務経歴 */}
        <SheetSection title="職務経歴">
          {e.workHistories.length === 0 ? (
            <p className="text-sm text-gray-400">未登録</p>
          ) : (
            <div className="space-y-4">
              {e.workHistories.map((w) => {
                const phases = (w.phases || "").split(",").map((p) => p.trim()).filter(Boolean);
                return (
                  <div key={w.id} className="border border-gray-200 rounded-lg p-4 print-card">
                    <div className="flex items-start justify-between">
                      <div className="font-medium text-gray-900">{w.title}</div>
                      <div className="text-xs text-gray-500 shrink-0 ml-2">
                        {w.startOn ? formatDate(w.startOn) : ""} 〜 {w.endOn ? formatDate(w.endOn) : "現在"}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {[w.industry, WorkRoleLabel[w.roleType]?.split("（")[0], w.teamSize ? `${w.teamSize}名規模` : null]
                        .filter(Boolean)
                        .join("　／　")}
                    </div>
                    {w.summary && (
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{w.summary}</p>
                    )}
                    {w.technologies && (
                      <div className="text-xs text-gray-600 mt-2">
                        <span className="text-gray-400">使用技術: </span>
                        {w.technologies}
                      </div>
                    )}
                    {phases.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {phases.map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-xs">
                            {PhaseTypeShort[p] || p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SheetSection>
      </Card>

      {!canEdit && (
        <p className="text-sm text-gray-400">※ このスキルシートは閲覧のみです。</p>
      )}

      {/* ===== 編集エリア（印刷対象外） ===== */}
      {canEdit && (
        <div className="no-print space-y-6">
          <h2 className="text-lg font-bold text-gray-900">スキルシートを編集</h2>

          {/* 基本情報 */}
          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 text-sm">基本情報</h3>
            <form action={saveSkillSheetProfile} className="space-y-4">
              <input type="hidden" name="engineerId" value={e.id} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="イニシャル" hint="営業提案時の匿名表記（例: T.Y）">
                  <Input name="initial" defaultValue={e.initial || ""} placeholder="T.Y" />
                </Field>
                <Field label="年代">
                  <Input name="ageRange" defaultValue={e.ageRange || ""} placeholder="30代" />
                </Field>
                <Field label="最寄駅">
                  <Input name="nearestStation" defaultValue={e.nearestStation || ""} placeholder="新宿駅" />
                </Field>
                <Field label="稼働可能時期">
                  <Input type="date" name="availableFrom" defaultValue={toDateInputValue(e.availableFrom)} />
                </Field>
                <Field label="最終学歴">
                  <Input name="finalEducation" defaultValue={e.finalEducation || ""} placeholder="〇〇大学 工学部 卒" />
                </Field>
              </div>
              <Field label="得意分野・自己PR">
                <Textarea name="prText" rows={4} defaultValue={e.prText || ""} placeholder="得意な技術領域・強み・実績などを記入" />
              </Field>
              <SubmitButton>基本情報を保存</SubmitButton>
            </form>
          </Card>

          {/* スキル */}
          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 text-sm">保有スキル</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {e.skills.length === 0 && <span className="text-sm text-gray-400">未登録</span>}
              {e.skills.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 bg-slate-100 rounded-full pl-3 pr-1.5 py-1 text-sm">
                  {s.skill.name}
                  <span className="text-amber-500 text-xs">{"★".repeat(s.level)}</span>
                  <form action={removeSkill} className="inline">
                    <input type="hidden" name="engineerId" value={e.id} />
                    <input type="hidden" name="engineerSkillId" value={s.id} />
                    <button className="ml-1 w-4 h-4 rounded-full bg-gray-300 text-white text-xs leading-none hover:bg-rose-500">
                      ×
                    </button>
                  </form>
                </span>
              ))}
            </div>
            <form action={addSkill} className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
              <input type="hidden" name="engineerId" value={e.id} />
              <Field label="スキル名">
                <Input name="skillName" placeholder="Java" className="w-40" />
              </Field>
              <Field label="カテゴリ">
                <Select name="category" defaultValue="LANGUAGE" className="w-32">
                  <Options map={SkillCategoryLabel} />
                </Select>
              </Field>
              <Field label="レベル(1-5)">
                <Select name="level" defaultValue="3" className="w-20">
                  <Options map={{ "1": "1", "2": "2", "3": "3", "4": "4", "5": "5" }} />
                </Select>
              </Field>
              <SubmitButton>＋ 追加</SubmitButton>
            </form>
          </Card>

          {/* 資格 */}
          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 text-sm">保有資格</h3>
            <div className="space-y-1 mb-4">
              {e.qualifications.length === 0 && <span className="text-sm text-gray-400">未登録</span>}
              {e.qualifications.map((q) => (
                <div key={q.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-1">
                  <span>
                    {q.name}
                    {q.acquiredOn && <span className="text-gray-400 ml-2">{formatDate(q.acquiredOn)}</span>}
                  </span>
                  <form action={deleteQualification}>
                    <input type="hidden" name="engineerId" value={e.id} />
                    <input type="hidden" name="id" value={q.id} />
                    <button className="text-xs text-rose-400 hover:text-rose-600">削除</button>
                  </form>
                </div>
              ))}
            </div>
            <form action={saveQualification} className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
              <input type="hidden" name="engineerId" value={e.id} />
              <Field label="資格名">
                <Input name="name" placeholder="基本情報技術者試験" className="w-64" />
              </Field>
              <Field label="取得年月">
                <Input type="month" name="acquiredOn" className="w-40" />
              </Field>
              <SubmitButton>＋ 追加</SubmitButton>
            </form>
          </Card>

          {/* 職務経歴 */}
          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 text-sm">職務経歴</h3>
            <div className="space-y-3 mb-4">
              {e.workHistories.length === 0 && <span className="text-sm text-gray-400">未登録</span>}
              {e.workHistories.map((w) => (
                <details key={w.id} className="border border-gray-200 rounded-lg">
                  <summary className="px-4 py-3 cursor-pointer flex items-center justify-between">
                    <span className="text-sm font-medium">{w.title}</span>
                    <span className="text-xs text-gray-400">
                      {w.startOn ? formatDate(w.startOn) : ""}〜{w.endOn ? formatDate(w.endOn) : "現在"}
                    </span>
                  </summary>
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                    <form action={saveWorkHistory} className="space-y-4">
                      <input type="hidden" name="engineerId" value={e.id} />
                      <input type="hidden" name="id" value={w.id} />
                      <WorkHistoryFields wh={w} />
                      <div className="flex gap-2">
                        <SubmitButton>更新</SubmitButton>
                        <button
                          formAction={deleteWorkHistory}
                          className="px-4 py-2 rounded-lg text-sm text-rose-600 border border-rose-200 hover:bg-rose-50"
                        >
                          削除
                        </button>
                      </div>
                    </form>
                  </div>
                </details>
              ))}
            </div>

            <details className="border border-indigo-200 rounded-lg bg-indigo-50/30">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-indigo-700">
                ＋ 職務経歴を追加
              </summary>
              <div className="px-4 pb-4 pt-2">
                <form action={saveWorkHistory} className="space-y-4">
                  <input type="hidden" name="engineerId" value={e.id} />
                  <WorkHistoryFields />
                  <SubmitButton>追加する</SubmitButton>
                </form>
              </div>
            </details>
          </Card>
        </div>
      )}
    </div>
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold text-gray-800 bg-gray-100 px-3 py-1.5 rounded mb-2">{title}</h3>
      <div className="px-1">{children}</div>
    </div>
  );
}
