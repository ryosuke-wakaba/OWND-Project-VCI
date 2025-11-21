# システムアーキテクチャ概要

## 概要
本ライブラリはOID4VCI準拠のクレデンシャル発行機能を提供する。

## モジュール構成

```
src/
├── oid4vci/                    # OID4VCIプロトコル実装
│   ├── tokenEndpoint/          # Access Token発行
│   ├── credentialEndpoint/     # Credential発行
│   ├── nonceEndpoint/          # c_nonce発行
│   ├── CredentialOffer.ts      # Credential Offer生成
│   └── types/                  # プロトコル型定義
├── credentials/                # クレデンシャルフォーマット
│   ├── sd-jwt/                 # SD-JWT形式
│   └── jwt/                    # JWT形式
├── metadata/                   # Issuerメタデータ
└── utils/                      # 共通ユーティリティ
```

## 発行フロー

```
1. Credential Offer生成
   └─> Pre-authorized code発行

2. Token Endpoint
   └─> pre-authorized_code検証 → Access Token発行

3. Nonce Endpoint
   └─> c_nonce発行（Credential Endpoint呼び出し前に必要）

4. Credential Endpoint
   └─> Access Token検証 → Proof検証（c_nonce使用） → Credential発行
```

## 依存関係

- `@ownd-project/ts-toolbox`: 暗号処理・共通ユーティリティ

## 外部インターフェース

本ライブラリは以下のインターフェースを実装者に委譲:
- `IMetadataRepository`: Issuerメタデータの取得
- `StoredAccessToken`: Access Tokenの永続化（実装者定義）
