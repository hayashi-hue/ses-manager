# SES業務管理システム マスター仕様書（引継ぎ資料）

> 本書は新規チャット／別担当への**引継ぎ用マスター仕様書**です。`ses-manager/` の実装（コード）を正本とし、決定済みの全仕様を1ファイルに集約しています。
> 最終更新: 2026-06-19 ／ 本番: https://ses-manager-silk.vercel.app ／ リポジトリ: github.com/hayashi-hue/ses-manager（`main` push → Vercel 自動デプロイ）

---

## 1. システム概要

SES企業（客先常駐・技術者派遣）の業務を一括管理する社内基幹システム。運営会社＝**株式会社ラポールスター**。
**技術者・案件・アサイン・契約・工数・月次精算・請求・取引先/営業・スキルシート・申請ワークフロー**を1アプリで管理する。

特徴:
- **エンジニア本人ポータル（マイページ）**: 継続意思（延長/離脱）、案件提案への応諾/辞退、契約内容・月次精算の閲覧、各種申請
- **二重単価**: 「実単価（客先契約）」と「エンジニア提示単価」を分離管理し、本人には提示額のみ見せる
- **月次精算の自動計算**: 契約の精算条件 × その月の実営業日数（土日祝除外）× 稼働時間で精算額を自動算出
- **勤務表アップロード取込**: Excel勤務表から日次実働を合計し当月工数へ自動入力
- **請求書の自社フォーマット出力**: PDF/Excelを1人ずつ直接生成、月次まとめてZIP一括DL
- **申請ワークフロー**: 交通費・経費・有給・定期券・夏季休暇・慶弔・健康診断を申請→管理者が1段階承認
- **契約マトリクス**: エンジニア×月の単価タイムライン表示＋検索
- **完全日本語UI・無料OSSのみ**（有料API・外部送信なし）

---

## 2. 技術スタック

| 区分 | 採用技術 |
|---|---|
| フレームワーク | **Next.js 16**（App Router / Server Components / Server Actions、webpack ビルド） |
| 言語 | TypeScript / React 19 |
| DB | **PostgreSQL（Supabase）** ＋ **Prisma 6** |
| スタイル | Tailwind CSS v4 |
| 認証 | 自前実装（bcryptjs ハッシュ＋HMAC署名付きCookieセッション）。外部認証不使用 |
| Excel | `xlsx`（SheetJS）— 勤務表取込・請求書Excel出力 |
| PDF | `pdf-lib` ＋ `@pdf-lib/fontkit`（請求書PDF。日本語TTF埋込） |
| ZIP | `jszip`（請求書一括DL） |
| ホスティング | **Vercel** |

設計上の制約（重要・厳守）:
- **Prisma `enum` は使わない** → `String` カラム＋`src/lib/enums.ts` のTS定数で表現
- **配列・`Json` 型は使わない** → 中間テーブル or カンマ/改行区切り文字列
- UI文言・ラベルはすべて日本語
- 金額は整数（円）、工数・日数は `Float`

---

## 3. デプロイ構成（Vercel + Supabase）

- **Vercel**: GitHub（`hayashi-hue/ses-manager`）連携。Root=`./`、Build=`npm run build`（`prisma generate && next build`）、`postinstall` で `prisma generate`。**`main` への push で自動デプロイ**（ビルド成功時のみ切替）。
- **Supabase（PostgreSQL）**: 実行時は Connection Pooler（6543, `?pgbouncer=true`）を `DATABASE_URL`、マイグレーション/seed は Direct（5432）を `DIRECT_URL`。
- **DBスキーマ変更の反映（2通り）**:
  1. ローカルで `npm run db:push`（`.env` の Supabase 接続を使用）
  2. **`supabase/migrations/` に格納したSQLを Supabase の SQL Editor に貼り付けて Run**（RLS警告は「Run without RLS」を選択＝既存テーブルと同じ。アプリはPrisma直結のためRLS不要）
- ⚠️ `npm run db:seed` は全削除→再作成。**本番では実行厳禁**。
- 既存テーブルは全て RLS なし（Prisma がDB接続で直接アクセスするため）。新規テーブルも RLS なしで揃える。

