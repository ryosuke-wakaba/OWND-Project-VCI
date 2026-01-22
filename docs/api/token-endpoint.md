# Token Endpoint

## 概要

Pre-authorized code を検証し、Access Token を発行する。

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

※ c_nonce は Nonce Endpoint から取得する

---

## クライアント認証（Wallet Attestation）

### 概要

Credential Offer で「クライアント認証を要求する」が有効な場合、Token Endpoint は Wallet Attestation によるクライアント認証を検証する。

### 関連仕様

- [OAuth 2.0 Attestation-Based Client Authentication](https://drafts.oauth.net/draft-ietf-oauth-attestation-based-client-auth/draft-ietf-oauth-attestation-based-client-auth.html)
- [OID4VCI Appendix E - Wallet Attestations](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-E)
- [HAIP 4.4.1 - Wallet Attestation](https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0-05.html#name-wallet-attestation)

### HTTP ヘッダー

クライアント認証が必要な場合、以下の 2 つの HTTP ヘッダーを送信する必要がある。

| ヘッダー名                     | 説明                                             |
| ------------------------------ | ------------------------------------------------ |
| `OAuth-Client-Attestation`     | Client Attestation JWT（Wallet Provider が発行） |
| `OAuth-Client-Attestation-PoP` | Client Attestation PoP JWT（Wallet が署名）      |

### リクエスト例（クライアント認証あり）

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded
OAuth-Client-Attestation: eyJ0eXAiOiJvYXV0aC1jbGllbnQtYXR0ZXN0YXRpb24rand0Ii...
OAuth-Client-Attestation-PoP: eyJ0eXAiOiJvYXV0aC1jbGllbnQtYXR0ZXN0YXRpb24tcG9wK2p3dCIs...

grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code
&pre-authorized_code=xxx
&tx_code=1234
```

### Client Attestation JWT

Wallet Provider が発行する JWT。HAIP 仕様に基づき、署名検証用の公開鍵は`x5c`ヘッダーに含まれる。

**ヘッダー:**

```json
{
  "typ": "oauth-client-attestation+jwt",
  "alg": "ES256",
  "x5c": ["MIIB..."]
}
```

**ペイロード:**

```json
{
  "iss": "https://wallet-provider.example.com",
  "sub": "wallet-client-id",
  "exp": 1704067200,
  "cnf": {
    "jwk": { ... }
  },
  "wallet_name": "Example Wallet",
  "wallet_link": "https://wallet.example.com"
}
```

### Client Attestation PoP JWT

Wallet が`cnf.jwk`の秘密鍵で署名する JWT。

**ヘッダー:**

```json
{
  "typ": "oauth-client-attestation-pop+jwt",
  "alg": "ES256"
}
```

**ペイロード:**

```json
{
  "iss": "wallet-client-id",
  "aud": "https://credential-issuer.example.com",
  "jti": "unique-id-12345",
  "iat": 1704067200
}
```

### エラーレスポンス

クライアント認証に失敗した場合、以下のエラーが返される。

| HTTP ステータス | エラーコード     | 説明                                  |
| --------------- | ---------------- | ------------------------------------- |
| 401             | `invalid_client` | クライアント認証必須だがヘッダーなし  |
| 401             | `invalid_client` | Attestation JWT に x5c ヘッダーがない |
| 401             | `invalid_client` | Attestation JWT 署名検証失敗          |
| 401             | `invalid_client` | Attestation 期限切れ                  |
| 401             | `invalid_client` | PoP JWT 署名検証失敗                  |
| 401             | `invalid_client` | PoP JWT の iss/aud 不一致             |

---

## 実装クラス

`TokenIssuer` - `src/oid4vci/tokenEndpoint/TokenIssuer.ts`
