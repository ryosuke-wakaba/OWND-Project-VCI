# 作業依頼
## 機能追加
ウォレットアテステーションに対応します。
以下の要件と関連仕様を確認してください。

### 要件
### 管理画面
- 「クレデンシャル発行準備」画面に「クライアント認証を要求する」チェックボックスを追加

### クレデンシャル発行時
- クライアント認証が有効時、クレデンシャル発行フローの中でクライアント認証を実行する

### 関連仕様
#### Appendix E. Wallet Attestations in JWT format

https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-E

```
The Wallet Attestation defined in this section is a client authentication method especially designed for native App Wallets. Instead of using platform-specific key, app, and/or device attestations directly, it uses a key-bound, platform agnostic common format based on JWTs. This allows Authorization Servers to authenticate Wallets across different platforms in a unified fashion and exposes only a minimum dataset. Also, it allows the Wallet app to directly interact with the Credential Issuer without involving the Wallet Provider's backend. The Authorization Server MUST verify that the Wallet Attestation is signed by an issuer that the Credential Issuer trusts for this purpose.

In a typical architecture of a native Wallet App, the Wallet Provider's backend will use attestations provided by the mobile operating system, like iOS's DeviceCheck or Android's Play Integrity, to validate the app's integrity and authenticity before issuing the Wallet Attestation.

There are two requests where Wallets may need to authenticate during Credential issuance:

The Wallet sends it in the Pushed Authorization Request
The Wallet sends it in the Token Request
The Wallet Attestation format follows Section 5.1 "Client Attestation JWT" of [I-D.ietf-oauth-attestation-based-client-auth]. The Wallet Attestation additionally includes the following JWT Claims:

- wallet_name: OPTIONAL. String containing a human-readable name of the Wallet.
- wallet_link: OPTIONAL. String containing a URL to get further information about the Wallet and the Wallet Provider.
- status: OPTIONAL. Status mechanism for the Wallet Attestation as defined in [I-D.ietf-oauth-status-list]
```

The following is a non-normative example of a decoded Wallet Attestation:
```json
{
  "typ": "oauth-client-attestation+jwt",
  "alg": "ES256",
  "kid": "11"
}
.
{
  "iss": "https://wallet-provider.example.com",
  "sub": "https://wallet.example.org",
  "wallet_name": "Wallet Solution X by Wonderland State Department",
  "wallet_link": "https://example.com/wallet/detail_info.html",
  "nbf": 1300815780,
  "exp": 1300819380,
  "cnf": {
    "jwk": {
      "kty": "EC",
      "use": "sig",
      "crv": "P-256",
      "x": "18wHLeIgW9wVN6VD1Txgpqy2LszYkMf6J8njVAibvhM",
      "y": "-V4dS4UaLMgP_4fY4j8ir7cl1TXlFdAgcx55o7TkcSA"
    }
  }
}
```

#### OAuth 2.0 Attestation-Based Client Authentication

https://drafts.oauth.net/draft-ietf-oauth-attestation-based-client-auth/draft-ietf-oauth-attestation-based-client-auth.html