### 環境変数
| 変数 | 用途 |
|---|---|
| `DATABASE_URL` | 実行時DB接続（本番=Pooler 6543） |
| `DIRECT_URL` | マイグレーション/seed用（5432） |
| `SESSION_SECRET` | セッションCookieのHMAC署名鍵 |

---

## 4. 認証・権限

### ロール（UserRole）
| 値 | ラベル | 区分 |
|---|---|---|
| `ADMIN` | 管理者 | スタッフ |
| `SALES` | 営業 | スタッフ |
| `ACCOUNTING` | 経理 | スタッフ |
| `ENGINEER` | エンジニア | 本人ポータルのみ |

### 仕組み（`src/lib/auth.ts`）
- パスワードは `bcryptjs` でハッシュ化（`User.passwordHash`）
- ログイン成功で `ses_session` Cookie 発行（`userId` を `SESSION_SECRET` でHMAC署名、httpOnly/sameSite=lax/7日）
- `getCurrentUser()` / `requireStaff()`（未ログイン→`/login`、ENGINEER→`/mypage`）/ `getCurrentEngineerId()`
- ログイン後遷移: ENGINEER→`/mypage`、それ以外→`/dashboard`

### ナビゲーション（`src/components/Sidebar.tsx`）
- スタッフ: ダッシュボード / 技術者管理 / 案件管理 / アサイン・要員配置 / **営業管理** / 契約管理 / 工数・稼働実績 / 請求管理 / **申請・承認** / 取引先・営業 / マッチング検索
- **ADMIN のみ追加表示**: 会社情報設定
- エンジニア: マイページ のみ

---

## 5. 画面一覧（ルート）

| ルート | 画面 | 権限 |
|---|---|---|
| `/login` | ログイン | 全員 |
| `/` | 振分（`/dashboard` or `/mypage`） | 全員 |
| `/dashboard` | ダッシュボード（KPI＋離脱希望/回答待ち提案/承認待ち申請アラート） | スタッフ |
| `/engineers` … `/engineers/[id]` | 技術者 一覧/登録/編集/詳細 | スタッフ |
| `/engineers/[id]/skillsheet` | スキルシート（印刷/PDF対応） | スタッフ |
| `/projects` … `/projects/[id]` | 案件 一覧/登録/編集/詳細 | スタッフ |
| `/assignments` … `/assignments/[id]` | アサイン 一覧/登録/編集/詳細 | スタッフ |
| `/offers` | **営業管理**（営業中エンジニア一覧＋提案メール送信） | スタッフ |
| `/contracts` | **契約一覧（エンジニア×月 単価マトリクス＋検索）** | スタッフ |
| `/contracts/new`・`/contracts/[id]/edit` | 契約 作成/編集 | スタッフ |
| `/timesheets`・`/timesheets/import` | 工数・月次精算 / 勤務表取込 | スタッフ |
| `/invoices` … `/invoices/[id]` | 請求 一覧/詳細（自社フォーマットプレビュー） | スタッフ |
| `/invoices/[id]/pdf`・`/invoices/[id]/excel` | 請求書PDF/Excelダウンロード（1人1ファイル） | スタッフ |
| `/invoices/zip?ym=YYYY-MM&type=pdf\|excel` | 請求書ZIP一括ダウンロード | スタッフ |
| `/workflows` … `/workflows/new`・`/workflows/[id]` | 申請・承認（一覧/代行作成/詳細・承認） | スタッフ |
| `/clients` … `/clients/[id]` | 取引先 一覧/登録/編集/詳細（商談履歴） | スタッフ |
| `/matching` | マッチング検索 | スタッフ |
| `/settings/company` | 会社情報（請求元）設定 | 管理者(ADMIN)のみ |
| `/mypage` | エンジニア本人ポータル（参画/提案回答/各種申請） | エンジニア |
| `/api/logout` (POST) | ログアウト | 全員 |

> 技術者/スキルシート/マイページ系は `(app)/` 直下、その他スタッフ画面は `(app)/(staff)/` 配下。スタッフ画面は `requireStaff()` でガード。

---

## 6. データモデル（Prisma）

`prisma/schema.prisma` が正本。区分値は `String`＋`enums.ts` 定数。

