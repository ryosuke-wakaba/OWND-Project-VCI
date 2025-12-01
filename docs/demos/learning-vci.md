# learning-vci

Learning Credential（学習証明書）を発行するVCIデモ。

## 概要

EUDI Wallet仕様に準拠した教育クレデンシャルを発行する。`demos/employee-vci`をベースに実装。

## Credential仕様

### 基本情報

| 項目 | 値 |
|------|-----|
| vct | `urn:eu.europa.ec.eudi:learning:credential:1` |
| format | `dc+sd-jwt` |
| scope | `LearningCredential` |

### データフィールド

#### 必須フィールド (Mandatory)

| フィールド名 | 型 | SD | 説明 |
|------------|---|---|------|
| `issuing_authority` | string | Never | 発行機関名 |
| `issuing_country` | string | Never | 発行国 (ISO 3166-1 Alpha-2) |
| `date_of_issuance` | string | Never | 発行日 (YYYY-MM-DD) |
| `family_name` | string | Always | 姓 |
| `given_name` | string | Always | 名 |
| `achievement_title` | string | Never | コース/資格の公式タイトル |

#### オプションフィールド (Optional)

| フィールド名 | 型 | SD | 説明 |
|------------|---|---|------|
| `date_of_expiry` | string | Never | 有効期限 (YYYY-MM-DD) |
| `achievement_description` | string | Never | 実績の説明 |
| `learning_outcomes` | string[] | Always | 学習成果リスト |
| `assessment_grade` | string | Always | 評価/成績 |

---

## 起動手順

### 1. 環境設定

`.env.sample` をコピーして `.env` を作成:

```bash
cd demos/learning-vci
cp .env.sample .env
```

### 2. 外部URL経由でアクセスする場合（zrok等）

モバイルウォレットからアクセスするには、ローカルサーバーを外部公開する必要があります。

#### zrokのセットアップ

```bash
# zrokで公開（別ターミナルで実行）
zrok share public http://localhost:3001
```

表示されたURL（例: `https://xxxxx.share.zrok.io`）を `.env` に設定:

```bash
# .env
CREDENTIAL_ISSUER=https://xxxxx.share.zrok.io
CREDENTIAL_ISSUER_IDENTIFIER=https://xxxxx.share.zrok.io
```

#### ngrokの場合

```bash
ngrok http 3001
```

### 3. ビルド・起動

```bash
# ビルド
npm run build

# 起動
npm run dev
```

### 4. 管理画面へアクセス

- ローカル: http://localhost:3001/admin/learners
- 外部URL: https://xxxxx.share.zrok.io/admin/learners

Basic認証:
- ユーザー名: `BASIC_AUTH_USERNAME` の値（デフォルト: admin）
- パスワード: `BASIC_AUTH_PASSWORD` の値（デフォルト: admin）

---

## 実装状況

### Phase 1: プロジェクト構造作成 ✅
- [x] `demos/learning-vci/` ディレクトリ作成
- [x] `package.json` 作成
- [x] `tsconfig.json` 作成
- [x] 基本ディレクトリ構造作成

### Phase 2: データモデル実装 ✅
- [x] `src/store.ts` - 学習者データストア
- [x] DDL定義（learners テーブル）

### Phase 3: メタデータ実装 ✅
- [x] `src/metadata/credentialConfigs.ts` - Learning Credential設定
- [x] `src/metadata/MetadataRepository.ts` - メタデータリポジトリ

### Phase 4: Credential発行ロジック ✅
- [x] `src/logic/learningCredential.ts` - クレデンシャル発行
- [x] `src/logic/vciConfigProvider.ts` - VCI設定
- [x] `src/logic/credentialsConfigProvider.ts` - クレデンシャル設定
- [x] `src/logic/nonceConfigProvider.ts` - Nonce設定

### Phase 5: ルーティング ✅
- [x] `src/routes/vci/routes.ts` - VCIエンドポイント
- [x] `src/routes/admin/routes.ts` - 管理API
- [x] `src/routes/admin/routesHandler.ts` - 管理APIハンドラ

### Phase 6: アプリケーション統合 ✅
- [x] `src/app.ts` - Koaアプリ
- [x] `src/index.ts` - エントリポイント
- [x] 環境変数設定（`.env.sample`）

### Phase 7: テスト・動作確認 ✅
- [x] TypeScriptコンパイル確認

---

## ファイル構成（予定）

```
demos/learning-vci/
├── package.json
├── tsconfig.json
├── .env.sample
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── store.ts
│   ├── logic/
│   │   ├── learningCredential.ts
│   │   ├── vciConfigProvider.ts
│   │   ├── credentialsConfigProvider.ts
│   │   └── nonceConfigProvider.ts
│   ├── metadata/
│   │   ├── credentialConfigs.ts
│   │   └── MetadataRepository.ts
│   └── routes/
│       ├── vci/
│       │   └── routes.ts
│       └── admin/
│           ├── routes.ts
│           └── routesHandler.ts
└── tests/
```

---

## 参考

- [Learning Credential移行ガイド](/Users/ryousuke/repositories/ownd/ipa2025/OWND-Project-VP/docs/archive/learning-credential-migration.md)
- [employee-vci](./employee-vci.md)
- EUDI-Wallet-NiScy_JP EU pilot_v0.10.docx
