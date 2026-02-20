# credential_metadataのclaims形式修正

## 概要
OID4VCI 1.0仕様に準拠するため、`credential_metadata`の`claims`をマップ形式から配列形式に変更する。

## 関連ドキュメント
- 作業依頼: docs/work/requests/2026-02-20-bugfix-for-metadata.md
- 仕様: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-credential-issuer-metadata-p

## 変更前後の形式

### Before (マップ形式)
```json
"credential_metadata": {
  "family_name": {
    "display": [{"name": "Family Name", "locale": "en"}]
  },
  "given_name": {
    "display": [{"name": "Given Name", "locale": "en"}]
  }
}
```

### After (配列形式)
```json
"credential_metadata": {
  "claims": [
    {
      "path": ["family_name"],
      "display": [{"name": "Family Name", "locale": "en"}],
      "value_type": "string",
      "mandatory": true
    },
    {
      "path": ["given_name"],
      "display": [{"name": "Given Name", "locale": "en"}],
      "value_type": "string",
      "mandatory": true
    }
  ]
}
```

## 変更対象ファイル

### 型定義
- [ ] src/oid4vci/types/protocol.types.ts
  - `ClaimMetadata`インターフェース追加（path, display, value_type, mandatory）
  - `CredentialMetadataVcSdJwt`インターフェース追加
  - `IssuerMetadataVcSdJwt`の`credential_metadata`の型を更新

### ユーティリティ
- [ ] src/utils/localize.ts
  - 配列形式の`claims`を処理するように更新

### デモアプリケーション
- [ ] demos/learning-vci/src/metadata/credentialConfigs.ts
- [ ] demos/employee-vci/src/metadata/credentialConfigs.ts

### テスト
- [ ] tests/utils/localize.test.ts
- [ ] tests/oid4vci/types/validator.test.ts

## 進捗

| ステップ | ステータス |
|---------|----------|
| 型定義の更新 | 完了 |
| localize.tsの更新 | 完了 |
| デモアプリの更新 | 完了 |
| テストの更新 | 完了 |
| ビルド確認 | 完了 |
| テスト実行 | 完了 (151 tests passing) |

## 変更されたファイル

### claims配列形式への変更
1. `src/oid4vci/types/protocol.types.ts` - `ClaimMetadata`と`CredentialMetadataContent`インターフェース追加
2. `src/utils/localize.ts` - 配列形式のclaimsを処理するように更新
3. `demos/learning-vci/src/metadata/credentialConfigs.ts` - 配列形式に変換
4. `demos/employee-vci/src/metadata/credentialConfigs.ts` - 配列形式に変換
5. `demos/learning-vci/src/logic/credentialsConfigProvider.ts` - 配列形式に変換
6. `demos/employee-vci/src/logic/credentialsConfigProvider.ts` - 配列形式に変換
7. `tests/utils/localize.test.ts` - テストデータを配列形式に更新
8. `tests/oid4vci/types/validator.test.ts` - テストデータを配列形式に更新
9. `docs/modules/oid4vci/setup.md` - ドキュメントを配列形式に更新

### displayのcredential_metadata内への移動（OID4VCI v1.0 SD-JWT VC仕様準拠）
- `src/oid4vci/types/protocol.types.ts` - SD-JWT VC用の`IssuerMetadataVcSdJwt`から設定レベルの`display`を削除
- `src/utils/localize.ts` - `credential_metadata.display`のローカライズ処理を追加
- 両デモアプリの`credentialConfigs.ts` - `display`を`credential_metadata`内に移動
- テストファイル - `display`の位置を更新

## 最終構造

```json
{
  "credential_configurations_supported": {
    "LearningCredential": {
      "format": "dc+sd-jwt",
      "vct": "...",
      "credential_metadata": {
        "display": [
          { "name": "学習証明書", "locale": "ja-JP", ... }
        ],
        "claims": [
          {
            "path": ["family_name"],
            "display": [{ "name": "姓", "locale": "ja-JP" }]
          }
        ]
      }
    }
  }
}
```
