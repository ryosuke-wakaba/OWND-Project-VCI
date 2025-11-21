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

---

## Admin API

全デモで共通の鍵管理API。Basic認証が必要。

### 認証

```
Authorization: Basic base64(username:password)
```

環境変数 `BASIC_AUTH_USERNAME`, `BASIC_AUTH_PASSWORD` で設定。

### エンドポイント一覧

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/admin/keys/new` | 新規鍵ペア生成 |
| GET | `/admin/keys/:kid` | 鍵情報取得 |
| POST | `/admin/keys/:kid/revoke` | 鍵失効 |
| POST | `/admin/keys/:kid/csr` | CSR生成 |
| POST | `/admin/keys/:kid/signselfcert` | 自己署名証明書作成 |
| POST | `/admin/keys/:kid/registercert` | 証明書登録 |

---

### POST `/admin/keys/new`

新規鍵ペアを生成。

#### リクエスト

```json
{
  "kid": "key-1",
  "curve": "secp256k1"
}
```

| フィールド | 型 | 必須 | 説明 |
|------------|------|------|------|
| kid | string | ○ | 鍵識別子 |
| curve | string | - | 楕円曲線（デフォルト: P-256）<br>対応: P-256, secp256k1 |

#### レスポンス

**成功 (201)**
```json
{
  "status": "success",
  "message": "Data created successfully!"
}
```

---

### GET `/admin/keys/:kid`

鍵情報を取得。

#### パスパラメータ

| パラメータ | 説明 |
|------------|------|
| kid | 鍵識別子 |

#### レスポンス

**成功 (200)**
```json
{
  "status": "success",
  "payload": {
    "kid": "key-1",
    "kty": "EC",
    "crv": "secp256k1",
    "x": "...",
    "y": "...",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "revokedAt": null
  }
}
```

---

### POST `/admin/keys/:kid/revoke`

鍵を失効。

#### パスパラメータ

| パラメータ | 説明 |
|------------|------|
| kid | 鍵識別子 |

#### レスポンス

**成功 (200)**
```json
{
  "status": "success",
  "message": "Data revoked successfully!"
}
```

---

### POST `/admin/keys/:kid/csr`

CSR（Certificate Signing Request）を生成。

#### パスパラメータ

| パラメータ | 説明 |
|------------|------|
| kid | 鍵識別子 |

#### リクエスト

```json
{
  "subject": "/CN=example.com/O=Example Org"
}
```

#### レスポンス

**成功 (200)**
```json
{
  "status": "success",
  "payload": "-----BEGIN CERTIFICATE REQUEST-----\n..."
}
```

---

### POST `/admin/keys/:kid/signselfcert`

自己署名証明書を作成。

#### パスパラメータ

| パラメータ | 説明 |
|------------|------|
| kid | 鍵識別子 |

#### リクエスト

```json
{
  "csr": "-----BEGIN CERTIFICATE REQUEST-----\n..."
}
```

#### レスポンス

**成功 (200)**
```json
{
  "status": "success",
  "payload": "-----BEGIN CERTIFICATE-----\n..."
}
```

---

### POST `/admin/keys/:kid/registercert`

X.509証明書チェーンを登録。

#### パスパラメータ

| パラメータ | 説明 |
|------------|------|
| kid | 鍵識別子 |

#### リクエスト

```json
{
  "certificates": [
    "-----BEGIN CERTIFICATE-----\n...",
    "-----BEGIN CERTIFICATE-----\n..."
  ]
}
```

#### レスポンス

**成功 (200)**
```json
{
  "status": "success",
  "message": "certificate registration succeeded"
}
```

---

### エラーレスポンス

| ステータス | 説明 |
|------------|------|
| 400 | 不正なリクエスト |
| 401 | 認証エラー |
| 404 | 鍵が見つからない |
| 500 | サーバーエラー |

```json
{
  "status": "error",
  "message": "エラー内容"
}
```
