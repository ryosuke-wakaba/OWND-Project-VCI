# common

デモアプリケーション共通モジュール。

## 機能
- 共通ストア実装（SQLite）
- 鍵管理（keyStore）
- 管理APIルート

## 主要ファイル
- [`src/store.ts`](../../demos/common/src/store.ts) - SQLiteベースのストア
- [`src/store/keyStore.ts`](../../demos/common/src/store/keyStore.ts) - 署名鍵管理
- [`src/store/authStore.ts`](../../demos/common/src/store/authStore.ts) - 認可・認証データ管理
- [`src/routes/admin/`](../../demos/common/src/routes/admin/) - 管理API共通実装
- [`src/routes/common.ts`](../../demos/common/src/routes/common.ts) - 共通ルーティング

---

## データモデル

### ER図

```
┌─────────────────────┐
│    ec_key_pairs     │
├─────────────────────┤
│ * kid (PK)          │
│   kty               │
│   crv               │
│   x                 │
│   y                 │
│   d                 │
│   createdAt         │
│   revokedAt         │
└──────────┬──────────┘
           │ 1
           │
           │ 0..*
┌──────────▼──────────┐
│ec_key_x509_certificate│
├─────────────────────┤
│   kid (FK)          │
│   x509cert          │
│   createdAt         │
└─────────────────────┘
```

### テーブル定義

#### ec_key_pairs
署名用EC鍵ペアを格納。

| カラム | 型 | 説明 |
|--------|------|------|
| kid | VARCHAR(80) | 鍵識別子（UNIQUE） |
| kty | VARCHAR(40) | 鍵タイプ（例: EC） |
| crv | VARCHAR(40) | 楕円曲線（例: P-256） |
| x | VARCHAR(1024) | 公開鍵X座標 |
| y | VARCHAR(1024) | 公開鍵Y座標 |
| d | VARCHAR(1024) | 秘密鍵 |
| createdAt | DATETIME | 作成日時 |
| revokedAt | DATETIME | 失効日時（NULL=有効） |

#### ec_key_x509_certificate
鍵に紐づくX.509証明書チェーン。

| カラム | 型 | 説明 |
|--------|------|------|
| kid | VARCHAR(80) | 鍵識別子（FK → ec_key_pairs） |
| x509cert | VARCHAR(8192) | 証明書チェーン（JSON配列） |
| createdAt | DATETIME | 作成日時 |

### 主要操作

| 関数 | 説明 |
|------|------|
| `insertECKeyPair` | 鍵ペアを登録 |
| `getEcKeyPair` | kidで鍵ペアを取得 |
| `getLatestKeyPair` | 最新の有効な鍵ペア（+証明書）を取得 |
| `revokeECKeyPair` | 鍵ペアを失効 |
| `insertEcKeyX509Certificate` | X.509証明書を登録 |
| `getX509Chain` | 証明書チェーンを取得 |

---

### 認可・認証データ（authStore）

#### ER図

```
┌─────────────────────┐
│     auth_codes      │
├─────────────────────┤
│ * id (PK)           │
│   code              │
│   expiresIn         │
│   preAuthFlow       │
│   txCode            │
│   needsProof        │
│   sub               │
│   createdAt         │
│   usedAt            │
└──────────┬──────────┘
           │ 1
           │
           │ 0..1
┌──────────▼──────────┐
│   access_tokens     │
├─────────────────────┤
│ * id (PK)           │
│   token (UNIQUE)    │
│   expiresIn         │
│   authorized_code_id│
│   createdAt         │
└─────────────────────┘

┌─────────────────────┐
│      c_nonces       │
├─────────────────────┤
│ * id (PK)           │
│   nonce             │
│   expired_in        │
│   createdAt         │
└─────────────────────┘
```

#### テーブル定義

##### auth_codes
認可コード（Pre-authorized code）を格納。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| code | VARCHAR(32) | 認可コード |
| expiresIn | INTEGER | 有効期限（秒） |
| preAuthFlow | BOOLEAN | Pre-authorized flowか |
| txCode | VARCHAR(8) | Transaction Code（PIN） |
| needsProof | BOOLEAN | Proof必須か |
| sub | VARCHAR(255) | Subject識別子 |
| createdAt | DATETIME | 作成日時 |
| usedAt | DATETIME | 使用日時（NULL=未使用） |

##### access_tokens
Access Tokenを格納。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| token | VARCHAR(2048) | Access Token（UNIQUE） |
| expiresIn | INTEGER | 有効期限（秒） |
| authorized_code_id | INTEGER | FK → auth_codes.id |
| createdAt | DATETIME | 作成日時 |

##### c_nonces
c_nonce（Client Nonce）を格納。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| nonce | TEXT | c_nonce値 |
| expired_in | INTEGER | 有効期限（秒） |
| createdAt | DATETIME | 作成日時（Unix timestamp） |

#### 主要操作

| 関数 | 説明 |
|------|------|
| `addAuthCode` | 認可コードを登録 |
| `getAuthCode` | 認可コードを取得 |
| `updateAuthCode` | 認可コードを使用済みに更新 |
| `addAccessToken` | Access Tokenを登録 |
| `getAccessToken` | Access Token（+認可コード情報）を取得 |
| `addCNonce` | c_nonceを登録 |
| `getCNonce` | c_nonceを取得 |
| `refreshNonce` | 新しいc_nonceを発行 |
