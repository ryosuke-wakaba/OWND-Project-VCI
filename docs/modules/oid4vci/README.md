# OID4VCI モジュール

## 概要
OID4VCIプロトコルのエンドポイント実装を提供する。本モジュールはライブラリとして設計されており、実装者が提供するコールバック関数を通じて永続化やビジネスロジックをカスタマイズできる。

コード例は [learning-vci](../../demos/learning-vci.md) デモアプリケーションから引用している。

## ドキュメント一覧

| ドキュメント | 説明 |
|-------------|------|
| [DPoP](./dpop.md) | DPoP（Demonstrating Proof of Possession）の実装詳細 |
| [CredentialOffer](./credential-offer.md) | Credential Offer URLの生成・パース |
| [TokenIssuer](./token-issuer.md) | Pre-authorized codeの検証とAccess Token発行 |
| [NonceIssuer](./nonce-issuer.md) | c_nonceの発行 |
| [CredentialIssuer](./credential-issuer.md) | Access Token検証とCredential発行 |
| [エンドポイント設定](./setup.md) | VCIエンドポイントの設定とメタデータリポジトリ |
| [リファレンス](./reference.md) | 型定義、エラーコード、環境変数 |

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

## Pre-Authorized Code Flow

```
  Issuer                                              Wallet
    │                                                   │
    │  1. Credential Offer (QRコード/ディープリンク)      │
    │ ─────────────────────────────────────────────────>│
    │                                                   │
    │  2. GET /.well-known/openid-credential-issuer     │
    │ <─────────────────────────────────────────────────│
    │       Issuer Metadata                             │
    │ ─────────────────────────────────────────────────>│
    │                                                   │
    │  3. POST /token (pre-authorized_code + tx_code)   │
    │ <─────────────────────────────────────────────────│
    │       Access Token                                │
    │ ─────────────────────────────────────────────────>│
    │                                                   │
    │  4. POST /nonce                                   │
    │ <─────────────────────────────────────────────────│
    │       c_nonce                                     │
    │ ─────────────────────────────────────────────────>│
    │                                                   │
    │  5. POST /credentials (Access Token + Proof)      │
    │ <─────────────────────────────────────────────────│
    │       Verifiable Credential                       │
    │ ─────────────────────────────────────────────────>│
    │                                                   │
```

## 参考リンク

- [learning-vci デモ](../../demos/learning-vci.md) - 完全な実装例
- [common モジュール](../../demos/common.md) - 共通ストア・鍵管理
- [OID4VCI仕様](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html)
- [HAIP仕様](https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0-04.html)
