# Token Endpoint

## 概要
Pre-authorized codeを検証し、Access Tokenを発行する。

## エンドポイント
`POST /token`

## リクエスト

```
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code
&pre-authorized_code=xxx
&tx_code=1234
```

## レスポンス

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

※ c_nonceはNonce Endpointから取得する

## 実装クラス
`TokenIssuer` - `src/oid4vci/tokenEndpoint/TokenIssuer.ts`