### User
`id, email(unique), passwordHash, name, role(UserRole), isActive, engineerId?(unique→Engineer), createdAt, updatedAt`

### Engineer（技術者）
基本: `id, code(unique), name, nameKana?, email?, phone?, employmentType(EmploymentType), affiliation?, status(EngineerStatus), costRate(原価月額), sellRateMin(提示下限月額), experienceYears, joinedOn?, note?`
スキルシート項目: `initial?, ageRange?, nearestStation?, availableFrom?, finalEducation?, prText?`
リレーション: `skills, assignments, offers, qualifications, workHistories, workflowRequests, user?`

### Qualification / WorkHistory / SkillTag / EngineerSkill
- `Qualification`: `id, engineerId, name, acquiredOn?`
- `WorkHistory`: `id, engineerId, title, industry?, startOn?, endOn?, roleType(WorkRole), teamSize?, summary?, technologies?(カンマ区切り), phases?(PhaseTypeカンマ区切り), sortOrder`
- `SkillTag`: `id, name(unique), category(SkillCategory)` ／ `EngineerSkill`: `engineerId, skillId, level(1-5)` `@@unique`

### Client（取引先）
`id, name, nameKana?, clientType(ClientType), contactName?, contactEmail?, contactPhone?, closingDay(締め日 既定31=月末), paymentTermDays(支払サイト 既定30), address?, note?` ＋ `projects, invoices, activities`

### Project（案件）
`id, code(unique), title, clientId, contractType(ContractType), workLocation?, startOn?, endOn?, requiredCount, unitPriceMin/Max, requiredSkills?, status(ProjectStatus), description?` ＋ `assignments, offers`

### Assignment（アサイン）
`id, engineerId, projectId, status(AssignmentStatus), sellRate(客先請求単価月額), costRate(原価月額), startOn?, endOn?, standardHoursMin(140), standardHoursMax(180), note?` ＋ 継続意思 `renewalIntent(RenewalIntent), renewalNote?, renewalRespondedAt?` ＋ `contract?, timesheets, invoiceItems`

### ProjectOffer（案件提案＝営業→エンジニア）
`id, engineerId, projectId, status(OfferStatus), message?, engineerComment?, respondedAt?` `@@unique([engineerId, projectId])`
> モデル名・enumキーは `ProjectOffer`/`OfferStatus` のまま。**UI表記は「提案／営業管理」**に統一済み。

### Contract（契約＝アサインに1:1）
基本: `id, assignmentId(unique), contractNo(unique), contractType(ContractType), signedOn?, startOn?, endOn?, autoRenew(既定true), status(ContractStatus), note?, paymentTermDays?(支払サイト・契約ごと)`
単価: `rateType(RateType), monthlyRate(実単価／HOURLY時は時給), engineerRate?(提示額), engineerRateType(提示単位)`
精算条件: `settlementType(SettlementType), lowerHours?, upperHours?, fixedHours?, dailyStdHours?(Float), bufferHours?`
控除・超過: `settlementMethod(SettlementMethod), deductionRate?, excessRate?`

### Timesheet（工数）
`id, assignmentId, yearMonth("YYYY-MM"), workedHours(Float), status(TimesheetStatus), approvedById?, note?` `@@unique([assignmentId, yearMonth])`

### Invoice / InvoiceItem
- `Invoice`: `id, invoiceNo(unique), clientId, yearMonth, issueDate?, dueDate?, status(InvoiceStatus), subtotal, taxRate(10), taxAmount, total`
- `InvoiceItem`: `invoiceId, assignmentId?, description, unitPrice, quantity(Float), amount, note?`（amount は負値可＝控除明細）

### SalesActivity（営業活動）
`id, clientId, type(ActivityType), subject, body?, activityDate, ownerName?`

### CompanySetting（自社=請求元情報・シングルトン id="default"）
`name, registrationNumber(インボイス登録番号), postalCode, address1, address2, tel, banks(振込先・改行区切り), feeNote, updatedAt`
未設定時は `src/lib/company.ts` の `DEFAULT_COMPANY`（ラポールスター値）にフォールバック。ロゴ/角印は `public/company/{logo,seal}.png` 固定。

