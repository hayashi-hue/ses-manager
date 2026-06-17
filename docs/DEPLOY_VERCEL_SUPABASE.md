# Vercel + Supabase デプロイ手順（デモデータ付き）

このシステムを **Vercel（ホスティング）+ Supabase（PostgreSQL）** にデプロイし、デモデータ付きで公開する手順です。

---

## 0. 前提
- Supabase アカウント（既存の別システムと同じでOK）
- Vercel アカウント
- このプロジェクト（`ses-manager/`）を GitHub リポジトリに push 済み
  - ⚠️ このプロジェクトは `発注ナビ/ses-manager` のサブフォルダにあります。Vercel 連携時に **Root Directory = `ses-manager`** を指定するか、`ses-manager` だけを別リポジトリにしてください。

---

## 1. Supabase でデータベースを用意
1. Supabase で新規プロジェクトを作成（リージョンは東京 `ap-northeast-1` 推奨）
2. **Project Settings → Database → Connection string** で2種類の接続文字列を取得:
   - **Transaction（pooler・port 6543）** → `DATABASE_URL` に使用（実行時）
   - **Session（direct・port 5432）** → `DIRECT_URL` に使用（マイグレーション/seed）
3. `[YOUR-PASSWORD]` を実際のDBパスワードに置換しておく

---

## 2. デモデータを Supabase に投入（ローカルから1回だけ）
ローカルの `ses-manager/` で、`.env` を Supabase の値に設定してから実行します。

```bash
cd ses-manager

# .env に DATABASE_URL / DIRECT_URL（Supabaseの値）/ SESSION_SECRET を設定（.env.example 参照）
# ※ seed/push は DIRECT(5432) 接続が安全なので、実行中だけ DATABASE_URL に Direct 接続を入れてもOK

npm install            # 依存インストール（prisma generate も走る）
npm run db:push        # Supabase にテーブルを作成
npm run db:seed        # デモデータ投入（⚠️ 既存データを消して作り直すので「1回だけ」）
```

> seed は **デプロイのたびに自動実行しません**（データが消えるため）。最初の1回だけ手動で流してください。

---

## 3. Vercel でデプロイ
1. Vercel → **Add New → Project** → 該当 GitHub リポジトリを Import
2. **Root Directory** に `ses-manager` を指定（サブフォルダのため必須）
3. Framework Preset は **Next.js**（自動検出）。Build Command は `npm run build`（`prisma generate && next build` を実行）
4. **Environment Variables** に以下を登録（Production/Preview 両方）:
   | 変数 | 値 |
   |---|---|
   | `DATABASE_URL` | Supabase の **Transaction（6543, pgbouncer）** |
   | `DIRECT_URL` | Supabase の **Session（5432）** |
   | `SESSION_SECRET` | 長いランダム文字列（`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` で生成） |
5. **Deploy** を実行

---

## 4. 動作確認
- 発行された URL を開き、デモアカウントでログイン:
  | ロール | メール | パスワード |
  |---|---|---|
  | 管理者 | admin@ses-manager.local | admin1234 |
  | 営業 | sales@ses-manager.local | sales1234 |
  | エンジニア | yamada@ses-manager.local | eng1234 |
- ダッシュボード・各管理画面・マイページが表示されればOK

---

## 補足・注意点

### 勤務表の取込について
クラウド（Vercel）ではローカルフォルダを参照できないため、**「勤務表をアップロード取込」**（画面からExcelを選択してアップロード）に変更済みです。
- Vercel のリクエストボディ上限は約 4.5MB。Excel勤務表は1ファイル数十KBなので、数十名分まとめても問題ありません。
- 大量（数百ファイル）を一度に上げる場合は数回に分けてください。

### Supabase 無料枠の注意
- 無料プロジェクトは一定期間アクセスがないと一時停止します（次アクセスで自動再開）。デモ用途なら問題ありません。
- 接続は必ず **pooler（6543）** を `DATABASE_URL` に使ってください（サーバーレスは接続を多数開くため、直結だと枯渇します）。

### セキュリティ
- 本番運用前に `SESSION_SECRET` を必ず変更してください。
- デモアカウントのパスワードは公開前に変更を推奨します（`prisma/seed.mjs` を編集して再投入、または管理画面から）。

### ローカル開発に戻す場合
- スキーマは PostgreSQL 固定です。ローカルでも Supabase（または `docker run postgres`）に接続してください。
- SQLite に戻したい場合は `schema.prisma` の `provider` を `sqlite`、`DATABASE_URL` を `file:./prisma/dev.db` にすればローカルのみ動きます（その場合 Vercel デプロイ用とは分けて管理）。
