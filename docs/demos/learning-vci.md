# learning-vci

Learning Credential（学習証明書）を発行する VCI デモ。

## 概要

EUDI Wallet 仕様に準拠した教育クレデンシャルを発行する。`demos/employee-vci`をベースに実装。

## Credential 仕様

### 基本情報

| 項目   | 値                                            |
| ------ | --------------------------------------------- |
| vct    | `urn:eu.europa.ec.eudi:learning:credential:1` |
| format | `dc+sd-jwt`                                   |
| scope  | `LearningCredential`                          |

### データフィールド

#### 必須フィールド (Mandatory)

| フィールド名        | 型     | SD     | 説明                        |
| ------------------- | ------ | ------ | --------------------------- |
| `issuing_authority` | string | Never  | 発行機関名                  |
| `issuing_country`   | string | Never  | 発行国 (ISO 3166-1 Alpha-2) |
| `date_of_issuance`  | string | Never  | 発行日 (YYYY-MM-DD)         |
| `family_name`       | string | Always | 姓                          |
| `given_name`        | string | Always | 名                          |
| `achievement_title` | string | Never  | コース/資格の公式タイトル   |

#### オプションフィールド (Optional)

| フィールド名              | 型       | SD     | 説明                  |
| ------------------------- | -------- | ------ | --------------------- |
| `date_of_expiry`          | string   | Never  | 有効期限 (YYYY-MM-DD) |
| `achievement_description` | string   | Never  | 実績の説明            |
| `learning_outcomes`       | string[] | Always | 学習成果リスト        |
| `assessment_grade`        | string   | Always | 評価/成績             |

---

## 起動手順

### 1. 環境設定

`.env.sample` をコピーして `.env` を作成:

```bash
cd demos/learning-vci
cp .env.sample .env
```

### 2. 外部 URL 経由でアクセスする場合（zrok 等）

モバイルウォレットからアクセスするには、ローカルサーバーを外部公開する必要があります。

#### zrok のセットアップ

```bash
# zrokで公開（別ターミナルで実行）
zrok share public http://localhost:3001
```

表示された URL（例: `https://xxxxx.share.zrok.io`）を `.env` に設定:

```bash
# .env
CREDENTIAL_ISSUER=https://xxxxx.share.zrok.io
CREDENTIAL_ISSUER_IDENTIFIER=https://xxxxx.share.zrok.io
```

#### ngrok の場合

```bash
ngrok http 3001
```

### 3. ビルド・起動

```bash
# ビルド（lint/prettier含む）
npm run build

# 起動
npm run start

# 開発モード（ホットリロード）
npm run dev
```

### 4. 管理画面へアクセス

- ローカル: http://localhost:3001/admin/learners
- 外部 URL: https://xxxxx.share.zrok.io/admin/learners

Basic 認証:

- ユーザー名: `BASIC_AUTH_USERNAME` の値（デフォルト: admin）
- パスワード: `BASIC_AUTH_PASSWORD` の値（デフォルト: admin）

---

## ファイル構成

```
demos/learning-vci/
├── package.json
├── tsconfig.json
├── .env.sample
├── src/
│   ├── index.ts                 # エントリポイント
│   ├── app.ts                   # Koaアプリケーション設定
│   ├── store.ts                 # 学習者データストア
│   ├── logic/
│   │   ├── learningCredential.ts      # クレデンシャル発行ロジック
│   │   ├── vciConfigProvider.ts       # VCI設定プロバイダ
│   │   ├── credentialsConfigProvider.ts # クレデンシャル設定
│   │   └── nonceConfigProvider.ts     # Nonce設定
│   ├── metadata/
│   │   ├── credentialConfigs.ts       # Learning Credential定義
│   │   └── MetadataRepository.ts      # メタデータリポジトリ
│   └── routes/
│       ├── vci/
│       │   └── routes.ts              # VCIエンドポイント
│       └── admin/
│           ├── routes.ts              # 管理画面ルート定義
│           └── routesHandler.ts       # 管理画面ハンドラ
└── views/
    ├── layout.ejs                     # 共通レイアウト
    └── admin/
        ├── index.ejs                  # 管理画面トップ
        ├── learners.ejs               # 学習者一覧
        ├── learner-new.ejs            # 学習者新規登録
        ├── learner-edit.ejs           # 学習者編集
        ├── learner-offer.ejs          # Credential Offer生成
        ├── credential-offer.ejs       # Credential Offer表示（QRコード）
        ├── keys.ejs                   # キーペア一覧
        ├── key-new.ejs                # キーペア新規登録
        ├── key-detail.ejs             # キーペア詳細
        ├── key-import.ejs             # キーペアインポート
        ├── key-certificate.ejs        # 証明書発行
        ├── add-parent-cert.ejs        # 上位証明書追加
        └── wallet-provider-ca.ejs     # Wallet Provider CA管理
```

