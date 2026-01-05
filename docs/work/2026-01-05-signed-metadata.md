# Signed Metadata 実装

## 概要

OID4VCI仕様のSigned Metadata（署名付きメタデータ）機能を実装する。

## 参照仕様

- [OID4VCI Section 12.2.3](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-12.2.3)

### JOSEヘッダー

| クレーム | 必須 | 説明 |
|----------|------|------|
| `alg` | 必須 | デジタル署名アルゴリズム識別子 |
| `typ` | 必須 | `openidvci-issuer-metadata+jwt` |

### JWSペイロード

| クレーム | 必須 | 説明 |
|----------|------|------|
| `iss` | オプション | 署名者を示す文字列 |
| `sub` | 必須 | Credential Issuer Identifierと一致 |
| `iat` | 必須 | 発行時刻 |
| `exp` | オプション | 有効期限 |
| その他 | - | メタデータの全パラメータをトップレベルクレームとして追加 |

---

## 進捗状況

### Phase 1: データモデル

- [x] `signed_metadata`テーブル作成
- [x] authStoreに操作関数追加

### Phase 2: 署名ロジック

- [x] `signMetadata`関数実装
- [x] JOSEヘッダー分岐（x5c/jwk）

### Phase 3: UI

- [x] `/admin/metadata` 画面作成
- [x] 管理画面トップにメニュー追加

### Phase 4: エンドポイント

- [x] メタデータエンドポイント更新
- [x] Content-Type対応

---

## 実装詳細

### データモデル

```sql
CREATE TABLE signed_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jwt TEXT NOT NULL,
  signingKeyKid VARCHAR(255),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  revokedAt DATETIME DEFAULT NULL
);
```

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー |
| jwt | TEXT | 署名付きメタデータJWT |
| signingKeyKid | VARCHAR(255) | 署名鍵のkid |
| createdAt | DATETIME | 作成日時 |
| revokedAt | DATETIME | 無効化日時（NULL=有効） |

### authStore操作関数

| 関数 | 説明 |
|------|------|
| `addSignedMetadata(jwt, kid)` | 署名付きメタデータを登録 |
| `getActiveSignedMetadata()` | 有効な最新の署名付きメタデータを取得 |
| `revokeSignedMetadata(id)` | 指定IDの署名付きメタデータを無効化 |
| `getAllSignedMetadata()` | 全署名付きメタデータを取得（履歴表示用） |
| `revokeAllSignedMetadata()` | 全署名付きメタデータを無効化 |

---

### 署名ロジック

**ファイル**: `demos/common/src/signedMetadata.ts`

```typescript
interface SignMetadataResult {
  jwt: string;
  payload: object;
}

async function signMetadata(
  metadata: IssuerMetadata,
  kid: string,
): Promise<Result<SignMetadataResult, ErrorPayload>>
```

**処理フロー**:

1. 鍵ペアを取得（`keyStore.getEcKeyPair(kid)`）
2. 証明書チェーンを取得（`keyStore.getX509Chain(kid)`）
3. JOSEヘッダー構築
   - 証明書あり: `x5c`にBase64エンコードした証明書チェーン
   - 証明書なし: `jwk`に公開鍵
4. JWSペイロード構築
   - `sub`: Credential Issuer Identifier
   - `iat`: 現在時刻
   - メタデータの全パラメータをスプレッド
5. 署名してJWTを生成
6. DBに保存（過去分を無効化）

---

### UI

**画面**: `/admin/metadata`

**レイアウト**:

```
┌─────────────────────────────────────────────────┐
│ メタデータ管理                                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ 現在のメタデータ                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ {                                           │ │
│ │   "credential_issuer": "...",               │ │
│ │   "credential_endpoint": "...",             │ │
│ │   ...                                       │ │
│ │ }                                           │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 署名                                            │
│ ┌─────────────────────────────────────────────┐ │
│ │ 署名鍵: [ドロップダウン選択]                   │ │
│ │                                             │ │
│ │ [署名を実行] ← 確認ダイアログ表示             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 署名履歴                                        │
│ ┌─────────────────────────────────────────────┐ │
│ │ ID | 署名鍵 | 作成日時 | 状態 | 操作          │ │
│ │ 3  | key-1  | 2025-... | 有効 | [無効化]     │ │
│ │ 2  | key-1  | 2025-... | 無効 | -            │ │
│ │ 1  | key-2  | 2025-... | 無効 | -            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

**ビューファイル**: `views/admin/metadata.ejs`

---

### エンドポイント変更

**ファイル**: `demos/common/src/routes/vci/routes.ts`

`/.well-known/openid-credential-issuer` の変更:

```typescript
// Before
ctx.body = await metadataRepository.getIssuerMetadata();

// After
const signedMetadata = await authStore.getActiveSignedMetadata();
if (signedMetadata) {
  ctx.type = 'application/jwt';
  ctx.body = signedMetadata.jwt;
} else {
  ctx.type = 'application/json';
  ctx.body = await metadataRepository.getIssuerMetadata();
}
```

---

## ファイル変更一覧

### demos/common

| ファイル | 変更内容 |
|----------|----------|
| `src/store/authStore.ts` | signed_metadataテーブル・操作関数追加 |
| `src/signedMetadata.ts` | 署名ロジック（新規） |
| `src/routes/vci/routes.ts` | メタデータエンドポイント変更 |

### demos/learning-vci

| ファイル | 変更内容 |
|----------|----------|
| `src/routes/admin/routes.ts` | メタデータ管理ルート追加 |
| `src/routes/admin/routesHandler.ts` | メタデータ管理ハンドラ追加 |
| `views/admin/index.ejs` | メニューにメタデータ管理追加 |
| `views/admin/metadata.ejs` | メタデータ管理画面（新規） |

---

## マイグレーション

既存DBを使用している場合:

```sql
CREATE TABLE signed_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jwt TEXT NOT NULL,
  signingKeyKid VARCHAR(255),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  revokedAt DATETIME DEFAULT NULL
);
```

---

## テスト項目

1. 署名鍵選択（証明書あり/なし）
2. メタデータ署名実行
3. 署名履歴表示
4. 署名無効化
5. エンドポイントレスポンス確認
   - 有効な署名あり → JWT返却
   - 署名なし → JSON返却