### WorkflowRequest（各種申請）／ WorkflowRequestItem（明細）
- `WorkflowRequest`: `id, type(RequestType), status(RequestStatus), engineerId(対象者), submittedByName?(申請者/代行者), startDate?, endDate?, leaveUnit?(LeaveUnit), hours?, days?, amount?, passPeriodMonths?, category?, reason?, approverName?, decidedAt?, decisionComment?, createdAt, updatedAt`
- `WorkflowRequestItem`: `id, requestId, itemDate?, fromPlace?, toPlace?, roundTrip(Bool), amount, note?, sortOrder`（交通費の区間/経費の明細/定期券の区間）

---

## 7. 区分値（`src/lib/enums.ts`）

| enum | 値（ラベル） |
|---|---|
| UserRole | ADMIN(管理者)/SALES(営業)/ACCOUNTING(経理)/ENGINEER(エンジニア) |
| EmploymentType | EMPLOYEE(正社員)/CONTRACT(契約社員)/BP(協力会社) |
| EngineerStatus | ASSIGNED(稼働中)/AVAILABLE(待機中)/PARTIAL(一部稼働)/LEAVING(退場予定)/RETIRED(退職) |
| SkillCategory | LANGUAGE/FRAMEWORK/DB/INFRA/CLOUD/ROLE/OTHER |
| ClientType | END(エンド)/PRIME(元請)/PARTNER(協力会社) |
| ContractType | QUASI_MANDATE(準委任)/DISPATCH(派遣)/CONTRACT(請負) |
| ProjectStatus | OPEN/PROPOSING/ONGOING/CLOSED/LOST |
| AssignmentStatus | PROPOSED(提案)/INTERVIEW(面談)/ORDERED(参画決定)/ACTIVE(稼働中)/ENDED(終了)/DECLINED(見送り) |
| ContractStatus | DRAFT/SENT/SIGNED/EXPIRED |
| RateType | MONTHLY(月額)/HOURLY(時給) |
| SettlementType | RANGE(上限下限)/FIXED(固定)/BUSINESSDAY_BUFFER(営業日数×標準±バッファ) |
| SettlementMethod | MIDDLE(中間割)/UPPER_LOWER(上下割)/MANUAL(個別指定)/NONE(精算なし) |
| TimesheetStatus | DRAFT/SUBMITTED/APPROVED |
| InvoiceStatus | DRAFT/ISSUED/SENT/PAID/OVERDUE |
| RenewalIntent | UNDECIDED/EXTEND(延長希望)/LEAVE(離脱希望) |
| OfferStatus | OFFERED(提案中)/PROCEED(進める)/DECLINED(辞退)/WITHDRAWN(取下げ) |
| WorkRole | PG/SE/PL/PM/OTHER |
| PhaseType | REQUIREMENT/BASIC_DESIGN/DETAIL_DESIGN/IMPLEMENT/UNIT_TEST/INTEGRATION_TEST/SYSTEM_TEST/MAINTENANCE |
| ActivityType | VISIT/CALL/MAIL/PROPOSAL/OTHER |
| **RequestType** | TRANSPORT(交通費精算)/EXPENSE(経費精算)/PAID_LEAVE(有給休暇)/COMMUTER_PASS(定期券)/SUMMER_LEAVE(夏季休暇)/CONDOLENCE_LEAVE(慶弔休暇)/HEALTH_CHECKUP(健康診断) |
| **RequestStatus** | DRAFT(下書き)/SUBMITTED(申請中)/APPROVED(承認)/REJECTED(差戻し)/CANCELLED(取消) |
| **LeaveUnit** | FULL(全休)/HALF(半休)/HOURLY(時間休) |

---

## 8. 業務ロジック

ロジックは `src/lib/settlement.ts`（精算）・`src/lib/workflow.ts`（申請）・`src/lib/utils.ts`（表示）・`src/lib/invoice-*.ts`（請求書）に集約。

### 8-1. 二重単価／月額・時給
- `rateType=MONTHLY`: `monthlyRate`は月額。月次精算は精算条件に従う。`HOURLY`: `monthlyRate`は時給、月額＝実働×時給。
- `monthlyRate`=実単価（スタッフのみ）、`engineerRate`=提示額（本人に見せる）。本人画面は提示額基準で算出し実単価は漏らさない。提示単位は `presentedRateUnit(contract)`。

