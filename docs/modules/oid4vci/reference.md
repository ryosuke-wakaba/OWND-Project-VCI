# リファレンス

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

## エラーコード

| コード | 説明 |
|--------|------|
| `invalid_request` | リクエストの形式が不正 |
| `invalid_proof` | Proofが不正または欠落 |
| `invalid_nonce` | c_nonceが不正または期限切れ |
| `unsupported_credential_format` | 未サポートのCredentialフォーマット |
| `unknown_credential_configuration` | 不明なcredential_configuration_id |

## 環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `CREDENTIAL_ISSUER` | Issuer URL | `https://issuer.example.com` |
| `CREDENTIAL_ISSUER_IDENTIFIER` | Issuer識別子 | `https://issuer.example.com` |
| `VCI_ACCESS_TOKEN_EXPIRES_IN` | Access Token有効期限（秒） | `86400` |
| `VCI_ACCESS_TOKEN_C_NONCE_EXPIRES_IN` | c_nonce有効期限（秒） | `300` |
| `VCI_PRE_AUTH_CODE_EXPIRES_IN` | Pre-auth code有効期限（秒） | `86400` |

## 参考リンク

- [learning-vci デモ](../../demos/learning-vci.md) - 完全な実装例
- [common モジュール](../../demos/common.md) - 共通ストア・鍵管理
- [OID4VCI仕様](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
- [HAIP仕様](https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0-04.html)
