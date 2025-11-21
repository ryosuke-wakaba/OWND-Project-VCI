# OWND-Project-VCI ドキュメント

OID4VCIプロトコルに準拠したクレデンシャル発行サーバーライブラリのドキュメント。

## ドキュメント構成

### アーキテクチャ
- [システム概要](./architecture/overview.md) - 全体構成とモジュール関係

### モジュール詳細
- [OID4VCI](./modules/oid4vci.md) - OID4VCIプロトコル実装
- [Credentials](./modules/credentials.md) - SD-JWT/JWT発行
- [Metadata](./modules/metadata.md) - メタデータ管理

### API仕様
- [Token Endpoint](./api/token-endpoint.md)
- [Credential Endpoint](./api/credential-endpoint.md)
- [Nonce Endpoint](./api/nonce-endpoint.md)
- [Credential Offer](./api/credential-offer.md)

### デモアプリケーション
- [Demos](./demos/README.md) - 実装サンプル群

### 設計記録
- [ADRテンプレート](./decisions/ADR-001-template.md)

### 参考
- [用語集](./glossary.md)

## 準拠仕様
- [OID4VCI](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
- [HAIP](https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0-04.html)
