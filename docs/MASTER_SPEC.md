# SES業務管理システム マスター仕様書（引継ぎ資料）

> 本書は新規チャット／別担当への**引継ぎ用マスター仕様書**です。`ses-manager/` プロジェクトの実装（コード）を正本として、決定済みの全仕様を1ファイルに整理しています。
> 最終更新: 2026-06-18 ／ 対象コミット: `main`（Vercel + Supabase デプロイ済み）

---

## 1. システム概要

SES企業（システムエンジニアリングサービス＝客先常駐・技術者派遣）の業務を一括管理する社内基幹システム。
**技術者・案件・アサイン・契約・工数・月次精算・請求・取引先/営業・スキルシート**を1つのアプリで管理する。

特徴:
- **エンジニア本人ポータル（マイページ）**: 継続意思（延長/離脱）の表明、案件オファーへの応諾/辞退、自分の契約内容・月次精算の閲覧
- **二重単価**: 「実単価（客先契約）」と「エンジニア提示単価」を分離管理し、本人には提示額のみ見せる
- **月次精算の自動計算**: 契約の精算条件 × その月の実営業日数（土日祝除外）× 稼働時間で精算額を自動算出
- **勤務表アップロード取込**: Excel勤務表をアップロードし、日次の実働時間を合計して当月工数へ自動入力
- **完全日本語UI・無料OSSのみ**（有料API・外部送信なし）

---

## 2. 技術スタック

| 区分 | 採用技術 |
|---|---|
| フレームワーク | **Next.js 16**（App Router / Server Components / Server Actions） |
| 言語 | TypeScript / React 19 |
| DB | **PostgreSQL（Supabase）** ＋ **Prisma 6** |
| スタイル | Tailwind CSS v4 |
| 認証 | 自前実装（bcryptjs によるハッシュ＋HMAC署名付きCookieセッション）。外部認証サービス不使用 |
| Excel解析 | `xlsx`（SheetJS）— 勤務表取込で使用 |
| ホスティング | **Vercel** |

設計上の制約（重要・厳守）:
- **Prisma `enum` は使わない** → `String` カラム＋ `src/lib/enums.ts` のTS定数で表現（区分値の追加が容易・移植性確保）
- **配列・`Json` 型は使わない** → 中間テーブル or カンマ区切り文字列で表現
- UI文言・ラベルはすべて日本語（`enums.ts` の `〜Label` を使用）
- 金額は整数（円）、工数は `Float`（時間）

---

## 3. デプロイ構成（Vercel + Supabase）

- **Vercel**: GitHubリポジトリ（`ses-manager` をリポジトリ直下にしてある）を連携。Root Directory = `./`。Build = `npm run build`（`prisma generate && next build`）。`postinstall` で `prisma generate`。
- **Supabase（PostgreSQL）**: 
  - 実行時は **Connection Pooler（port 6543, `?pgbouncer=true`）** を `DATABASE_URL` に使用（サーバーレスの接続枯渇対策）
  - マイグレーション/seed は **Direct（port 5432）** を `DIRECT_URL` に使用（Prisma の `directUrl`）
- **デモデータ投入**: `npm run db:push`（テーブル作成）→ `npm run db:seed`（デモデータ）を**1回だけ**手動実行。seedは既存データを全削除して作り直すため再実行注意。
- デプロイ手順の詳細は [`docs/DEPLOY_VERCEL_SUPABASE.md`](DEPLOY_VERCEL_SUPABASE.md) を参照。

### 環境変数
| 変数 | 用途 |
|---|---|
| `DATABASE_URL` | 実行時DB接続（本番=Pooler 6543）。ローカルseed時のみ5432推奨 |
| `DIRECT_URL` | マイグレーション/seed用（5432） |
| `SESSION_SECRET` | セッションCookieのHMAC署名鍵（本番は長いランダム文字列） |

---

## 4. 認証・権限

### ロール（UserRole）
| 値 | ラベル | 区分 |
|---|---|---|
| `ADMIN` | 管理者 | スタッフ |
| `SALES` | 営業 | スタッフ |
| `ACCOUNTING` | 経理 | スタッフ |
| `ENGINEER` | エンジニア | 本人ポータルのみ |