### 8-2〜8-4. 月次精算（`calcMonthlySettlement`）
- 精算幅: RANGE=`lowerHours〜upperHours` / FIXED=`fixedHours` / BUSINESSDAY_BUFFER=`実営業日数×dailyStdHours ± bufferHours`（月変動）。
- 控除/超過単価: MIDDLE=base÷中央、UPPER_LOWER=base÷下限/÷上限、MANUAL=指定値、NONE=なし。
- 実営業日数＝`businessDaysInMonth`（土日＋祝日除外。祝日テーブル2025-2027内蔵、年次メンテ要）。
- 稼働<下限→控除、>上限→超過、範囲内→増減なし。HOURLY→実働×時給。

### 8-5. 勤務表アップロード取込
`/timesheets/import`。Excel複数アップロード→解析（年月/氏名/要員番号はファイル名補完、実働時間=Excel時刻シリアル/h:mm/「8時間30分」解釈）→突合（要員番号→氏名→当月有効アサイン）→プレビュー→確定。取込後 `Timesheet` upsert（承認済はAPPROVED維持）。

### 8-6. 継続意思 / 8-7. 案件提案（営業管理）
- マイページで参画中アサインの**延長/離脱/保留**を表明（`Assignment.renewalIntent`）。ダッシュボード「離脱を希望している要員」に反映。
- **営業管理 `/offers`**: 営業中の技術者（待機/一部稼働/退場予定 or 提案・面談進行中）をカード一覧。各技術者ごとに **提案メール**（保留=OFFERED/承諾=PROCEED/辞退=DECLINED）と **面談**（調整中=PROPOSED/結果待ち=INTERVIEW）の件数集計、直近7日に本人回答があれば「新着あり」。同画面下部に提案メール送信フォーム。本人はマイページで「進める/辞退」回答。
- **用語**: 全画面「提案／案件を提案」に統一（旧「オファー」表記は廃止）。本人画面は「案件一覧/案件回答」。

### 8-8. 請求の自動生成 ＋ PDF/Excel/ZIP出力
- `/invoices` で対象月を指定し自動生成 → 稼働中アサインを**「取引先 × エンジニア」単位（1人ずつ）に分割**して `Invoice`＋`InvoiceItem` を生成（消費税10%）。1請求＝1名。重複（同月・同一アサイン）はスキップ。請求番号 `INV-{YYYYMM}-{要員番号}`。
- **精算の明細展開**: 契約（実単価・精算条件）＋当月工数から `calcMonthlySettlement` を実行し、`基準額`＋`【控除精算分】/【超過精算分】`を独立明細化（マイナスは会計表記 `(¥…)`）。時給契約は「実単価×実働時間」。
- **支払期限日**: 契約の支払サイト（`Contract.paymentTermDays`）優先、無ければ取引先の既定（`Client.paymentTermDays`）。請求日＝締め日。
- **ファイル出力（無料OSS・サーバー側直接生成）**:
  - PDF `GET /invoices/[id]/pdf`（`pdf-lib`＋`@pdf-lib/fontkit`、日本語TTF=Sawarabi Gothic/OFL 埋込、ロゴ・角印PNG埋込、自社フォーマット再現）
  - Excel `GET /invoices/[id]/excel`（`xlsx`、金額は数値＋表示書式 `¥#,##0;(¥#,##0)`、画像非対応）
  - ZIP一括 `GET /invoices/zip?ym=YYYY-MM&type=pdf|excel`（`jszip`、1人1ファイル）。一覧の「PDF一括DL/Excel一括DL」ボタン
  - ファイル名 `{取引先}御中_{要員番号}_{氏名}_{YYYY-MM}.（pdf|xlsx）`
- **自社情報**は `CompanySetting`（DB）→`getCompany()` で取得。`/settings/company`（ADMIN）で会社名・登録番号・住所・電話・振込先・注記を編集。
- 関連: `invoice-doc.ts`（共有モデル・`yenAccounting`）/`invoice-pdf.ts`/`invoice-excel.ts`/`invoice-load.ts`/`company.ts`。

