# OID4VCI モジュール

## 概要
OID4VCIプロトコルのエンドポイント実装を提供する。本モジュールはライブラリとして設計されており、実装者が提供するコールバック関数を通じて永続化やビジネスロジックをカスタマイズできる。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    実装者のアプリケーション                      │
├─────────────────────────────────────────────────────────────┤
│  TokenIssuerConfig   │ CredentialIssuerConfig │ NonceConfig │
│  - authCodeProvider  │ - accessTokenProvider  │ - issuer    │
│  - tokenIssuer       │ - issuingExecutor      │             │
└──────────┬───────────┴──────────┬─────────────┴──────┬──────┘
           │                      │                    │
           ▼                      ▼                    ▼
┌──────────────────┐  ┌─────────────────────┐  ┌─────────────┐
│   TokenIssuer    │  │  CredentialIssuer   │  │ NonceIssuer │
│   (本ライブラリ)   │  │   (本ライブラリ)     │  │(本ライブラリ)│
└──────────────────┘  └─────────────────────┘  └─────────────┘
```

## コンポーネント詳細

### TokenIssuer

**ファイル**: [`src/oid4vci/tokenEndpoint/TokenIssuer.ts`](../../src/oid4vci/tokenEndpoint/TokenIssuer.ts)

Pre-authorized codeを検証し、Access Tokenを発行する。

#### 処理フロー
1. リクエストのバリデーション（`validate.ts`）
2. `AuthCodeStateProvider`で認可コードの状態を取得
3. `AccessTokenIssuer`でAccess Tokenを発行

#### Config型

```typescript
interface TokenIssuerConfig {
  // 認可コードの状態を取得するコールバック
  authCodeStateProvider: AuthCodeStateProvider;
  // Access Tokenを発行するコールバック
  accessTokenIssuer: AccessTokenIssuer;
}

// 認可コードの存在と状態を返す
type AuthCodeStateProvider = (
  authorizedCode: string,
) => Promise<NotExists | Exists<PayloadAtExists>>;

// Access Tokenを発行して返す
type AccessTokenIssuer = (
  authorizedCode: AuthorizedCodeWithStoredData,
) => Promise<Result<TokenResponse, ErrorPayload>>;
```

---

### CredentialIssuer

**ファイル**: [`src/oid4vci/credentialEndpoint/CredentialIssuer.ts`](../../src/oid4vci/credentialEndpoint/CredentialIssuer.ts)

Access Tokenを検証し、Credentialを発行する。

#### 処理フロー
1. `Authorization`ヘッダーからAccess Tokenを検証（`authenticate.ts`）
2. リクエストボディのバリデーション
3. `credential_configuration_id`からメタデータを解決
4. Proof（Key Binding）の検証（`validateProof.ts`）
   - JWT形式のProofをサポート
   - c_nonceの検証（`getCNonce`コールバック使用）
5. フォーマットに応じた発行処理を実行

#### サポートするCredentialフォーマット
| フォーマット | 状態 |
|-------------|------|
| `dc+sd-jwt` | サポート |
| `jwt_vc_json` | サポート |
| `ldp_vc` | 未サポート |
| `jwt_vc_json-ld` | 未サポート |

#### Config型

```typescript
interface CredentialIssuerConfig<T> {
  credentialIssuer: string;           // Issuer識別子URL
  issuerMetadata: IssuerMetadata;     // Issuerメタデータ
  supportAnonymousAccess?: boolean;   // 匿名アクセスのサポート

  // Access Tokenの状態を取得するコールバック
  accessTokenStateProvider: AccessTokenStateProvider<T>;

  // Credential発行を実行するコールバック
  issuingExecutor: {
    jwtVcJson?: IssueJwtVcJsonCredential;
    sdJwtVc?: IssueSdJwtVcCredential;
  };

  // c_nonceを検証するためのコールバック
  getCNonce?: (nonce: string) => Promise<{
    nonce: string;
    expired_in: number;
    createdAt: string;
  } | undefined>;
}
```

#### Proof検証（validateProof.ts）

JWT形式のProofを検証する。検証項目:
- `typ`: `openid4vci-proof+jwt`であること
- `jwk`: ヘッダーに公開鍵が含まれること
- `aud`: Credential Issuer URLと一致すること
- `iat`: 現在時刻から許容範囲内であること（5秒）
- `nonce`: c_nonceが有効かつ未期限であること

---

### NonceIssuer

**ファイル**: [`src/oid4vci/nonceEndpoint/NonceIssuer.ts`](../../src/oid4vci/nonceEndpoint/NonceIssuer.ts)

c_nonceを発行する。Credential Endpoint呼び出し前に必須。

#### Config型

```typescript
interface NonceIssuerConfig {
  // c_nonceを生成するコールバック
  nonceIssuer: NonceIssuer;
}

type NonceIssuer = () => Promise<Result<NonceResponse, ErrorPayload>>;
```

---

### CredentialOffer

**ファイル**: [`src/oid4vci/CredentialOffer.ts`](../../src/oid4vci/CredentialOffer.ts)

Credential Offer URLの生成・パースを行うユーティリティ。

#### 主要関数

```typescript
// Credential OfferオブジェクトをURLに変換
credentialOffer2Url(offer: CredentialOffer, endpoint?: string): string

// URLからCredential Offerオブジェクトを抽出
url2CredentialOffer(url: string): CredentialOffer

// Pre-Authorized Code Flow用のOffer URLを生成
generatePreAuthCredentialOffer(
  credentialIssuer: string,
  credentialConfigurationIds: string[],
  preAuthCode: string,
  txCode?: TxCode,
  endpoint?: string
): string
```

---

## 型定義

### protocol.types.ts
OID4VCI仕様に準拠したリクエスト/レスポンス型

- `CredentialOffer`: Credential Offer構造
- `TokenResponse`: Token Endpointレスポンス
- `NonceResponse`: Nonce Endpointレスポンス
- `CredentialResponse`: Credential Endpointレスポンス
- `IssuerMetadata*`: Issuerメタデータ（フォーマット別）

### validator.ts
Zodを使用したリクエストバリデーション

---

## エラーコード

| コード | 説明 |
|--------|------|
| `invalid_request` | リクエストの形式が不正 |
| `invalid_proof` | Proofが不正または欠落 |
| `invalid_nonce` | c_nonceが不正または期限切れ |
| `unsupported_credential_format` | 未サポートのCredentialフォーマット |
| `unknown_credential_configuration` | 不明なcredential_configuration_id |