### 認証の仕組み（`src/lib/auth.ts`）
- パスワードは `bcryptjs` でハッシュ化（`User.passwordHash`）
- ログイン成功で `ses_session` Cookie を発行（値＝`userId` を `SESSION_SECRET` でHMAC署名、httpOnly/sameSite=lax、7日）
- `getCurrentUser()`: Cookie検証 → User取得（`isActive` 必須）
- `requireStaff()`: 未ログイン→`/login`、ENGINEER→`/mypage` へリダイレクト（スタッフ専用ページのガード）
- `getCurrentEngineerId()`: ログインユーザーに紐づく `Engineer.id`（本人ポータル用。`User.engineerId` で紐付け）

### ログイン後遷移
- `ENGINEER` → `/mypage`
- それ以外（スタッフ） → `/dashboard`

### ナビゲーション（`src/components/Sidebar.tsx`）
- スタッフ: ダッシュボード / 技術者管理 / 案件管理 / アサイン・要員配置 / 営業管理 / 契約管理 / 工数・稼働実績 / 請求管理 / 取引先・営業 / マッチング検索（**ADMIN のみ**: 会社情報設定）
- エンジニア: マイページ のみ

---

## 5. 画面一覧（ルート）

| ルート | 画面 | 権限 |
|---|---|---|
| `/login` | ログイン | 全員 |
| `/` | ルート（ログイン状態で `/dashboard` or `/mypage` へ振分） | 全員 |
| `/dashboard` | ダッシュボード（経営サマリーKPI） | スタッフ |
| `/engineers` | 技術者一覧（検索・ステータスタブ） | スタッフ |
| `/engineers/new`・`/engineers/[id]/edit` | 技術者 登録/編集 | スタッフ |
| `/engineers/[id]` | 技術者詳細（スキル・アサイン履歴・継続意思） | スタッフ |
| `/engineers/[id]/skillsheet` | スキルシート（営業提案用 経歴書・印刷/PDF対応） | スタッフ |
| `/projects` … `/projects/[id]` | 案件 一覧/登録/編集/詳細 | スタッフ |
| `/assignments` … `/assignments/[id]` | アサイン 一覧/登録/編集/詳細 | スタッフ |
| `/offers` | 営業管理（営業中エンジニア一覧：提案メール/面談のステータス集計・新着、提案メール送信） | スタッフ |
| `/contracts` … `/contracts/[id]/edit` | 契約 一覧/作成/編集 | スタッフ |
| `/timesheets` | 工数・稼働実績／月次精算 | スタッフ |
| `/timesheets/import` | 勤務表アップロード取込 | スタッフ |
| `/invoices` … `/invoices/[id]` | 請求 一覧/詳細（請求書プレビュー） | スタッフ |
| `/invoices/[id]/pdf`・`/invoices/[id]/excel` | 請求書PDF/Excelダウンロード（1人1ファイル） | スタッフ |
| `/invoices/zip?ym=YYYY-MM&type=pdf\|excel` | 対象月の請求書ZIP一括ダウンロード | スタッフ |
| `/settings/company` | 会社情報（請求元）設定 | 管理者(ADMIN)のみ |
| `/clients` … `/clients/[id]` | 取引先 一覧/登録/編集/詳細（商談履歴） | スタッフ |
| `/matching` | マッチング検索（要員⇔案件） | スタッフ |
| `/mypage` | エンジニア本人ポータル | エンジニア |
| `/api/logout` (POST) | ログアウト | 全員 |

> 技術者/スキルシート/マイページ系は `(app)/` 直下、その他スタッフ画面は `(app)/(staff)/` ルートグループ配下。スタッフ画面は各ページ冒頭で `requireStaff()` を呼びガード。

---

## 6. データモデル（Prisma / 全15モデル）

`prisma/schema.prisma` が正本。区分値は `String`＋`enums.ts` 定数。