### 8-9. スキルシート
`/engineers/[id]/skillsheet`。経歴書項目＋`Qualification`＋`WorkHistory`。`@media print` で印刷/PDF対応。

### 8-10. マッチング / ダッシュボード
- マッチング `/matching`: スキル・単価・稼働状況で横断検索→提案/アサイン動線。
- ダッシュボード: 稼働率/待機/当月売上粗利/未入金/離脱希望/回答待ち提案/**承認待ち申請**/募集中案件。

### 8-11. 契約マトリクス（契約一覧 `/contracts`）
- **エンジニア×月の単価タイムライン表示**。行＝社員、列＝月（検索の期間で可変）、セル＝客先単価（実単価）。
- **二重単価のセルは二段表示**: 上段=実単価、下段=エンジニア提示単価（青小文字）。
- **単価セルをクリック**で当月の該当契約の編集ページ（`/contracts/[id]/edit`）へ遷移。
- **色分け**: 契約終了月=青／前月から単価アップ=黄／単価ダウン=薄紫／稼動なし(待機・育休・休職等)=赤(「待機」表示)／現在月=青枠。
- **検索パネル**: 期間(開始〜終了月)／取引先会社／在籍の状態(在籍中の自社・パートナー/自社のみ/パートナーのみ/すべて)／社員名。**タブ**: エンジニア別 / 取引先別。
- ※「自社営業担当」「支社・事業所」絞り込みは**未実装**（該当データ項目が無いため。項目追加で対応可）。

### 8-12. 申請ワークフロー（`/workflows`・マイページ）
- **申請種別7種**: 交通費／経費／有給(全休/半休/時間休)／定期券(区間＋期間1/3/6ヶ月)／夏季休暇／慶弔休暇／健康診断。
- 交通費・経費・定期券は**明細行**（日付・区間・往復・金額）。有給は単位(全休=1日/半休=0.5/時間休=時間)。
- **承認は1段階（管理者ADMINが承認/差戻し）**。状態: 申請中→承認/差戻し（コメント・承認者・日時記録）。取消は本人/スタッフ（申請中のみ）。
- **申請者**: エンジニア本人（マイページ「各種申請」）＋スタッフによる代行申請（`/workflows/new` で対象社員を選択）。対象者＝Engineer。
- **夏季休暇ルール**（`workflow.ts`）: 対象年の**6/1〜12/31**に**5日付与**。**当該年の7/1以降に入社した社員は付与なし**（前年以前入社＝5日 / 当該年6月以前入社＝5日 / 7/1以降入社＝0日）。残日数を超える申請・対象外社員の申請はサーバー側でブロック。
- アクション: `createWorkflowRequest`/`decideWorkflowRequest`(ADMIN)/`cancelWorkflowRequest`/`deleteWorkflowRequest`(ADMIN)。
- ダッシュボードに「承認待ちの申請」件数カード。

---

## 9. 主要ファイル構成

```
ses-manager/
├ prisma/ schema.prisma（正本）, seed.mjs（デモ投入・本番厳禁）
├ supabase/migrations/         # 手動適用用SQL（SQL Editorに貼付）
├ public/ company/{logo,seal}.png, fonts/SawarabiGothic-Regular.ttf
├ src/
│  ├ lib/
│  │  ├ db.ts, auth.ts, enums.ts, utils.ts
│  │  ├ actions.ts            # Server Actions（CRUD/ログイン/取込/精算/提案/請求/会社/申請）
│  │  ├ settlement.ts         # 精算ロジック・営業日数・祝日
│  │  ├ company.ts            # 自社情報（getCompany/DEFAULT_COMPANY）
│  │  ├ invoice-doc.ts / invoice-pdf.ts / invoice-excel.ts / invoice-load.ts
│  │  ├ workflow.ts           # 申請の種別分類・夏季休暇ルール・日数計算
│  │  └ timesheet-import.ts / timesheet-import-plan.ts
│  ├ components/ Sidebar.tsx, ui.tsx, form.tsx, RequestForm.tsx
│  └ app/
│     ├ login/, page.tsx, api/logout/
│     └ (app)/
│        ├ mypage/                      # 本人ポータル（参画/提案回答/各種申請）
│        ├ engineers/…/skillsheet/
│        └ (staff)/ dashboard, engineers系, projects, assignments, offers(営業管理),
│                   contracts(マトリクス), timesheets(+import), invoices(+[id]/pdf|excel, zip),
│                   workflows(+new,[id]), clients, matching, settings/company
└ docs/ MASTER_SPEC.md（本書）, DEPLOY_VERCEL_SUPABASE.md
```