5.1. Client Attestation JWT
```
The Client Attestation MUST be encoded as a "JSON Web Token (JWT)" according to [RFC7519].

The following content applies to the JWT Header:

typ: REQUIRED. The JWT type MUST be oauth-client-attestation+jwt.

The following content applies to the JWT Claims Set:

iss: REQUIRED. The iss (issuer) claim MUST contains a unique identifier for the entity that issued the JWT. In the absence of an application profile specifying otherwise, compliant applications MUST compare issuer values using the Simple String Comparison method defined in Section 6.2.1 of [RFC3986].

sub: REQUIRED. The sub (subject) claim MUST specify client_id value of the OAuth Client.

exp: REQUIRED. The exp (expiration time) claim MUST specify the time at which the Client Attestation is considered expired by its issuer. The authorization server MUST reject any JWT with an expiration time that has passed, subject to allowable clock skew between systems.

cnf: REQUIRED. The cnf (confirmation) claim MUST specify a key conforming to [RFC7800] that is used by the Client Instance to generate the Client Attestation PoP JWT for client authentication with an authorization server. The key MUST be expressed using the "jwk" representation.

iat: OPTIONAL. The iat (issued at) claim MUST specify the time at which the Client Attestation was issued.

nbf: OPTIONAL. The nbf (not before) claim MUST specify the time before which the Client Attestation MUST NOT be accepted for processing.

The following additional rules apply:

The JWT MAY contain other claims. All claims that are not understood by implementations MUST be ignored.

The JWT MUST be digitally signed or integrity protected with a Message Authentication Code (MAC). The authorization server MUST reject JWTs if signature or integrity protection validation fails.

The authorization server MUST reject a JWT that is not valid in all other respects per "JSON Web Token (JWT)" [RFC7519].
```

5.2. Client Attestation PoP JWT
```
The Client Attestation PoP MUST be encoded as a "JSON Web Token (JWT)" according to [RFC7519].

The following content applies to the JWT Header:

typ: REQUIRED. The JWT type MUST be oauth-client-attestation-pop+jwt.

The following content applies to the JWT Claims Set:

iss: REQUIRED. The iss (issuer) claim MUST specify client_id value of the OAuth Client.

aud: REQUIRED. The aud (audience) claim MUST specify a value that identifies the authorization server as an intended audience. The [RFC8414] issuer identifier URL of the authorization server MUST be used as a value for an "aud" element to identify the authorization server as the intended audience of the JWT.

jti: REQUIRED. The jti (JWT identifier) claim MUST specify a unique identifier for the Client Attestation PoP. The authorization server can utilize the jti value for replay attack detection, see Section 12.1.

iat: REQUIRED. The iat (issued at) claim MUST specify the time at which the Client Attestation PoP was issued. Note that the authorization server may reject JWTs with an "iat" claim value that is unreasonably far in the past.

challenge: OPTIONAL. The challenge (challenge) claim MUST specify a String value that is provided by the authorization server for the client to include in the Client Attestation PoP JWT.

nbf: OPTIONAL. The nbf (not before) claim MUST specify the time before which the Client Attestation PoP MUST NOT be accepted for processing.

The following additional rules apply:

The JWT MAY contain other claims. All claims that are not understood by implementations MUST be ignored.

The JWT MUST be digitally signed using an asymmetric cryptographic algorithm. The authorization server MUST reject JWTs with an invalid signature.

The public key used to verify the JWT MUST be the key located in the "cnf" claim of the corresponding Client Attestation JWT.

The value of the iss claim, representing the client_id MUST match the value of the sub claim in the corresponding Client Attestation JWT.

The Authorization Server MUST reject a JWT that is not valid in all other respects per "JSON Web Token (JWT)" [RFC7519].
```

6.1. Client Attestation HTTP Headers
```
When using headers to transfer the Client Attestation JWT and Client Attestation PoP JWT to an Authorization Server, they MUST be provided in an HTTP request using the following HTTP headers.

OAuth-Client-Attestation:
A JWT that conforms to the structure and syntax as defined in Section 5.1

OAuth-Client-Attestation-PoP:
A JWT that adheres to the structure and syntax as defined in Section 5.2
Note that per [RFC9110] header field names are case-insensitive; so OAUTH-CLIENT-ATTESTATION, oauth-client-attestation, etc., are all valid and equivalent header field names. Case is significant in the header field value, however.

The OAuth-Client-Attestation and OAuth-Client-Attestation-PoP HTTP header field values uses the token68 syntax defined in Section 11.2 of [RFC9110] (repeated below for ease of reference).

OAuth-Client-Attestation       = token68
OAuth-Client-Attestation-PoP   = token68
token68                        = 1*( ALPHA / DIGIT / "-" / "." /
                                     "_" / "~" / "+" / "/" ) *"="
It is RECOMMENDED that the authorization server validate the Client Attestation JWT prior to validating the Client Attestation PoP.
```