### User（利用者）
`id, email(unique), passwordHash, name, role(UserRole), isActive, engineerId?(unique→Engineer), createdAt, updatedAt`

### Engineer（技術者）
基本: `id, code(unique=要員/社員番号), name, nameKana?, email?, phone?, employmentType(EmploymentType), affiliation?(所属/協力会社名), status(EngineerStatus), costRate(原価・月額), sellRateMin(提示単価下限・月額), experienceYears, joinedOn?, note?`
スキルシート項目: `initial?(イニシャル), ageRange?(年代), nearestStation?(最寄駅), availableFrom?(稼働可能時期), finalEducation?(最終学歴), prText?(自己PR)`
リレーション: `skills(EngineerSkill[]), assignments[], offers[], qualifications[], workHistories[], user?`

### Qualification（保有資格・スキルシート用）
`id, engineerId, name, acquiredOn?, createdAt`

### WorkHistory（職務経歴・1案件=1レコード）
`id, engineerId, title, industry?(業種), startOn?, endOn?, roleType(WorkRole), teamSize?, summary?(業務内容), technologies?(使用技術カンマ区切り), phases?(担当工程=PhaseTypeキーのカンマ区切り), sortOrder, createdAt, updatedAt`

### SkillTag（スキルマスタ）／ EngineerSkill（中間）
- `SkillTag: id, name(unique), category(SkillCategory)`
- `EngineerSkill: engineerId, skillId, level(1-5)`、`@@unique([engineerId, skillId])`

### Client（取引先）
`id, name, nameKana?, clientType(ClientType), contactName?, contactEmail?, contactPhone?, closingDay(締め日 既定31=月末), paymentTermDays(支払サイト日数 既定30), address?, note?` ＋ `projects[], invoices[], activities[]`

### Project（案件）
`id, code(unique), title, clientId, contractType(ContractType), workLocation?, startOn?, endOn?, requiredCount(必要人数), unitPriceMin/Max(想定単価・月額), requiredSkills?(カンマ区切り), status(ProjectStatus), description?` ＋ `assignments[], offers[]`

### Assignment（アサイン＝技術者×案件）
`id, engineerId, projectId, status(AssignmentStatus), sellRate(客先請求単価・月額), costRate(原価・月額), startOn?, endOn?, standardHoursMin(既定140), standardHoursMax(既定180), note?`
継続意思: `renewalIntent(RenewalIntent), renewalNote?, renewalRespondedAt?`
リレーション: `contract?, timesheets[], invoiceItems[]`

### ProjectOffer（案件オファー＝営業→エンジニア）
`id, engineerId, projectId, status(OfferStatus), message?(営業コメント), engineerComment?(本人回答), respondedAt?`、`@@unique([engineerId, projectId])`

### Contract（契約＝アサインに1:1）
基本: `id, assignmentId(unique), contractNo(unique), contractType(ContractType), signedOn?, startOn?, endOn?, autoRenew(既定true), status(ContractStatus), note?`
**単価**: `rateType(RateType=MONTHLY/HOURLY), monthlyRate(実単価。HOURLY時は時給/h), engineerRate?(提示額), engineerRateType(提示額の単位=MONTHLY/HOURLY)`
**精算条件**: `settlementType(SettlementType), lowerHours?, upperHours?, fixedHours?, dailyStdHours?(Float), bufferHours?`
**控除・超過**: `settlementMethod(SettlementMethod), deductionRate?(円/h), excessRate?(円/h)`

### Timesheet（工数＝アサイン×対象年月）
`id, assignmentId, yearMonth("YYYY-MM"), workedHours(Float), status(TimesheetStatus), approvedById?, note?`、`@@unique([assignmentId, yearMonth])`

### Invoice（請求＝取引先×対象年月）／ InvoiceItem（明細）
- `Invoice: id, invoiceNo(unique), clientId, yearMonth, issueDate?, dueDate?, status(InvoiceStatus), subtotal(税抜), taxRate(既定10), taxAmount, total(税込)`
- `InvoiceItem: invoiceId, assignmentId?, description, unitPrice, quantity(Float), amount, note?`

