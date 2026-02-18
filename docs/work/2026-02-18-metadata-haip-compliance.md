# OAuth Authorization Server メタデータ HAIP準拠対応

## 概要
対向システムからの指摘に基づき、OAuth Authorization Serverメタデータを HAIP (High Assurance Interoperability Profile) に準拠させる修正を行う。

## 指摘内容と対応方針

### 1. Attestation-Based Client Authentication の広告 ✅ 対応
**指摘**: `token_endpoint_auth_methods_supported` に `attest_jwt_client_auth` が含まれていない

**現状**: `["none"]` のみ設定
**対応**: `["none", "attest_jwt_client_auth"]` に変更

**備考**: Wallet Attestation検証機能は `src/oid4vci/clientAuthentication/` に既に実装済み

### 2. Client Attestation署名アルゴリズムの広告 ✅ 対応
**指摘**:
- `client_attestation_signing_alg_values_supported` が未定義
- `client_attestation_pop_signing_alg_values_supported` が未定義

**対応**: 両フィールドに `["ES256"]` を設定

### 3. PAR (Pushed Authorization Request) エンドポイント ✅ 対応
**指摘**: `pushed_authorization_request_endpoint` が未定義

**現状**: PARエンドポイントは未実装
**対応**: メタデータにエンドポイントURLを追加 (`/par`)

**備考**:
- 対向システムのパーサーの都合でメタデータへの追加が必要
- 実際のPARエンドポイント実装は将来的に対応予定
- 現在のPre-Authorized Code Flowでは直接使用されない

### 4. DPoP署名アルゴリズムの広告 ✅ 対応
**指摘**: `dpop_signing_alg_values_supported` が未定義

**現状**: DPoP検証機能は `src/oid4vci/dpop/` に実装済みだが、メタデータで広告されていない
**対応**: `["ES256"]` を設定

### 5. tx_code の明示的な値設定 ✅ 対応
**指摘**: Credential Offerの `tx_code` が空オブジェクト `{}` になっている

**現状**: `demos/learning-vci/src/routes/admin/routesHandler.ts:260` で `{}` を渡している
**対応**: `{ input_mode: "numeric", length: 6 }` に変更

## 修正対象ファイル

| ファイル | 修正内容 |
|---------|---------|
| `src/oid4vci/types/protocol.types.ts` | AuthorizationServerMetadata に HAIP関連フィールドを追加 |
| `demos/learning-vci/src/metadata/MetadataRepository.ts` | メタデータに追加フィールドを設定 |
| `demos/employee-vci/src/metadata/MetadataRepository.ts` | メタデータに追加フィールドを設定 |
| `demos/learning-vci/src/routes/admin/routesHandler.ts` | tx_code に明示的な値を設定 |

## 修正後のメタデータ例

```json
{
  "issuer": "https://issuer.eujp.ownd-project.com",
  "authorization_endpoint": "https://issuer.eujp.ownd-project.com/authorize",
  "token_endpoint": "https://issuer.eujp.ownd-project.com/token",
  "pushed_authorization_request_endpoint": "https://issuer.eujp.ownd-project.com/par",
  "grant_types_supported": [
    "urn:ietf:params:oauth:grant-type:pre-authorized_code"
  ],
  "token_endpoint_auth_methods_supported": [
    "none",
    "attest_jwt_client_auth"
  ],
  "client_attestation_signing_alg_values_supported": ["ES256"],
  "client_attestation_pop_signing_alg_values_supported": ["ES256"],
  "dpop_signing_alg_values_supported": ["ES256"]
}
```

## 修正後のCredential Offer tx_code例

```json
{
  "tx_code": {
    "input_mode": "numeric",
    "length": 6
  }
}
```

## 進捗

- [x] 調査完了
- [x] 作業ドキュメント作成
- [x] 型定義更新 (`src/oid4vci/types/protocol.types.ts`)
- [x] MetadataRepository更新
  - [x] learning-vci
  - [x] employee-vci
- [x] tx_code生成修正
  - [x] learning-vci
  - [x] employee-vci
- [x] ビルド・動作確認
