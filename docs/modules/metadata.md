# Metadata モジュール

## 概要
Issuerメタデータの管理インターフェースを提供。

## インターフェース

### IMetadataRepository
実装者が提供するメタデータリポジトリのインターフェース。

```typescript
interface IMetadataRepository {
  // Issuerメタデータの取得
  getIssuerMetadata(): Promise<IssuerMetadata>;
  // Credential設定の取得
  getCredentialConfiguration(id: string): Promise<CredentialConfiguration>;
}
```

## 実装責務
- Issuerメタデータの永続化は実装者が担当
- 本ライブラリはインターフェースのみ定義
