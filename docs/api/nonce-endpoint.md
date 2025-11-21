# Nonce Endpoint

## 概要
c_nonceを発行する。Credential Endpoint呼び出し前に必須。

## エンドポイント
`POST /nonce`

## リクエスト
ボディなし（Access Tokenで認証）

## レスポンス

```json
{
  "c_nonce": "tZignsnFbp"
}
```

※ `c_nonce_expires_in` は廃止（OID4VCI最新仕様）

## 認証
`Authorization: Bearer <access_token>`

## 実装クラス
`NonceIssuer` - `src/oid4vci/nonceEndpoint/NonceIssuer.ts`
