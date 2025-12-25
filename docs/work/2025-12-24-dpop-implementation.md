# DPoP対応実装

## 概要

issuer側のOID4VCIエンドポイントにDPoP (Demonstrating Proof of Possession) 対応を追加する。

## 背景

- ウォレット側はDPoP対応済み
- issuer側もRFC9449に準拠したDPoP Proof検証を実装する必要がある
- 対象デモアプリ: `demos/learning-vci`

## 参照仕様

- [RFC9449 - OAuth 2.0 Demonstrating Proof of Possession (DPoP)](https://www.rfc-editor.org/rfc/rfc9449.html)
- [OID4VCI](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
- [HAIP](https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0-04.html)

---

## 進捗状況

### Phase 1: DPoP Proof検証モジュール（汎用ライブラリ）

- [x] `src/oid4vci/dpop/types.ts` - 型定義
- [x] `src/oid4vci/dpop/utils.ts` - ユーティリティ（JWK thumbprint等）
- [x] `src/oid4vci/dpop/validateDpopProof.ts` - DPoP Proof検証ロジック
- [x] `src/oid4vci/dpop/index.ts` - エクスポート

### Phase 2: Token Endpoint対応

- [x] `src/oid4vci/tokenEndpoint/TokenIssuer.ts` - DPoP Proof検証の統合
- [x] `src/oid4vci/tokenEndpoint/types.ts` - TokenIssuerConfig, AccessTokenIssuer型拡張
- [x] `src/oid4vci/types/types.ts` - VCIAccessToken型にdpopJkt追加
- [x] `src/types.ts` - ErrorResponse型にheaders追加

**Note**: OID4VCIではToken Endpointはdpop_nonceを発行しません。nonceはNonce EndpointからDPoP-Nonceヘッダーで発行されます。

### Phase 3: Credential Endpoint対応

- [x] `src/oid4vci/credentialEndpoint/types.ts` - CredentialDpopConfig, ValidAccessTokenState拡張
- [x] `src/oid4vci/credentialEndpoint/authenticate.ts` - DPoP認証対応（Bearer/DPoP両対応）
- [x] `src/oid4vci/credentialEndpoint/CredentialIssuer.ts` - DPoP検証統合
- [x] `src/oid4vci/types/protocol.types.ts` - CredentialResponseに_headers追加

### Phase 4: デモアプリ対応

- [x] `demos/common/src/store/authStore.ts` - DBスキーマ拡張（dpopJktカラム追加）
- [x] `demos/common/src/oid4vci/credentialEndpoint/defaults/accessToken.ts` - dpopJkt返却
- [x] `demos/learning-vci/src/store.ts` - addAccessToken関数拡張
- [x] `demos/learning-vci/src/logic/vciConfigProvider.ts` - DPoP対応
- [x] `demos/learning-vci/src/logic/credentialsConfigProvider.ts` - DPoP対応
- [x] `demos/learning-vci/.env.sample` - DPoP環境変数追加

### Phase 5: テスト・検証

- [x] 単体テスト作成
  - `tests/oid4vci/dpop/utils.test.ts` - ユーティリティ関数テスト
  - `tests/oid4vci/dpop/validateDpopProof.test.ts` - DPoP Proof検証テスト
  - `tests/oid4vci/tokenEndpoint/TokenIssuer.dpop.test.ts` - Token Endpoint DPoPテスト
  - `tests/oid4vci/credentialEndpoint/authenticate.dpop.test.ts` - Credential Endpoint DPoPテスト
- [x] ウォレットとの結合テスト

### Phase 6: DPoP Nonce対応

- [x] `src/oid4vci/dpop/types.ts` - nonceValidator, nonceRequiredオプション追加
- [x] `src/oid4vci/dpop/validateDpopProof.ts` - 動的nonce検証対応
- [x] `src/oid4vci/nonceEndpoint/types.ts` - dpopNonceProvider, NonceIssueResponse追加
- [x] `src/oid4vci/nonceEndpoint/NonceIssuer.ts` - DPoP-Nonceヘッダー生成
- [x] `demos/common/src/routes/vci/routesHandler.ts` - DPoP-Nonceヘッダー設定
- [x] `demos/common/src/store/authStore.ts` - generateDpopNonce, validateDpopNonce関数追加
- [x] `demos/learning-vci/src/logic/nonceConfigProvider.ts` - dpopNonceProvider設定
- [x] `demos/learning-vci/src/logic/credentialsConfigProvider.ts` - Credential Endpoint nonce設定

### Phase 8: Token Endpoint dpop_nonceクリーンアップ

- [x] `src/oid4vci/tokenEndpoint/TokenIssuer.ts` - dpop_nonce発行ロジック削除
- [x] `src/oid4vci/tokenEndpoint/types.ts` - DpopConfigからnonceProvider/nonceValidator削除
- [x] `src/oid4vci/types/protocol.types.ts` - TokenResponseからdpop_nonce削除
- [x] `demos/learning-vci/src/logic/vciConfigProvider.ts` - Token Endpointのnonce設定削除

**理由**: OID4VCIではToken Endpointはnonceを発行しない。nonceはNonce Endpointのみが発行する。

### Phase 7: 検証ログ強化

- [x] `src/oid4vci/dpop/validateDpopProof.ts` - DPoP検証ログ追加
- [x] `src/oid4vci/credentialEndpoint/validateProof.ts` - c_nonce検証ログ追加

---

## 詳細設計

### 1. DPoP Proof検証モジュール

#### ファイル構成

```
src/oid4vci/dpop/
├── index.ts
├── types.ts
├── utils.ts
└── validateDpopProof.ts
```

#### 型定義 (types.ts)

```typescript
// DPoP Proof JWTのヘッダー
export interface DpopProofHeader {
  typ: "dpop+jwt";
  alg: string;
  jwk: JsonWebKey;
}

// DPoP Proof JWTのペイロード
export interface DpopProofPayload {
  jti: string;      // Unique identifier
  htm: string;      // HTTP method
  htu: string;      // HTTP URI
  iat: number;      // Issued at
  ath?: string;     // Access token hash (for protected resources)
  nonce?: string;   // Server-provided nonce
}

// 検証オプション
export interface DpopValidationOptions {
  httpMethod: string;
  httpUri: string;
  accessToken?: string;           // Credential Endpoint用
  expectedThumbprint?: string;    // Token binding検証用
  serverNonce?: string;           // サーバー提供nonce（静的チェック）
  nonceValidator?: (nonce: string) => Promise<boolean>;  // 動的nonce検証
  nonceRequired?: boolean;        // nonce必須フラグ（デフォルト: true）
  allowedAlgorithms?: string[];   // 許可アルゴリズム
  iatToleranceSeconds?: number;   // iat許容範囲（デフォルト: 300秒）
}

// 検証結果
export interface DpopValidationResult {
  valid: boolean;
  thumbprint?: string;   // JWK thumbprint (jkt)
  error?: string;
}
```

#### 検証ロジック (validateDpopProof.ts)

RFC9449 Section 4.3に準拠した12項目の検証:

| # | 検証項目 | 実装 |
|---|---------|------|
| 1 | DPoPヘッダーが1つだけ | ヘッダー数チェック |
| 2 | 適格なJWT形式 | jose.decodeProtectedHeader |
| 3 | 必須クレーム存在 | jti, htm, htu, iat |
| 4 | typ = dpop+jwt | ヘッダー検証 |
| 5 | alg = 非対称署名 | ES256, ES384, ES512, RS256等 |
| 6 | 署名検証 | jose.jwtVerify with jwk |
| 7 | jwkに秘密鍵なし | d パラメータ不在確認 |
| 8 | htm = HTTPメソッド | 大文字比較 |
| 9 | htu = HTTP URI | スキーム+ホスト+パス比較 |
| 10 | nonce一致 | サーバー提供時のみ |
| 11 | iat許容範囲内 | 現在時刻 ± tolerance |
| 12 | ath + 公開鍵一致 | Credential Endpoint用 |

#### ユーティリティ (utils.ts)

```typescript
// JWK Thumbprint計算 (RFC7638)
export async function calculateJwkThumbprint(jwk: JsonWebKey): Promise<string>;

// Access Token Hash計算 (SHA-256, base64url)
export function calculateAccessTokenHash(accessToken: string): string;

// HTTP URI正規化（クエリ・フラグメント除去）
export function normalizeHttpUri(uri: string): string;

// 許可アルゴリズムのデフォルト値
export const DEFAULT_ALLOWED_ALGORITHMS = [
  "ES256", "ES384", "ES512",  // ECDSA
  "PS256", "PS384", "PS512",  // RSASSA-PSS
];
```

### 2. Token Endpoint変更

#### TokenIssuerConfig拡張

```typescript
interface TokenIssuerConfig {
  authCodeStateProvider: AuthCodeStateProvider;
  accessTokenIssuer: AccessTokenIssuer;

  // DPoP対応（新規）
  dpop?: {
    enabled: boolean;
    required?: boolean;              // DPoP必須かどうか
    allowedAlgorithms?: string[];
    iatToleranceSeconds?: number;
    // Note: OID4VCIではToken Endpointはnonceを発行しない
    // nonceはNonce EndpointからDPoP-Nonceヘッダーで発行される
  };
  tokenEndpointUrl?: string;  // DPoP htu検証用
}
```

#### TokenResponse拡張

```typescript
interface TokenResponse {
  access_token: string;
  token_type: "Bearer" | "DPoP";  // DPoP対応
  expires_in: number;
  // Note: OID4VCIではToken Endpointからdpop_nonceを発行しない
  // DPoP nonceはNonce EndpointからDPoP-Nonceヘッダーで発行される
}
```

#### 処理フロー

```
1. DPoPヘッダー存在確認
2. DPoP Proof検証（validateDpopProof）
3. JWK Thumbprint計算
4. Access Token発行（thumbprintを紐付け）
5. token_type: "DPoP" でレスポンス
```

### 3. Credential Endpoint変更

#### authenticate.ts変更

```typescript
export const authenticate = async <T>(
  authHeader: string,
  dpopHeader: string | undefined,
  httpMethod: string,
  httpUri: string,
  accessTokenStateProvider: AccessTokenStateProvider<T>,
): Promise<Result<ValidAccessTokenState<T>, ErrorPayload>> => {
  // 1. token_type判定（Bearer or DPoP）
  const isDpop = RegExp("^DPoP ", "i").test(authHeader);

  if (isDpop) {
    // 2. DPoP Proof検証
    const dpopResult = await validateDpopProof(dpopHeader, {
      httpMethod,
      httpUri,
      accessToken: token,
      expectedThumbprint: storedThumbprint,
    });

    if (!dpopResult.valid) {
      return { ok: false, error: { error: INVALID_DPOP_PROOF } };
    }
  }

  // 3. Access Token状態確認（既存ロジック）
  ...
};
```

### 4. DBスキーマ変更

#### access_tokensテーブル拡張

```sql
ALTER TABLE access_tokens ADD COLUMN dpop_jkt VARCHAR(255) DEFAULT NULL;
```

| カラム | 型 | 説明 |
|--------|------|------|
| dpop_jkt | VARCHAR(255) | DPoP JWK Thumbprint（NULL = Bearer token） |

#### dpop_noncesテーブル（オプション）

```sql
CREATE TABLE dpop_nonces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nonce TEXT NOT NULL UNIQUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME NOT NULL
);
```

---

## マイグレーション

DBマイグレーションは**起動時に自動実行**されます。

`demos/common/src/store/authStore.ts`の`createDb()`関数で以下のマイグレーションが実行されます:

```typescript
const runMigrations = async () => {
  await store.addColumnIfNotExists(
    TBL_NM_ACCESS_TOKENS,
    "dpopJkt",
    "VARCHAR(255) DEFAULT NULL",
  );
};
```

手動実行が必要な場合:
```sql
ALTER TABLE access_tokens ADD COLUMN dpopJkt VARCHAR(255) DEFAULT NULL;
```

---

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `DPOP_ENABLED` | DPoPサポートを有効化 | `false` |
| `DPOP_REQUIRED` | DPoPを必須化 | `false` |

---

## エラーコード

| エラー | 説明 | HTTPステータス |
|--------|------|--------------|
| `invalid_dpop_proof` | DPoP Proof検証失敗 | 400 |
| `invalid_nonce` | DPoP nonce無効（Nonce Endpointから再取得が必要） | 400 |
| `invalid_token` | トークン無効（binding不一致含む） | 401 |

**Note**: OID4VCI仕様に従い、Credential EndpointはDPoP-Nonceヘッダーを返しません。クライアントはNonce Endpointから新しいnonceを取得する必要があります。

---

## DPoP Nonceフロー

### 概要

DPoP nonceはリプレイ攻撃を防ぐために使用されます。c_noncesテーブルを再利用して管理します。

**重要**: OID4VCIではToken Endpointはnonceを発行しません。DPoP nonceはNonce EndpointのDPoP-Nonceヘッダーでのみ発行されます。

### フロー

```
1. Token Endpoint
   - クライアントがDPoP proofを送信（nonce不要）
   - サーバーがaccess_tokenを返却（dpop_nonceは含めない）

2. Nonce Endpoint
   - クライアントがnonceを取得
   - サーバーが c_nonce（ボディ）と DPoP-Nonce（ヘッダー）を返却

3. Credential Endpoint
   - クライアントがDPoP proofに nonce クレームを含めて送信
   - サーバーが nonceValidator で検証
```

### 設定

```typescript
// Token Endpoint (vciConfigProvider.ts)
// ※ Token Endpointはnonceを発行しない
config.dpop = {
  enabled: true,
  required: process.env.DPOP_REQUIRED === "true",
};
config.tokenEndpointUrl = getTokenEndpointUrl();

// Credential Endpoint (credentialsConfigProvider.ts)
// ※ nonceの検証のみ行う（発行はNonce Endpointのみ）
config.dpop = {
  enabled: true,
  required: process.env.DPOP_REQUIRED === "true",
  credentialEndpointUrl: getCredentialEndpointUrl(),
  nonceValidator: async (nonce: string) => authStore.validateDpopNonce(nonce),
};

// Nonce Endpoint (nonceConfigProvider.ts)
// ※ DPoP-NonceはNonce Endpointのみが発行する
config.dpopNonceProvider = async () => authStore.generateDpopNonce();
```

---

## 動作確認ログ

### Token Endpoint (DPoP検証)

Token EndpointはDPoP Proof検証を行いますが、nonceは検証しません（OID4VCI仕様）。

```
[DPoP] ========== DPoP Proof Validation Started ==========
[DPoP] Expected HTTP Method: POST
[DPoP] Expected HTTP URI: https://example.com/token
[DPoP] Access Token provided: no
[DPoP] Expected Thumbprint: (none)
[DPoP] Server Nonce: (none)
[DPoP] Nonce Validator: (none)
[DPoP] Nonce Required: false (Token Endpoint)
[DPoP] [1] Checking DPoP header presence
[DPoP] ✓ DPoP header present
[DPoP] [2] Decoding JWT header
[DPoP] ✓ JWT header decoded: { typ: 'dpop+jwt', alg: 'ES256' }
[DPoP] [4] Checking typ claim
[DPoP] ✓ typ = dpop+jwt
[DPoP] [5] Checking algorithm
[DPoP] ✓ Algorithm allowed: ES256
[DPoP] [6/7] Checking JWK in header
[DPoP] ✓ JWK present and public key only
[DPoP] [6] Verifying JWT signature
[DPoP] ✓ JWT signature verified
[DPoP] [3] Checking required claims
[DPoP] ✓ Required claims present: { jti, htm, htu, iat }
[DPoP] [8] Checking htm (HTTP method)
[DPoP] ✓ htm matches: POST
[DPoP] [9] Checking htu (HTTP URI)
[DPoP] ✓ htu matches
[DPoP] [10] Checking nonce
[DPoP] ✓ No server nonce required
[DPoP] [11] Checking iat (issued at)
[DPoP] ✓ iat within tolerance
[DPoP] Calculating JWK Thumbprint
[DPoP] ✓ JWK Thumbprint (jkt): <thumbprint>
[DPoP] [12] No access token provided (Token Endpoint mode)
[DPoP] ========== ✅ DPoP Proof Validation Success ==========
```

### Nonce Endpoint (c_nonce + DPoP-Nonce発行)

```
=== Nonce Request Started ===
✅ Nonce Issued Successfully
C_nonce: <c_nonce_value>
C_nonce expires in: 86400 seconds
Setting header DPoP-Nonce: <dpop_nonce_value>
=== Nonce Request Completed ===
```

### Credential Endpoint (DPoP検証)

```
[DPoP] ========== DPoP Proof Validation Started ==========
[DPoP] Expected HTTP Method: POST
[DPoP] Expected HTTP URI: https://example.com/credentials
[DPoP] Access Token provided: yes
[DPoP] Expected Thumbprint: <thumbprint>
[DPoP] Server Nonce: (none)
[DPoP] Nonce Validator: configured
[DPoP] Nonce Required: true
[DPoP] [1] Checking DPoP header presence
[DPoP] ✓ DPoP header present
...
[DPoP] [10] Checking nonce
[DPoP] Nonce validation required (dynamic)
[DPoP] Proof nonce: <dpop_nonce_value>
[DPoP] ✓ Nonce validated successfully
...
[DPoP] [12] Checking access token binding (ath)
[DPoP] ath in proof: <ath_value>
[DPoP] Expected ath (hash of access token): <ath_value>
[DPoP] ✓ ath matches access token hash
[DPoP] [12b] Checking thumbprint binding
[DPoP] Proof thumbprint: <thumbprint>
[DPoP] Expected thumbprint (from token): <thumbprint>
[DPoP] ✓ Thumbprint matches token binding
[DPoP] ========== ✅ DPoP Proof Validation Success ==========
```

### Credential Endpoint (c_nonce検証)

```
[c_nonce] ========== c_nonce Validation Started ==========
[c_nonce] Proof nonce: <c_nonce_value>
[c_nonce] [1] Looking up nonce in database
[c_nonce] ✓ Nonce found in database
[c_nonce] [2] Checking nonce match
[c_nonce] Stored nonce: <c_nonce_value>
[c_nonce] ✓ Nonce matches
[c_nonce] [3] Checking nonce expiration
[c_nonce] Created at: <timestamp>
[c_nonce] Expires in (seconds): 86400
[c_nonce] ✓ Nonce not expired
[c_nonce] ========== ✅ c_nonce Validation Success ==========
```

---

## テストケース

### 1. DPoPユーティリティテスト (`tests/oid4vci/dpop/utils.test.ts`)

| テストグループ | テストケース | 検証内容 |
|--------------|-------------|---------|
| calculateJwkThumbprint | EC鍵のThumbprint計算 | Base64URL形式で出力されること |
| | 同一鍵で一貫したThumbprint | 同じ鍵で同じThumbprintが生成されること |
| | 異なる鍵で異なるThumbprint | 異なる鍵で異なるThumbprintが生成されること |
| calculateAccessTokenHash | アクセストークンのSHA-256ハッシュ | Base64URL形式で出力されること |
| | 同一トークンで一貫したハッシュ | 同じトークンで同じハッシュが生成されること |
| | 異なるトークンで異なるハッシュ | 異なるトークンで異なるハッシュが生成されること |
| normalizeHttpUri | クエリ文字列の削除 | `?query=value`が削除されること |
| | フラグメントの削除 | `#fragment`が削除されること |
| | スキーム・ホスト・パスの保持 | ポート番号含めて保持されること |
| compareHttpUri | 一致するURI | trueを返すこと |
| | クエリのみ異なる場合 | trueを返すこと（クエリは無視） |
| | パスが異なる場合 | falseを返すこと |
| | ホストが異なる場合 | falseを返すこと |
| hasPrivateKey | 秘密鍵を含むJWK | trueを返すこと |
| | 公開鍵のみのJWK | falseを返すこと |
| isAllowedAlgorithm | 許可アルゴリズム（ES256等） | trueを返すこと |
| | noneアルゴリズム | falseを返すこと |
| | 対称アルゴリズム（HS256等） | falseを返すこと |
| isIatWithinTolerance | 現在時刻 | trueを返すこと |
| | 許容範囲内の時刻 | trueを返すこと |
| | 許容範囲外の時刻 | falseを返すこと |

### 2. DPoP Proof検証テスト (`tests/oid4vci/dpop/validateDpopProof.test.ts`)

| テストグループ | テストケース | 検証内容 |
|--------------|-------------|---------|
| hasDpopHeader | 非空文字列 | trueを返すこと |
| | 空文字列 | falseを返すこと |
| | undefined | falseを返すこと |
| | 要素1つの配列 | trueを返すこと |
| | 空配列 | falseを返すこと |
| Basic validation | DPoPヘッダー未指定 | `invalid_dpop_proof`エラー |
| | 複数DPoPヘッダー | `invalid_dpop_proof`エラー |
| | 無効なJWT形式 | `invalid_dpop_proof`エラー |
| Header validation | typ ≠ dpop+jwt | `invalid_dpop_proof`エラー |
| | alg = none | `invalid_dpop_proof`エラー |
| | jwk未指定 | `invalid_dpop_proof`エラー |
| | jwkに秘密鍵含む | `invalid_dpop_proof`エラー |
| Payload validation | htm不一致 | `invalid_dpop_proof`エラー（htm mismatch） |
| | htu不一致 | `invalid_dpop_proof`エラー（htu mismatch） |
| | クエリ文字列を無視してhtu一致 | 検証成功 |
| | iat許容範囲外 | `invalid_dpop_proof`エラー |
| Nonce validation | サーバーnonce必須だが未指定 | `use_dpop_nonce`エラー |
| | nonce不一致 | `use_dpop_nonce`エラー |
| | nonce一致 | 検証成功 |
| Access token binding | ath未指定（accessToken指定時） | `invalid_dpop_proof`エラー（Missing ath） |
| | ath不一致 | `invalid_dpop_proof`エラー |
| | ath一致 | 検証成功 |
| Thumbprint binding | Thumbprint不一致 | `invalid_dpop_proof`エラー |
| Success case | 有効なProof | thumbprint, header, payload返却 |
| | secp256k1鍵使用 | ES256Kで検証成功 |

### 3. Token Endpoint DPoPテスト (`tests/oid4vci/tokenEndpoint/TokenIssuer.dpop.test.ts`)

| テストグループ | テストケース | 検証内容 |
|--------------|-------------|---------|
| DPoP disabled | DPoP無効時はBearerトークン発行 | token_type = "Bearer" |
| | DPoP無効時はDPoP Proofを無視 | token_type = "Bearer"（Proofあっても） |
| DPoP enabled (optional) | DPoP Proof未指定時はBearer発行 | token_type = "Bearer" |
| | 有効なDPoP Proof時はDPoP発行 | token_type = "DPoP" |
| | 無効なDPoP Proof | 400 `invalid_dpop_proof` |
| | htu不一致 | 400 `invalid_dpop_proof`（htu mismatch） |
| DPoP required | DPoP必須だがProof未指定 | 400 `invalid_dpop_proof`（required） |
| | 有効なDPoP Proof | token_type = "DPoP" |
| Configuration error | tokenEndpointUrl未設定 | 500 `server_error` |

### 4. Credential Endpoint DPoP認証テスト (`tests/oid4vci/credentialEndpoint/authenticate.dpop.test.ts`)

| テストグループ | テストケース | 検証内容 |
|--------------|-------------|---------|
| DPoP disabled | Bearerトークン認証成功 | tokenState返却 |
| | DPoPトークン型は拒否 | `invalid_token`（Only Bearer supported） |
| DPoP enabled (optional) | Bearerトークン認証成功 | tokenState返却 |
| | 有効なDPoP Proof認証成功 | tokenState返却 |
| | DPoP-boundトークンをBearerで提示 | `invalid_token`（DPoP-bound token） |
| | DPoP-boundトークンでProof未指定 | `invalid_dpop_proof`（required） |
| | 無効な署名のProof | `invalid_dpop_proof` |
| | Thumbprint不一致 | `invalid_dpop_proof`（does not match） |
| | ath未指定 | `invalid_dpop_proof`（ath） |
| | ath不一致 | `invalid_dpop_proof`（ath） |
| DPoP required | DPoP必須だがBearerトークン使用 | `invalid_dpop_proof`（required） |
| | 有効なDPoP Proof | tokenState返却 |
| DPoP nonce | nonceProvider設定時 | dpopNonce返却 |

### テスト実行

```bash
# 全テスト実行
npm test

# DPoP関連テストのみ実行
npm test -- --grep "DPoP"
```

---

## 参考ドキュメント

- docs/demos/common.md - 共通モジュール仕様
- docs/demos/learning-vci.md - デモアプリ仕様
- docs/modules/oid4vci.md - OID4VCIモジュール仕様
