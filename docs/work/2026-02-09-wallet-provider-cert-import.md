# Wallet Provider 証明書インポート機能 作業ドキュメント

## 概要

Wallet Attestation 検証機能を拡張し、CA が発行した Wallet Provider 証明書を管理画面からインポートし、x5c 証明書の公開鍵との一致をチェックできるようにする。

### 関連ドキュメント

- [Wallet Provider CA 管理機能 作業ドキュメント](./2026-01-23-wallet-provider-ca-management.md)
- [作業依頼](./requests/2026-02-09-new-function-import-wallet-provider-cert.md)

### 要件（リクエストより）

1. **証明書インポート**: CA が発行した証明書をインポートする機能
   - 1 インポートで 1 証明書
   - インポートは何回でも可能
2. **公開鍵一致チェック**: wallet attestation 検証時、x5c に格納されている証明書と同じ公開鍵を持つかチェック
   - 一致条件: お互いの公開鍵が同一であること

---

## 作業ブランチ

- **ブランチ名**: `feature/wallet-provider-cert-import`
- **派生元**: `feature/update-learning-credential-data-model`

---

## 実装計画

### Phase 1: データベーススキーマ拡張

| #   | タスク                                          | ファイル                              | 状態 |
| --- | ----------------------------------------------- | ------------------------------------- | ---- |
| 1.1 | trusted_wallet_provider_certs テーブルを追加    | `demos/common/src/store/authStore.ts` | [x]  |
| 1.2 | 証明書の CRUD 関数を実装                        | `demos/common/src/store/authStore.ts` | [x]  |

### Phase 2: 管理画面ルート・ハンドラ追加

| #   | タスク                                 | ファイル                                               | 状態 |
| --- | -------------------------------------- | ------------------------------------------------------ | ---- |
| 2.1 | 証明書管理用ルート定義を追加           | `demos/learning-vci/src/routes/admin/routes.ts`        | [x]  |
| 2.2 | 証明書一覧・登録・削除ハンドラを実装   | `demos/learning-vci/src/routes/admin/routesHandler.ts` | [x]  |

### Phase 3: 管理画面ビュー更新

| #   | タスク                                  | ファイル                                                | 状態 |
| --- | --------------------------------------- | ------------------------------------------------------- | ---- |
| 3.1 | 証明書管理セクションをビューに追加      | `demos/learning-vci/views/admin/wallet-provider-ca.ejs` | [x]  |
| 3.2 | 多言語対応（i18n）                      | `demos/learning-vci/locales/*/wallet.json`              | [x]  |

### Phase 4: x5cValidator 拡張

| #   | タスク                                              | ファイル                                            | 状態 |
| --- | --------------------------------------------------- | --------------------------------------------------- | ---- |
| 4.1 | 公開鍵一致チェックロジックを実装                    | `demos/learning-vci/src/logic/x5cValidator.ts`      | [x]  |

### Phase 5: 設定拡張

| #   | タスク                                              | ファイル                                            | 状態 |
| --- | --------------------------------------------------- | --------------------------------------------------- | ---- |
| 5.1 | 証明書マッチング設定の追加                          | `demos/common/src/store/authStore.ts`               | [x]  |
| 5.2 | 設定 UI の追加                                      | `demos/learning-vci/views/admin/wallet-provider-ca.ejs` | [x]  |

### Phase 6: ドキュメント更新

| #   | タスク                              | ファイル                         | 状態 |
| --- | ----------------------------------- | -------------------------------- | ---- |
| 6.1 | common ドキュメントを更新           | `docs/demos/common.md`           | [x]  |

---

## アーキテクチャ設計

### データベース拡張

