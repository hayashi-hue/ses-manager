# SES業務管理システム

SES（システムエンジニアリングサービス／客先常駐・技術者派遣）企業の業務を一括管理する社内基幹システムです。
**技術者・案件・アサイン・契約・工数・請求・営業**を1つの画面で回せます。

## 主な機能

| モジュール | できること |
|---|---|
| 📊 ダッシュボード | 稼働率・待機要員・当月想定売上/粗利・未入金請求を一覧 |
| 👷 技術者管理 | 要員のスキル・単価・稼働ステータス・経歴を管理 |
| 📁 案件管理 | 取引先案件・必須スキル・想定単価・募集状況を管理 |
| 🔗 アサイン・要員配置 | 技術者×案件の割当。**請求/原価から粗利を自動計算** |
| 📝 契約管理 | 準委任/派遣/請負の契約。満了間近アラート付き |
| 🕐 工数・稼働実績 | 月次の稼働時間を入力・承認 |
| 💴 請求管理 | 稼働中アサインから**月次請求を自動生成**・請求書プレビュー |
| 🏢 取引先・営業 | クライアント管理＋商談履歴の記録 |
| 🔍 マッチング検索 | スキル・単価・稼働状況で要員を横断検索 |

## 技術スタック

- Next.js 16 (App Router / Server Actions)
- React 19 / TypeScript
- Prisma 6 + **PostgreSQL（Supabase）**
- Tailwind CSS v4
- 認証: 自前（bcrypt + 署名付きCookie）。**有料API・外部送信は一切なし**

## デプロイ（Vercel + Supabase）

デモデータ付きでのデプロイ手順は **[docs/DEPLOY_VERCEL_SUPABASE.md](docs/DEPLOY_VERCEL_SUPABASE.md)** を参照してください。
要点: ① Supabaseで接続文字列取得 → ② ローカルから `npm run db:push && npm run db:seed` で1回だけ投入 → ③ VercelでRoot Directory=`ses-manager`・環境変数(DATABASE_URL/DIRECT_URL/SESSION_SECRET)設定 → Deploy。

## セットアップ（3コマンドで起動）

```bash
cd ses-manager
# .env に Supabase の DATABASE_URL / DIRECT_URL / SESSION_SECRET を設定（.env.example 参照）
npm install            # 依存インストール（prisma generate も実行）
npm run db:push        # DB（PostgreSQL/Supabase）スキーマ作成
npm run db:seed        # サンプルデータ投入（1回だけ）
npm run dev            # 開発サーバー起動 → http://localhost:3000
```

> DB は PostgreSQL（Supabase）です。接続文字列は `.env.example` を参照。本番運用前に `SESSION_SECRET` を必ず変更してください。

## 初期ログインアカウント

| ロール | メールアドレス | パスワード |
|---|---|---|
| 管理者 | admin@ses-manager.local | admin1234 |
| 営業 | sales@ses-manager.local | sales1234 |
| エンジニア | yamada@ses-manager.local | eng1234 |

## データモデル概要

```
取引先(Client) ─┬─ 案件(Project) ─┬─ アサイン(Assignment) ─┬─ 契約(Contract)
                │                  │                       ├─ 工数(Timesheet)
                │                  │                       └─ 請求明細(InvoiceItem)
                ├─ 請求(Invoice) ──┘
                └─ 営業活動(SalesActivity)

技術者(Engineer) ─ スキル(EngineerSkill ⇔ SkillTag)
```

---
SoloptiLinkAI BOOST により生成。日本語UI・無料OSSのみで構成されています。