### SalesActivity（営業活動・商談履歴）
`id, clientId, type(ActivityType), subject, body?, activityDate, ownerName?`

### CompanySetting（自社=請求元情報・シングルトン）
`id(@default "default"), name, registrationNumber(インボイス登録番号), postalCode, address1, address2, tel, banks(振込先・改行区切り), feeNote, updatedAt`
- 請求書に印字する自社情報。`/settings/company`（ADMIN）で編集。未設定時は `src/lib/company.ts` の `DEFAULT_COMPANY`（ラポールスター値）にフォールバック。ロゴ/角印は `public/company/{logo,seal}.png` 固定。

> Contract に **`paymentTermDays?`（支払サイト・日数。契約ごと）** を追加。請求の支払期限日は「契約の支払サイト → 無ければ取引先(Client)の既定」で算出。

---

## 7. 区分値一覧（`src/lib/enums.ts`）

| enum | 値（ラベル） |
|---|---|
| UserRole | ADMIN(管理者)/SALES(営業)/ACCOUNTING(経理)/ENGINEER(エンジニア) |
| EmploymentType | EMPLOYEE(正社員)/CONTRACT(契約社員)/BP(協力会社) |
| EngineerStatus | ASSIGNED(稼働中)/AVAILABLE(待機中)/PARTIAL(一部稼働)/LEAVING(退場予定)/RETIRED(退職) |
| SkillCategory | LANGUAGE(言語)/FRAMEWORK(FW)/DB/INFRA(インフラ)/CLOUD(クラウド)/ROLE(ロール)/OTHER(その他) |
| ClientType | END(エンド)/PRIME(元請)/PARTNER(協力会社) |
| ContractType | QUASI_MANDATE(準委任)/DISPATCH(派遣)/CONTRACT(請負) |
| ProjectStatus | OPEN(募集中)/PROPOSING(提案中)/ONGOING(稼働中)/CLOSED(終了)/LOST(失注) |
| AssignmentStatus | PROPOSED(提案)/INTERVIEW(面談)/ORDERED(参画決定)/ACTIVE(稼働中)/ENDED(終了)/DECLINED(見送り) |
| ContractStatus | DRAFT(作成中)/SENT(送付済)/SIGNED(締結済)/EXPIRED(終了) |
| **RateType** | MONTHLY(月額)/HOURLY(時給) |
| **SettlementType** | RANGE(上限・下限)/FIXED(固定)/BUSINESSDAY_BUFFER(営業日数×標準±バッファ) |
| **SettlementMethod** | MIDDLE(中間割)/UPPER_LOWER(上下割)/MANUAL(個別指定)/NONE(精算なし) |
| TimesheetStatus | DRAFT(下書き)/SUBMITTED(提出済)/APPROVED(承認済) |
| InvoiceStatus | DRAFT/ISSUED(発行済)/SENT(送付済)/PAID(入金済)/OVERDUE(未入金) |
| RenewalIntent | UNDECIDED(未回答)/EXTEND(延長希望)/LEAVE(離脱希望) |
| OfferStatus | OFFERED(オファー中)/PROCEED(進める)/DECLINED(辞退)/WITHDRAWN(取下げ) |
| WorkRole | PG/SE/PL/PM/OTHER |
| PhaseType | REQUIREMENT(要件定義)/BASIC_DESIGN(基本設計)/DETAIL_DESIGN(詳細設計)/IMPLEMENT(製造)/UNIT_TEST(単体)/INTEGRATION_TEST(結合)/SYSTEM_TEST(総合)/MAINTENANCE(運用保守) |
| ActivityType | VISIT(訪問)/CALL(電話)/MAIL(メール)/PROPOSAL(提案)/OTHER |

---

## 8. 業務ロジック詳細（最重要・本システムの核）

ロジックは **`src/lib/settlement.ts`** に集約。表示用ヘルパーは `src/lib/utils.ts`（`yen`, `yenWithUnit`, `presentedRateUnit`, `formatYearMonth` 等）。

### 8-1. 契約単価：月額／時給 と 二重単価