---

## 参考

- [Learning Credential 移行ガイド](/Users/ryousuke/repositories/ownd/ipa2025/OWND-Project-VP/docs/archive/learning-credential-migration.md)
- [employee-vci](./employee-vci.md)
- EUDI-Wallet-NiScy_JP EU pilot_v0.10.docx

---

## キーペア管理機能

### 概要

管理画面から Issuer キーペア（署名鍵）を管理し、クレデンシャル発行時に署名鍵を選択できる。

### 管理画面

| パス                               | 画面           | 説明                                     |
| ---------------------------------- | -------------- | ---------------------------------------- |
| `/admin/keys`                      | 鍵一覧         | 登録済み鍵ペアの一覧表示                 |
| `/admin/keys/new`                  | 鍵新規登録     | EC 鍵ペアの生成（P-256/secp256k1）       |
| `/admin/keys/import`               | 鍵インポート   | PEM 形式の秘密鍵+証明書のインポート      |
| `/admin/keys/:kid`                 | 鍵詳細         | 鍵情報、証明書チェーン、説明の表示・編集 |
| `/admin/keys/:kid/certificate`     | 証明書発行     | 自己署名証明書またはリーフ証明書の発行   |
| `/admin/keys/:kid/add-parent-cert` | 上位証明書追加 | 証明書チェーンへの上位証明書追加         |

### 証明書チェーン表示

キーペア詳細画面では、証明書チェーンを階層的に表示する。

| 位置 | ラベル       | 説明                       |
| ---- | ------------ | -------------------------- |
| 先頭 | End Entity   | 対象キーの証明書           |
| 中間 | Intermediate | 中間証明書（存在する場合） |
| 末尾 | Root         | ルート証明書               |

上位証明書は**リーフ証明書として発行した場合**のみ表示される。自己署名証明書の場合は単一証明書のみ。

### 上位証明書の追加機能

外部からインポートしたリーフ証明書に対して、後から上位証明書（中間証明書・ルート証明書）を追加できる。

**画面**: `/admin/keys/:kid/add-parent-cert`

**入力**: 上位証明書の PEM 形式テキスト（複数証明書対応、中間証明書 → ルート証明書の順で入力）

**処理**:

1. 既存の証明書チェーンを取得
2. 入力された上位証明書をパース
3. 既存チェーン + 新規上位証明書でチェーンを更新

使用関数: `appendCertificateChain` (keys.ts)

### 署名鍵選択機能

クレデンシャル発行時に、使用する署名鍵を選択できる。

**選択画面**: `/admin/learners/:id/offer`（Credential Offer 生成画面）

**署名鍵の決定ロジック**:

1. 証明書がある鍵 → `x5c`方式（証明書チェーンをヘッダーに含む）
2. 証明書がない鍵 → `jwk`方式（公開鍵をヘッダーに含む）

**データフロー**:

```
Offer生成 → auth_code + auth_code_metadata(signingKeyKid)
         → Access Token発行
         → Credential発行（signingKeyKidを参照）
```

### 既知の制約

VCI プロトコルのアーキテクチャ上、credential 発行関数は`sub`（学習者 ID）のみを受け取る。そのため、同一学習者に対して複数のオファーが並行して存在する場合、最新のオファーの署名鍵が使用される。

**暫定対応**: `getLatestSigningKeyKidForLearner(learnerId)` 関数で最新の署名鍵を取得。

---

## クライアント認証（Wallet Attestation）

### 概要

Credential Offer 生成時に「クライアント認証を要求する」を有効にすると、Token Endpoint 呼び出し時に Wallet Attestation によるクライアント認証が要求される。

### 使用方法

1. 管理画面の「Credential Offer 生成」画面 (`/admin/learners/:id/offer`) で「クライアント認証を要求する（Wallet Attestation）」チェックボックスをオンにする

2. Credential Offer を生成

3. Wallet が Token Endpoint にアクセスする際、以下の HTTP ヘッダーを送信する必要がある：
   - `OAuth-Client-Attestation`: Wallet Provider が発行した Client Attestation JWT
   - `OAuth-Client-Attestation-PoP`: Wallet が署名した PoP JWT

### 認証フロー

