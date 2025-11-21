# Credential Endpoint

## 概要
Access Tokenを検証し、Credentialを発行する。

## エンドポイント
`POST /credential`

## リクエスト

```json
{
  "format": "vc+sd-jwt",
  "credential_configuration_id": "EmployeeCredential",
  "proof": {
    "proof_type": "jwt",
    "jwt": "eyJ..."
  }
}
```

## レスポンス

```json
{
  "credential": "eyJ...~...",
  "transaction_id": "...",
  "notification_id": "..."
}
```

※ credential / transaction_id は排他（どちらか一方が返る）

## 認証
`Authorization: Bearer <access_token>`

## 実装クラス
- `CredentialIssuer` - `src/oid4vci/credentialEndpoint/CredentialIssuer.ts`
- `authenticate` - `src/oid4vci/credentialEndpoint/authenticate.ts`
- `validateProof` - `src/oid4vci/credentialEndpoint/validateProof.ts`
