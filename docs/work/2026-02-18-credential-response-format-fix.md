# Credential Response フォーマット修正作業

## 作業概要

VCIの疎通テストにおいて、対向システムの担当者からCredential Responseのフォーマットが仕様と異なるという指摘を受けた。本作業では、OpenID4VCI v1.0仕様に準拠したレスポンスフォーマットに修正する。

## 指摘内容

### 現在の実装

```json
{"credential":"eyJ0eXAiOiJkYytzZC..." }
```

### 仕様に準拠した正しいフォーマット

```json
{ "credentials" : [ {"credential":"eyJ0eXAiOiJkYytzZC..."} ] }
```

## 仕様確認

OpenID4VCI v1.0 Section 8.3 Credential Response より:

- `credentials`: 発行されたクレデンシャルを1つ以上含む配列（OPTIONAL）
- 配列の各要素は以下のフィールドを持つオブジェクト:
  - `credential`: 発行されたクレデンシャル（REQUIRED）

参考: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html

## 修正対象ファイル

1. `src/oid4vci/types/protocol.types.ts` - `CredentialResponse`インターフェースの更新
2. `src/oid4vci/credentialEndpoint/CredentialIssuer.ts` - レスポンス生成部分の修正 (178-183行目)
3. `docs/api/credential-endpoint.md` - APIドキュメントの更新
4. `demos/common/src/routes/vci/routesHandler.ts` - ログ出力の修正
5. `demos/employee-vci/tests/vci.test.ts` - テストアサーションの修正
6. `demos/proxy-vci/tests/vci/routes.test.ts` - テストアサーションの修正
7. `demos/learning-vci/tests/vci.test.ts` - テストアサーションの修正

## 修正内容

### 1. 型定義の更新 (protocol.types.ts)

```typescript
// Before
export interface CredentialResponse {
  credential?: unknown;
  ...
}

// After
export interface CredentialResponseItem {
  credential: unknown;
}

export interface CredentialResponse {
  credentials?: CredentialResponseItem[];
  ...
}
```

### 2. レスポンス生成の修正 (CredentialIssuer.ts)

```typescript
// Before
return {
  ok: true,
  payload: {
    credential: issueResult.payload,
  },
};

// After
return {
  ok: true,
  payload: {
    credentials: [{ credential: issueResult.payload }],
  },
};
```

### 3. テストアサーションの修正

```typescript
// Before
assert.isString(response.body.credential);
const tmp = response.body.credential.split("~");

// After
assert.isArray(response.body.credentials);
assert.isString(response.body.credentials[0].credential);
const tmp = response.body.credentials[0].credential.split("~");
```

## 進捗

- [x] 仕様確認
- [x] 修正対象ファイル特定
- [x] 型定義の更新
- [x] CredentialIssuerの修正
- [x] routesHandlerの修正
- [x] ドキュメントの更新
- [x] テストの修正
- [x] テスト実行・確認（150件すべてパス）

## ブランチ

- `fix/credential-response-format` (派生元: `feature/metadata-haip-compliance`)

## 完了日

2026-02-18