- **単価区分 `rateType`**:
  - `MONTHLY`（月額）: `monthlyRate` は月額。月次精算は精算条件に従う（8-3,8-4）
  - `HOURLY`（時給）: `monthlyRate` は時給(円/h)。月額＝**実働時間 × 時給**（精算幅・控除/超過は適用しない）
- **二重単価**:
  - `monthlyRate` = 実単価（客先契約。**スタッフのみ閲覧**）
  - `engineerRate` = エンジニア提示単価（**本人に見せる金額**。未設定なら本人画面で単価非表示）
  - 本人画面の精算額は **engineerRate 基準で算出**するため、実単価は逆算で漏れない
- **提示額の単位 `engineerRateType`**（時給契約のときのみ意味を持つ）:
  - `HOURLY`: 本人へ「時給」で提示（月額＝提示時給×実働）
  - `MONTHLY`: 時給契約でも本人へは**固定の月額**で提示（実働に依らず固定表示）
  - 判定は `presentedRateUnit(contract)`（MONTHLY契約は常にMONTHLY）

### 8-2. 精算条件タイプ `settlementType`

| タイプ | 月次の精算幅の決まり方 |
|---|---|
| `RANGE`（上限・下限） | `lowerHours`〜`upperHours`（固定）。中央=（下限+上限)/2 |
| `FIXED`（固定） | `fixedHours` を下限=上限=中央とする。未設定なら精算なし |
| `BUSINESSDAY_BUFFER`（営業日数方式） | 標準時間 = **その月の実営業日数 × `dailyStdHours`**、下限=標準−`bufferHours`、上限=標準+`bufferHours`（**月ごとに変動**） |

### 8-3. 控除・超過の算出方式 `settlementMethod`

| 方式 | 控除単価 / 超過単価（baseRate＝基準単価） |
|---|---|
| `MIDDLE`（中間割） | 両方＝ baseRate ÷ 中央時間 |
| `UPPER_LOWER`（上下割） | 控除＝baseRate÷下限 ／ 超過＝baseRate÷上限 |
| `MANUAL`（個別指定） | `deductionRate` / `excessRate` を直接使用 |
| `NONE`（精算なし） | 控除・超過なし（amount＝baseRate） |

> baseRate は、スタッフ表示=実単価(`monthlyRate`)、エンジニア表示=提示単価(`engineerRate`)。

### 8-4. 月次精算の自動計算（`calcMonthlySettlement`）

入力: 契約(精算条件)・対象年月・稼働時間・baseRate。処理:
1. **実営業日数** = `businessDaysInMonth(yearMonth)`（土日＋**日本の祝日(2025-2027を内蔵)**を除外）
2. `rateType=HOURLY` の場合 → 金額 = round(baseRate × 稼働時間)、ステータス`hourly`、控除/超過なし
3. それ以外（月額）:
   - 稼働 < 下限 → **控除**: 増減額 = −(下限−稼働)×控除単価
   - 稼働 > 上限 → **超過**: 増減額 = +(稼働−上限)×超過単価
   - 範囲内 → 増減なし
   - 最終金額 = baseRate + 増減額
4. `settlementMethod=NONE` / 精算幅未確定 → 精算なし（金額=baseRate）

補足: BUSINESSDAY_BUFFER のフォーム上プレビューは20営業日換算の目安（定数 `NOMINAL_BUSINESS_DAYS=20`）。実際の月次計算はその月の実営業日数を使用。祝日テーブルは `settlement.ts` 内 `JP_HOLIDAYS`（運用で毎年メンテ推奨）。

### 8-5. 勤務表アップロード取込

- 画面: `/timesheets/import`（`ImportUploader.tsx` クライアント＋ `importUploadedTimesheets` サーバーアクション）
- 仕様: Excel(.xlsx/.xls)を**複数アップロード** → 解析 → 技術者・対象月・アサインへ突合 → **プレビュー（DB未反映）→ チェックを外して再アップロードで確定取込**の2段階
- 解析（`src/lib/timesheet-import.ts`）:
  - 対象年月: セルの年月パターン or ファイル名から自動検出
  - 氏名/要員番号: セルが空でも**ファイル名**から補完（例 `202601_168_林太郎_…` → 2026-01 / コード168 / 林太郎）
  - 実働時間: 「実働時間/稼働時間」列を優先検出（「始業/終業/休憩」は除外）。**Excel時刻シリアル(0.3125→7.5h)**・`h:mm`・`8時間30分`・小数を解釈。「合計」行があれば優先、なければ日次合計