```sql
-- 信頼するWallet Provider証明書の管理
CREATE TABLE trusted_wallet_provider_certs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,              -- 証明書名（表示用）
  certPem TEXT NOT NULL,                   -- 証明書（PEM形式）
  publicKeyJwk TEXT NOT NULL,              -- 公開鍵参照用（Base64証明書）
  enabled BOOLEAN DEFAULT TRUE,            -- 有効/無効
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 既存設定テーブルの拡張

```sql
-- wallet_attestation_settings テーブルにカラム追加
ALTER TABLE wallet_attestation_settings
ADD COLUMN enableCertMatching BOOLEAN DEFAULT FALSE;
```

### 処理フロー

```
1. 管理画面で証明書をインポート
   ├─ PEM形式の証明書を入力
   └─> trusted_wallet_provider_certs テーブルに保存

2. 証明書マッチング設定を有効化
   └─> wallet_attestation_settings.enableCertMatching = true

3. Token Endpoint でクライアント認証時
   ├─ enableCertMatching === false → 公開鍵一致チェックスキップ
   └─ enableCertMatching === true
       └─> 公開鍵一致チェック実行
           ├─ x5c[0]（Wallet Provider証明書）をPEM形式に変換
           ├─ trusted_wallet_provider_certs から有効な証明書を取得
           └─ 公開鍵を比較（checkEcdsaKeyEquality使用）
               ├─ 一致 → { valid: true }
               └─ 不一致 → { valid: false, error: "..." }
```

### 公開鍵一致チェックロジック

```typescript
// x5cValidator実装
const checkCertificatePublicKeyMatch = async (
  x5cChain: string[],
): Promise<{ valid: boolean; error?: string }> => {
  const settings = await authStore.getWalletAttestationSettings();
  if (!settings.enableCertMatching) {
    return { valid: true }; // チェックスキップ
  }

  // x5c[0]をPEM形式に変換
  const x5cLeafCertPem = base64ToPem(x5cChain[0]);

  // 信頼する証明書リストを取得
  const trustedCerts = await authStore.getEnabledTrustedWalletProviderCerts();

  // 公開鍵を比較（checkEcdsaKeyEquality使用）
  for (const trustedCert of trustedCerts) {
    const isMatch = checkEcdsaKeyEquality(trustedCert.certPem, x5cLeafCertPem);
    if (isMatch) {
      return { valid: true };
    }
  }

  return { valid: false, error: "Certificate public key does not match any trusted certificate" };
};
```

---

## 管理画面仕様

### 証明書管理セクション（既存の CA 管理ページに追加）

**パス**: `/admin/wallet-provider-ca`（既存）

**追加機能**:

1. **証明書マッチング設定**
   - 「証明書の公開鍵一致チェックを有効にする」チェックボックス

2. **証明書一覧**
   - 登録済み証明書の一覧表示
   - 各証明書の有効/無効状態を表示
   - 削除ボタン

3. **証明書インポート**
   - 名前（表示用）入力フィールド
   - PEM 形式の証明書テキストエリア
   - インポートボタン

---

## API

### 新規エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/admin/wallet-provider-ca/cert/import` | 証明書をインポート |
| POST | `/admin/wallet-provider-ca/cert/:id/toggle` | 証明書の有効/無効を切替 |
| POST | `/admin/wallet-provider-ca/cert/:id/delete` | 証明書を削除 |
| POST | `/admin/wallet-provider-ca/cert-settings` | 証明書マッチング設定を更新 |

---

## 備考

### 技術的考慮事項

1. **公開鍵の比較方法**
   - `@ownd-project/ts-toolbox` の `checkEcdsaKeyEquality` 関数を使用
   - PEM 形式の証明書から公開鍵を抽出して X, Y 座標を比較

2. **証明書のパース**
   - `@ownd-project/ts-toolbox` の証明書操作ユーティリティを使用

### 依存ライブラリ

- `@ownd-project/ts-toolbox`: 証明書操作ユーティリティ

---

## 変更履歴

| 日付 | 内容 |
|------|------|
| 2026-02-09 | 初版作成、全フェーズ実装完了 |

## 参考資料

- [Wallet Provider CA 管理機能 作業ドキュメント](./2026-01-23-wallet-provider-ca-management.md)
- [OID4VCI モジュール概要](../modules/oid4vci/README.md)
- [クライアント認証モジュール](../modules/oid4vci/client-authentication.md)
