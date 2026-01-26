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
- [`src/keys.ts`](../../demos/common/src/keys.ts) - 鍵・証明書操作ロジック
- [`src/signedMetadata.ts`](../../demos/common/src/signedMetadata.ts) - 署名付きメタデータ生成
- [`src/routes/admin/`](../../demos/common/src/routes/admin/) - 管理API共通実装
- [`src/routes/common.ts`](../../demos/common/src/routes/common.ts) - 共通ルーティング

---

## データモデル

### 鍵管理（keyStore）

#### ER図

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
           │ 0..1
┌──────────▼──────────┐
│ec_key_x509_certificate│
├─────────────────────┤
│   kid (FK)          │
│   x509cert          │
│   description       │
│   createdAt         │
└─────────────────────┘

┌─────────────────────┐
│   signed_metadata   │
├─────────────────────┤
│ * id (PK)           │
│   jwt               │
│   signingKeyKid     │
│   createdAt         │
│   revokedAt         │
└─────────────────────┘
```

#### テーブル定義

##### ec_key_pairs
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

##### ec_key_x509_certificate
鍵に紐づくX.509証明書チェーン。

| カラム | 型 | 説明 |
|--------|------|------|
| kid | VARCHAR(80) | 鍵識別子（FK → ec_key_pairs） |
| x509cert | VARCHAR(8192) | 証明書チェーン（JSON配列） |
| description | VARCHAR(255) | 証明書の説明（NULL許可） |
| createdAt | DATETIME | 作成日時 |

##### signed_metadata
署名付きIssuerメタデータ（OID4VCI Section 12.2.3）。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| jwt | TEXT | 署名付きメタデータJWT |
| signingKeyKid | VARCHAR(255) | 署名に使用した鍵のkid |
| createdAt | DATETIME | 作成日時 |
| revokedAt | DATETIME | 失効日時（NULL=有効） |

#### 主要操作（keyStore）

| 関数 | 説明 |
|------|------|
| `insertECKeyPair` | 鍵ペアを登録 |
| `getEcKeyPair` | kidで鍵ペアを取得 |
| `getLatestKeyPair` | 最新の有効な鍵ペア（+証明書）を取得 |
| `getAllKeyPairs` | 全鍵ペア一覧を取得（証明書情報含む） |
| `revokeECKeyPair` | 鍵ペアを失効 |
| `insertEcKeyX509Certificate` | X.509証明書を登録（description対応） |
| `getX509Chain` | 証明書チェーンを取得 |
| `getX509CertificateData` | 証明書データと説明を取得 |
| `updateX509Certificate` | 証明書チェーンを更新 |
| `updateX509CertificateDescription` | 証明書の説明を更新 |

#### 主要操作（signedMetadata）

| 関数 | 説明 |
|------|------|
| `addSignedMetadata` | 署名付きメタデータを登録 |
| `getActiveSignedMetadata` | 有効な署名付きメタデータを取得 |
| `revokeSignedMetadata` | 指定IDの署名付きメタデータを失効 |
| `revokeAllSignedMetadata` | 全署名付きメタデータを失効 |
| `getAllSignedMetadata` | 全署名付きメタデータを取得 |

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
│   requireClientAuth │
│   requireDpop       │
│   createdAt         │
│   usedAt            │
└──────────┬──────────┘
           │ 1
           ├──────────────────┐
           │ 0..1             │ 0..1
┌──────────▼──────────┐  ┌────▼────────────────┐
│   access_tokens     │  │  auth_code_metadata │
├─────────────────────┤  ├─────────────────────┤
│ * id (PK)           │  │ * id (PK)           │
│   token (UNIQUE)    │  │   authCodeId (FK)   │
│   expiresIn         │  │   signingKeyKid     │
│   authorized_code_id│  │   createdAt         │
│   dpopJkt           │  └─────────────────────┘
│   createdAt         │
└─────────────────────┘

┌─────────────────────┐  ┌─────────────────────────────┐
│      c_nonces       │  │ trusted_wallet_provider_cas │
├─────────────────────┤  ├─────────────────────────────┤
│ * id (PK)           │  │ * id (PK)                   │
│   nonce             │  │   name                      │
│   expired_in        │  │   rootCertPem               │
│   createdAt         │  │   enabled                   │
└─────────────────────┘  │   createdAt                 │
                         │   updatedAt                 │
                         └─────────────────────────────┘

┌─────────────────────────────┐
│ wallet_attestation_settings │
├─────────────────────────────┤
│ * id (PK)                   │
│   enableChainValidation     │
│   updatedAt                 │
└─────────────────────────────┘
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
| requireClientAuth | BOOLEAN | Wallet Attestation必須か（デフォルト: FALSE） |
| requireDpop | BOOLEAN | DPoP必須か（デフォルト: FALSE） |
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
| dpopJkt | VARCHAR(255) | DPoP JWK Thumbprint（DPoPバインド時に設定） |
| createdAt | DATETIME | 作成日時 |

##### auth_code_metadata
認可コードに紐づくメタデータ（署名鍵の指定など）を格納。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| authCodeId | INTEGER | 認可コードID（FK → auth_codes.id, UNIQUE） |
| signingKeyKid | VARCHAR(255) | 署名鍵の識別子 |
| createdAt | DATETIME | 作成日時 |

##### c_nonces
c_nonce（Client Nonce）およびDPoP Nonceを格納。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| nonce | TEXT | nonce値（c_nonceまたはDPoP nonce） |
| expired_in | INTEGER | 有効期限（秒） |
| createdAt | DATETIME | 作成日時（Unix timestamp） |

##### trusted_wallet_provider_cas
Wallet Attestation検証用の信頼されたCA証明書を格納。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| name | VARCHAR(255) | CA名 |
| rootCertPem | TEXT | ルート証明書（PEM形式） |
| enabled | BOOLEAN | 有効か（デフォルト: TRUE） |
| createdAt | DATETIME | 作成日時 |
| updatedAt | DATETIME | 更新日時 |

##### wallet_attestation_settings
Wallet Attestation検証のグローバル設定を格納。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| enableChainValidation | BOOLEAN | 証明書チェーン検証を有効化（デフォルト: FALSE） |
| updatedAt | DATETIME | 更新日時 |

##### issuance_events
クレデンシャル発行フローのイベントを記録。

| カラム | 型 | 説明 |
|--------|------|------|
| id | INTEGER | 主キー（自動採番） |
| authCodeId | INTEGER | FK → auth_codes.id |
| eventType | VARCHAR(32) | イベント種別（token_request, token_issued, credential_request, credential_issued） |
| dpopJwt | TEXT | DPoP JWT（生データ） |
| dpopHeader | TEXT | DPoP JWT Header（JSON） |
| dpopPayload | TEXT | DPoP JWT Payload（JSON） |
| dpopValid | BOOLEAN | DPoP 検証結果 |
| dpopError | TEXT | DPoP 検証エラー |
| walletAttestationJwt | TEXT | Wallet Attestation JWT（生データ） |
| walletAttestationHeader | TEXT | Wallet Attestation JWT Header（JSON） |
| walletAttestationPayload | TEXT | Wallet Attestation JWT Payload（JSON） |
| walletAttestationValid | BOOLEAN | Wallet Attestation 検証結果 |
| walletAttestationError | TEXT | Wallet Attestation 検証エラー |
| walletAttestationPopJwt | TEXT | Wallet Attestation PoP JWT（生データ） |
| walletAttestationPopHeader | TEXT | Wallet Attestation PoP JWT Header（JSON） |
| walletAttestationPopPayload | TEXT | Wallet Attestation PoP JWT Payload（JSON） |
| walletAttestationPopValid | BOOLEAN | Wallet Attestation PoP 検証結果 |
| walletAttestationPopError | TEXT | Wallet Attestation PoP 検証エラー |
| createdAt | DATETIME | 作成日時 |

#### 主要操作（authStore）

##### 認可コード・アクセストークン

| 関数 | 説明 |
|------|------|
| `addAuthCode` | 認可コードを登録（requireClientAuth, requireDpop対応） |
| `getAuthCode` | 認可コードを取得 |
| `updateAuthCode` | 認可コードを使用済みに更新 |
| `addAccessToken` | Access Tokenを登録（dpopJkt対応） |
| `getAccessToken` | Access Token（+認可コード情報+dpopJkt）を取得 |
| `addCNonce` | c_nonceを登録 |
| `getCNonce` | c_nonceを取得 |
| `refreshNonce` | 新しいc_nonceを発行 |
| `addAuthCodeMetadata` | 認可コードメタデータ（署名鍵指定）を登録 |
| `getAuthCodeMetadata` | 認可コードIDでメタデータを取得 |
| `getAuthCodeMetadataByCode` | 認可コードでメタデータを取得 |

##### DPoP Nonce管理

| 関数 | 説明 |
|------|------|
| `generateDpopNonce` | 新しいDPoP nonceを生成・保存 |
| `validateDpopNonce` | DPoP nonceを検証（有効期限チェック） |

##### Wallet Provider CA管理

| 関数 | 説明 |
|------|------|
| `addTrustedWalletProviderCA` | 信頼されたCA証明書を登録 |
| `getAllTrustedWalletProviderCAs` | 全CA証明書を取得 |
| `getEnabledTrustedWalletProviderCAs` | 有効なCA証明書を取得 |
| `getTrustedWalletProviderCA` | IDでCA証明書を取得 |
| `updateTrustedWalletProviderCAEnabled` | CA証明書の有効/無効を更新 |
| `deleteTrustedWalletProviderCA` | CA証明書を削除 |

##### Wallet Attestation設定

| 関数 | 説明 |
|------|------|
| `getWalletAttestationSettings` | Wallet Attestation設定を取得 |
| `updateWalletAttestationSettings` | Wallet Attestation設定を更新 |

##### 発行イベント管理

| 関数 | 説明 |
|------|------|
| `addIssuanceEvent` | 発行イベントを記録 |
| `getIssuanceEventsByAuthCodeId` | 認可コードIDで発行イベントを取得 |
| `getAuthCodeById` | IDで認可コードを取得 |

---

## 鍵・証明書操作ロジック（keys.ts）

ビジネスロジックを提供する関数群。keyStoreをラップし、バリデーションや証明書操作を行う。

### 主要関数

| 関数 | 説明 |
|------|------|
| `genKey` | 新規EC鍵ペアを生成 |
| `getAllKeys` | 全鍵情報を取得（証明書有無、説明含む） |
| `getKey` | kidで公開鍵を取得 |
| `importKey` | PEM形式の秘密鍵+証明書をインポート |
| `revokeKey` | 鍵を失効 |
| `createCsr` | CSRを生成（CA用/通常用） |
| `createSelfCert` | 自己署名証明書を作成 |
| `signLeafCert` | リーフ証明書を発行（CA鍵で署名） |
| `registerCert` | 証明書チェーンを登録 |
| `appendCertificateChain` | 既存チェーンに上位証明書を追加 |
| `removeParentCertificates` | 上位証明書をすべて削除（リーフのみ残す） |
| `removeCertificateAtIndex` | 指定インデックス以降の証明書を削除 |

### 証明書チェーン操作

#### appendCertificateChain

既存の証明書チェーンに上位証明書（中間証明書・ルート証明書）を追加する。

```typescript
appendCertificateChain({
  kid: string,           // 鍵識別子
  certificates: string[] // 追加する上位証明書（Base64形式）
}): Promise<Result<{ chainLength: number }, NotSuccessResult>>
```

**ユースケース**: 外部からインポートしたリーフ証明書に、後から上位証明書を追加する場合。

#### removeParentCertificates

証明書チェーンからリーフ証明書以外を削除する。

```typescript
removeParentCertificates(kid: string): Promise<Result<{ chainLength: number }, NotSuccessResult>>
```

#### removeCertificateAtIndex

指定インデックス以降の証明書を削除する（インデックス0のリーフ証明書は削除不可）。

```typescript
removeCertificateAtIndex(
  kid: string,
  index: number  // 1以上
): Promise<Result<{ chainLength: number }, NotSuccessResult>>
```

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