- 突合（`timesheet-import-plan.ts`）: 要員番号→氏名で技術者特定 → その月に有効なアサインへ紐付け（複数時は案件名で絞込／特定不可は「アサイン複数」で除外）
- 取込時 `Timesheet` を upsert（既存承認済みは APPROVED 維持、それ以外 SUBMITTED）。取込後は月次精算が自動再計算
- ※ローカル限定で「フォルダ取込」機能も残置（`buildImportPlan`/`commitTimesheetImport`）。クラウド本番ではアップロード方式を使用。

### 8-6. エンジニア継続意思（延長/離脱）

- マイページの参画中アサインごとに、本人が **延長希望 / 離脱希望 / 保留** ＋理由コメントを表明（`Assignment.renewalIntent`）
- スタッフ側: 技術者詳細・**ダッシュボードの「離脱を希望している要員」アラート**に反映
- アクション: `respondRenewal`（本人または ADMIN/SALES のみ操作可）

### 8-7. 案件オファー（営業→本人、進める/辞退）

- 営業/管理者が `/offers`・マッチング・技術者詳細から案件をオファー送信（推薦コメント付き、`ProjectOffer`）
- 本人がマイページで案件内容（提示単価・勤務地・必須スキル・営業コメント）を確認し **進める / 辞退** ＋コメント
- 応諾後、管理側オファー一覧から「アサイン化」リンクで参画手続きへ
- アクション: `createOffer`/`respondOffer`/`withdrawOffer`（送信はADMIN/SALES、回答は本人または代理スタッフ）
- ※用語ルール（決定済み）: 本人画面では「オファー」ではなく「**案件一覧 / 案件回答**」と表記。管理側メニューは「**営業管理**」（旧「案件オファー」）。
- **営業管理画面 `/offers`**: 営業中の技術者（待機/一部稼働/退場予定、または提案・面談が進行中）を一覧カード表示。各技術者ごとに **提案メール**（保留=OFFERED / 承諾=PROCEED / 辞退=DECLINED）と **面談**（調整中=PROPOSED / 結果待ち=INTERVIEW）の件数を集計。直近7日に本人回答があれば「新着あり」。カードから技術者詳細へ遷移。提案メール送信フォームも同画面に残置。

### 8-8. 請求の自動生成 ＋ Excel/PDF出力

- `/invoices` で対象月を指定し「当月分の請求を自動生成」→ 稼働中アサインを**「取引先 × エンジニア」単位（1人ずつ）に分割**して `Invoice`＋`InvoiceItem` を生成（消費税10%）。1請求＝1名のため、PDF・Excelも1人につき1ファイルずつ出力される。同一エンジニアが同一取引先で複数アサインを持つ場合のみ1通に集約。重複（同月・同一アサイン）はスキップ。請求番号は `INV-{YYYYMM}-{要員番号}`。
- **精算の明細展開**: 各アサインの契約（実単価・精算条件）＋当月工数(`Timesheet`)から `calcMonthlySettlement` を実行し、`基準額`の明細に加えて **控除なら「【控除精算分】」／超過なら「【超過精算分】」を独立明細行**として自動生成（マイナスは会計表記 `(¥…)`）。契約or当月工数が無い場合は基準額フラット請求。時給契約は「実単価×実働時間」。
- **請求日/支払期限日**: 請求日＝取引先の締め日（その月）、支払期限日＝請求日＋支払サイト日数（`Client.closingDay`/`paymentTermDays`）。
- 請求詳細 `/invoices/[id]` は自社フォーマットの請求書プレビュー（御中・請求元ブロック・ロゴ/角印・明細・小計/消費税/合計・振込先）。ステータス更新・削除可。
- **ファイル出力（サーバー側直接生成・無料OSSのみ）**:
  - PDF: `GET /invoices/[id]/pdf` — `pdf-lib`＋`@pdf-lib/fontkit`、日本語TTF(Sawarabi Gothic/OFL)埋込、ロゴ・角印PNG埋込。添付フォーマットを座標で再現。
  - Excel: `GET /invoices/[id]/excel` — `xlsx`(SheetJS)再利用、金額は数値＋表示書式 `¥#,##0;(¥#,##0)`（負値括弧）で編集可。※コミュニティ版は画像非対応のため角印はPDFのみ。
  - ファイル名規則: `{取引先}御中_{要員番号}_{氏名}_{YYYY-MM}.（pdf|xlsx）`（1エンジニア1請求時）／複数時は `{取引先}御中_{YYYY-MM}`。
  - **ZIP一括出力**: `GET /invoices/zip?ym=YYYY-MM&type=pdf|excel` — 対象月の全請求書を1人1ファイルでZIP化（`jszip`）。一覧画面の「PDF一括DL」「Excel一括DL」ボタンから。