```
Wallet → Token Endpoint
    [OAuth-Client-Attestation: <JWT>]
    [OAuth-Client-Attestation-PoP: <PoP JWT>]

    → 1. Client Attestation JWT検証（x5c署名）
    → 2. PoP JWT検証（cnf.jwk署名）
    → 3. Access Token発行
```

### 詳細ドキュメント

- [クライアント認証モジュール](../modules/oid4vci/client-authentication.md)
- [Token Endpoint API 仕様](../api/token-endpoint.md)

---

## Wallet Provider CA 管理

### 概要

Wallet Attestation の x5c 証明書チェーンを、登録した信頼済み CA 証明書に対して検証する機能を提供する。

### 管理画面

**パス**: `/admin/wallet-provider-ca`

| 機能                   | 説明                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| 検証設定               | 証明書チェーン検証の有効/無効を切り替え                                    |
| CA 証明書一覧          | 登録済み CA 証明書の表示、有効/無効の切り替え、削除                        |
| CA 証明書インポート    | Wallet Provider の証明書を発行した CA のルート証明書を PEM 形式でインポート |

### 使用方法

1. **CA 証明書のインポート**
   - `/admin/wallet-provider-ca` にアクセス
   - 「CA 証明書をインポート」セクションで CA 名とルート証明書（PEM 形式）を入力
   - 「インポート」をクリック

2. **証明書チェーン検証の有効化**
   - 「検証設定」セクションで「証明書チェーン検証を有効にする」チェックボックスをオン
   - 「設定を保存」をクリック

3. **検証動作**
   - Wallet Attestation を使用するクレデンシャル発行時、x5c 証明書チェーンが登録済み CA 証明書に対して検証される
   - 検証に失敗した場合、`invalid_client` エラーが返される

### 検証フロー

```
Wallet → Token Endpoint
    [OAuth-Client-Attestation: <JWT with x5c header>]
    [OAuth-Client-Attestation-PoP: <PoP JWT>]

    → 1. Client Attestation JWT検証（x5c署名）
    → 2. x5c証明書チェーン検証（※チェーン検証有効時のみ）
         └─ x5c[0]（Wallet Provider証明書）を取得
         └─ 登録済みCA証明書に対してチェーン検証
    → 3. PoP JWT検証（cnf.jwk署名）
    → 4. Access Token発行
```

### 注意事項

- 証明書チェーン検証が無効の場合、x5c ヘッダーの署名検証のみ実行される（トラストアンカー検証はスキップ）
- 証明書チェーン検証を有効にする場合、少なくとも 1 つの有効な CA 証明書を登録する必要がある
- 無効化された CA 証明書は検証対象から除外される

---

## 発行状況表示機能

### 概要

クレデンシャル発行フローの進捗状況と、受信した JWT（DPoP、Wallet Attestation）を確認できる機能を提供する。

### 管理画面

**パス**: `/admin/auth-codes/:authCodeId/status`

**アクセス方法**: Credential Offer 表示画面（QRコード表示）から「発行状況を確認」ボタンをクリック

### 表示内容

| セクション       | 内容                                                              |
| ---------------- | ----------------------------------------------------------------- |
| 認可コード情報   | ID、学習者情報、作成日時、有効期限、クライアント認証/DPoP 要件    |
| 発行状況         | 発行要求なし / 期限切れ / Token発行済み / Credential発行完了      |
| Token Endpoint   | リクエスト受信・発行結果、受信した DPoP/Wallet Attestation JWT    |
| Credential Endpoint | リクエスト受信・発行結果、受信した DPoP JWT                    |

### JWT 表示

各 JWT について以下を表示:

- 検証結果（成功/失敗）
- 生データ
- デコードした Header（JSON）
- デコードした Payload（JSON）
- エラー内容（検証失敗時）

---

## マイグレーション

既存 DB を使用している場合、以下の SQL を実行する必要がある:

```sql
-- 証明書の説明カラム追加
ALTER TABLE ec_key_x509_certificate ADD COLUMN description VARCHAR(255) DEFAULT NULL;

-- 署名鍵選択用メタデータテーブル追加
CREATE TABLE auth_code_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  authCodeId INTEGER UNIQUE,
  signingKeyKid VARCHAR(255),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (authCodeId) REFERENCES auth_codes(id)
);

-- クライアント認証要求フラグ追加
ALTER TABLE auth_codes ADD COLUMN requireClientAuth BOOLEAN DEFAULT FALSE;

-- 信頼するWallet Provider CA証明書テーブル追加
CREATE TABLE trusted_wallet_provider_cas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,
  rootCertPem TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wallet Attestation設定テーブル追加
CREATE TABLE wallet_attestation_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enableChainValidation BOOLEAN DEFAULT FALSE,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