---

## 10. デモアカウント（seed投入）

| ロール | メール | パスワード |
|---|---|---|
| 管理者 | admin@ses-manager.local | admin1234 |
| 営業 | sales@ses-manager.local | sales1234 |
| エンジニア | yamada@ses-manager.local | eng1234 |
| エンジニア(待機/提案受信) | suzuki@ses-manager.local | eng1234 |
| エンジニア(離脱例/時給契約) | takahashi@ses-manager.local | eng1234 |

> 公開URLは誰でもログイン可。社外共有前にパスワード変更推奨。本番には実データあり。

---

## 11. 設計方針・規約（決定事項）

1. 完全日本語UI（識別子のみ英語）
2. 無料OSSのみ・有料API/外部送信なし
3. Prisma `enum`/配列/`Json` 不使用（`String`＋TS定数／中間テーブル／区切り文字列）
4. Server Components 基本＋Server Actions でCRUD。対話的UIのみ `'use client'`
5. 金額=整数(円)、消費税=10%、工数/日数=Float
6. スタッフ画面は `requireStaff()` ガード。会社情報設定はADMINのみ。エンジニアは自分のデータのみ
7. 二重単価は「本人への見せ方」だけに作用し、実単価は漏らさない

---

## 12. 既知の制約・運用注意

- 祝日テーブルは2025-2027内蔵（`settlement.ts`）。年次メンテ要。
- 勤務表取込・請求書PDF/ZIPはアップロード/サーバー生成方式。請求PDFは日本語フォントをフル埋込（≈1MB/件）。
- DBスキーマ変更は `npm run db:push` か `supabase/migrations/` のSQLを SQL Editor で Run（RLSは「Run without RLS」）。`db:seed` は本番厳禁。
- 請求の自動生成は**精算を反映**（旧仕様の実単価フラット請求から変更済）。控除/超過行は契約＋当月工数がある場合のみ。
- 既存の集約方式で生成済みの請求は1人ずつへ自動変換されない（該当月を削除→再生成）。
- 契約マトリクスの「営業担当/支社」絞り込みは未実装（データ項目なし）。

---

## 13. 今後の拡張候補（未実装）

- 契約マトリクスへ「営業担当」「支社・事業所」項目追加（フィールド追加＋移行SQL）
- 申請の多段承認・残数ダッシュボード（有給/夏季の付与・消化管理）
- 請求書の読み取り専用詳細ページ、ロゴ/角印の画面アップロード
- 祝日テーブルの自動更新、独自ドメイン、本番デモアカウント整理

---

## 14. 引継ぎ時の着手手順（新担当向け）

1. 本書 §6–8 でデータモデルと業務ロジック（特に**精算 §8-2〜8-4**・**二重単価 §8-1**・**請求 §8-8**・**契約マトリクス §8-11**・**申請 §8-12**）を把握
2. `prisma/schema.prisma` と `src/lib/{settlement,workflow,company,invoice-*}.ts`・`enums.ts` を一読（正本）
3. ローカル起動: `.env` にSupabase接続 → `npm install && npm run db:push && npm run dev`（既存本番DBに繋ぐ場合は db:push 不要）
4. デモ/管理者アカウントで各画面確認（契約フォーム＝精算条件の出し分け、請求のPDF/Excel/ZIP、申請の承認、契約マトリクス、会社情報設定）
5. 変更は `main` へ git push で Vercel 自動デプロイ。**DBスキーマ変更時は `db:push` か `supabase/migrations/` のSQLを先に適用**してからデプロイ

---
（本書は `ses-manager` 実装を正本として作成。仕様変更時は本書も更新すること。）