- **請求元（自社）情報**は `CompanySetting`（DB）で管理し、`src/lib/company.ts` の `getCompany()` が取得（未設定は `DEFAULT_COMPANY` にフォールバック）。`/settings/company`（ADMIN）で会社名・登録番号・住所・電話番号・振込先・注記を編集可能。ロゴ/角印は `public/company/{logo,seal}.png`、フォントは `public/fonts/SawarabiGothic-Regular.ttf`。
- **支払期限日**は契約ごとの支払サイト（`Contract.paymentTermDays`）を優先、無ければ取引先の既定（`Client.paymentTermDays`）。
- 関連ファイル: `src/lib/invoice-doc.ts`（共有ドキュメントモデル・`yenAccounting`）／`invoice-pdf.ts`／`invoice-excel.ts`／`invoice-load.ts`／`company.ts`。追加依存: `pdf-lib`・`@pdf-lib/fontkit`・`jszip`。

### 8-9. スキルシート（営業提案用 経歴書）

- 画面: `/engineers/[id]/skillsheet`。`Engineer` の経歴書項目＋`Qualification`＋`WorkHistory`（職務経歴・担当工程`PhaseType`・使用技術）で構成
- **印刷/PDF対応**: `globals.css` の `@media print` でサイドバー等を隠し本文のみ印刷（`.print-card` / `.no-print`）

### 8-10. マッチング検索 / ダッシュボード

- マッチング `/matching`: スキル・単価上限・稼働状況で要員を横断検索 → オファー送信/アサインへ動線
- ダッシュボード `/dashboard`: 稼働率／待機要員／当月想定売上・粗利（稼働中アサインの実単価合計）／未入金請求／離脱希望要員／回答待ちオファー／募集中案件／直近アサイン動向

---

## 9. 主要ファイル構成

```
ses-manager/
├ prisma/
│  ├ schema.prisma          # データモデル（正本）
│  └ seed.mjs               # デモデータ投入
├ src/
│  ├ lib/
│  │  ├ db.ts               # PrismaClient シングルトン
│  │  ├ auth.ts             # 認証・セッション・requireStaff
│  │  ├ enums.ts            # 全区分値＋日本語ラベル
│  │  ├ actions.ts          # Server Actions（CRUD・ログイン・取込・精算・オファー等）
│  │  ├ settlement.ts       # 精算ロジック・営業日数・祝日（業務の核）
│  │  ├ utils.ts            # 金額/日付/提示単位ヘルパー
│  │  ├ timesheet-import.ts # 勤務表Excel解析
│  │  └ timesheet-import-plan.ts # 解析結果→技術者/アサイン突合
│  ├ components/            # Sidebar / ui.tsx / form.tsx（共通UI）
│  └ app/
│     ├ login/ , page.tsx , api/logout/
│     └ (app)/
│        ├ layout.tsx       # 認証ガード＋サイドバー
│        ├ mypage/          # エンジニア本人ポータル
│        ├ engineers/…/skillsheet/  # 技術者・スキルシート
│        └ (staff)/         # dashboard/projects/assignments/offers/contracts/timesheets(+import)/invoices/clients/matching
├ docs/
│  ├ MASTER_SPEC.md         # 本書
│  └ DEPLOY_VERCEL_SUPABASE.md
└ scripts/make-sample-kinmuhyo.mjs  # サンプル勤務表生成（dev用）
```