The following is an example of the OAuth-Client-Attestation header.

```
OAuth-Client-Attestation: eyJ0eXAiOiJvYXV0aC1jbGllbnQtYXR0ZXN0YXRpb24
rand0IiwiYWxnIjoiRVMyNTYiLCJraWQiOiIxMSJ9.eyJpc3MiOiJodHRwczovL2F0dGV
zdGVyLmV4YW1wbGUuY29tIiwic3ViIjoiaHR0cHM6Ly9jbGllbnQuZXhhbXBsZS5jb20i
LCJuYmYiOjEzMDA4MTU3ODAsImV4cCI6MTMwMDgxOTM4MCwiY25mIjp7Imp3ayI6eyJrd
HkiOiJFQyIsInVzZSI6InNpZyIsImNydiI6IlAtMjU2IiwieCI6IjE4d0hMZUlnVzl3Vk
42VkQxVHhncHF5MkxzellrTWY2SjhualZBaWJ2aE0iLCJ5IjoiLVY0ZFM0VWFMTWdQXzR
mWTRqOGlyN2NsMVRYbEZkQWdjeDU1bzdUa2NTQSJ9fX0.4bCswkgmUHw06kKdiS2KEySR
gjj73yCEIcrz3Mv7Bgns4Bm1tCQ9FAqMLtgzb5NthwJT9AhAEBogbiD5DtxV1g
```

The following is an example of the OAuth-Client-Attestation-PoP header.
```
OAuth-Client-Attestation-PoP: eyJhbGciOiJFUzI1NiIsInR5cCI6Im9hdXRoLWN
saWVudC1hdHRlc3RhdGlvbi1wb3Arand0In0.eyJpc3MiOiJodHRwczovL2NsaWVudC5l
eGFtcGxlLmNvbSIsImF1ZCI6Imh0dHBzOi8vYXMuZXhhbXBsZS5jb20iLCJuYmYiOjEzM
DA4MTU3ODAsImV4cCI6MTMwMDgxOTM4MCwianRpIjoiZDI1ZDAwYWItNTUyYi00NmZjLW
FlMTktOThmNDQwZjI1MDY0Iiwibm9uY2UiOiI1YzFhOWUxMC0yOWZmLTRjMmItYWU3My0
1N2MwOTU3YzA5YzQifQ.rEa-dKJgRuD-aI-4bj4fDGH1up4jV--IgDMFdb9A5jSSWB7Uh
HfvLOVU_ZvAJfOWfO0MXyeunwzM3jGLB_TUkQ
```
#### 4.4.1. Wallet Attestation

https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0-05.html#name-wallet-attestation
```
- the public key certificate, and optionally a trust certificate chain excluding the trust anchor, used to validate the signature on the Wallet Attestation MUST be included in the x5c JOSE header of the Client Attestation JWT
- Wallet Attestations MUST NOT be reused across different Issuers. They MUST NOT introduce a unique identifier specific to a single Wallet instance. The subject claim for the Wallet Attestation MUST be a value that is shared by all Wallet instances using the present type of wallet implementation. See section 15.4.4 of [OIDF.OID4VCI] for details on the Wallet Attestation subject.
- Wallets MUST perform client authentication with the Wallet Attestation at OAuth2 Endpoints that support client authentication.
```
### 基本情報
- docs/api
- docs/architecture/overview.md
- docs/modules/oid4vci
- docs/demos/common.md
- docs/demos/learning-vci.md

### ブランチ
- 新しいブランチで対応して下さい。
    - 派生元ブランチ: 現在のブランチ

### 作業ドキュメント
対応内容がまとまったら、まずは進捗が把握できるように作業ドキュメントを作成して下さい。

作業ドキュメントのパスとファイル名の形式

- docs/work/yyyy-mm-dd-xxx.md