---

## 10. デモアカウント（seed投入）

| ロール | メール | パスワード |
|---|---|---|
| 管理者 | admin@ses-manager.local | admin1234 |
| 営業 | sales@ses-manager.local | sales1234 |
| エンジニア | yamada@ses-manager.local | eng1234 |
| エンジニア(待機/オファー受信) | suzuki@ses-manager.local | eng1234 |
| エンジニア(離脱例/時給契約) | takahashi@ses-manager.local | eng1234 |

デモデータ: 技術者8名・取引先3社・案件5件・アサイン6件・契約4件（月額/時給の精算パターン各種）・工数・請求・オファー・営業活動。
> 公開URLでは誰でもログイン可能なため、社外共有前にパスワード変更を推奨。

---

## 11. 設計方針・規約（決定事項）

1. **完全日本語UI**（ボタン・ラベル・メッセージすべて日本語。識別子のみ英語）
2. **無料OSSのみ**・有料API/外部送信なし
3. Prisma `enum`/配列/`Json` 不使用（`String`＋TS定数／中間テーブル／カンマ区切り）
4. **Server Components 基本＋Server Actions でCRUD**。フォーム送信はServer Action、対話的UIのみ `'use client'`
5. 金額=整数(円)、消費税=10%、工数=Float(時間)
6. スタッフ画面は `requireStaff()` でガード。エンジニアは自分のデータのみ閲覧
7. 二重単価は「本人への見せ方」だけに作用し、実単価はエンジニアに漏らさない

---

## 12. 既知の制約・運用注意

- **祝日テーブルは 2025–2027 を内蔵**（`settlement.ts`）。年次でメンテ要。将来は内閣府CSV取込等で自動化候補。
- **勤務表取込はアップロード方式**（クラウドはローカルフォルダ不可）。Vercelのリクエストボディ上限 約4.5MB（勤務表は数十KB/件のため実質問題なし）。
- `db:seed` は全削除→再作成。**本番でのseed再実行は厳禁**。
- 勤務表の解析は一般的レイアウトのヒューリスティック。様式が大きく異なる場合はパーサー調整が必要。
- Supabase無料枠は一定期間未アクセスで一時停止（次アクセスで自動再開）。

---

## 13. 今後の拡張候補（会話で言及・未実装）

- 勤務表ファイル名規則・マッチングキー（要員番号）の運用ルール確定
- 時給契約の上限頭打ち（日割り上限）・深夜/残業割増ルール
- 祝日テーブルの自動更新
- 独自ドメイン割当 / Vercel Deployment Protection（社内デモ限定公開）
- 本番運用に向けたデモアカウントのパスワード変更・初期データの空運用化
- ~~請求のExcel/PDF出力~~（**実装済み** §8-8）、契約書面の自動生成

---

## 14. 引継ぎ時の着手手順（新担当向け）

1. 本書 §6–8 でデータモデルと業務ロジック（特に**精算 §8-2〜8-4**と**二重単価 §8-1**）を把握
2. `prisma/schema.prisma` と `src/lib/settlement.ts` / `enums.ts` を一読（正本）
3. ローカル起動: `.env` にSupabase接続を設定 → `npm install && npm run db:push && npm run db:seed && npm run dev`
4. デモアカウントで各画面を確認（特に契約フォーム＝精算条件の出し分け、工数/月次精算、マイページ）
5. 変更は `git push` で Vercel 自動デプロイ。DBスキーマ変更時は `prisma db push`（Supabase directUrl）

---
（本書は `ses-manager` 実装を正本として作成。仕様変更時は本書も更新すること。）
