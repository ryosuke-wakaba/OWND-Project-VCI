# Wallet Provider CA 管理機能 作業ドキュメント

## 概要

Wallet Attestation のカスタムトラストアンカー機能を拡張し、管理画面から Wallet Provider の CA 証明書を管理できるようにする。

### 関連ドキュメント

- [Wallet Attestation 対応 作業ドキュメント](./2026-01-22-wallet-attestation.md)
- [作業依頼](./requests/2026-01-23-extend-wallet-attestation-function.md)

### 要件（リクエストより）

1. **管理画面**: 「Wallet Provider CA 管理」タブを追加
2. **CA 証明書インポート**: Wallet Provider の証明書を発行した CA のルート証明書をテキストとしてインポート
3. **チェーン検証設定**: x5c で取り出した wallet provider の証明書とルート CA の証明書のチェーンを検証するかをチェックボックスで切り替え
4. **x5cValidator との統合**: `ClientAuthenticationConfig.x5cValidator` を使用して証明書チェーン検証を実行

---

## 作業ブランチ

- **ブランチ名**: `feature/wallet-attestation`（現在のブランチで対応）

---

## 実装計画

### Phase 1: データベーススキーマ拡張

| #   | タスク                                     | ファイル                              | 状態 |
| --- | ------------------------------------------ | ------------------------------------- | ---- |
| 1.1 | trusted_wallet_provider_cas テーブルを追加 | `demos/common/src/store/authStore.ts` | [x]  |
| 1.2 | CA 証明書の CRUD 関数を実装                | `demos/common/src/store/authStore.ts` | [x]  |

### Phase 2: 管理画面ルート・ハンドラ追加

| #   | タスク                                 | ファイル                                               | 状態 |
| --- | -------------------------------------- | ------------------------------------------------------ | ---- |
| 2.1 | CA 管理用ルート定義を追加              | `demos/learning-vci/src/routes/admin/routes.ts`        | [x]  |
| 2.2 | CA 一覧・登録・削除ハンドラを実装      | `demos/learning-vci/src/routes/admin/routesHandler.ts` | [x]  |
| 2.3 | チェーン検証設定の更新ハンドラを実装   | `demos/learning-vci/src/routes/admin/routesHandler.ts` | [x]  |

### Phase 3: 管理画面ビュー作成

| #   | タスク                            | ファイル                                              | 状態 |
| --- | --------------------------------- | ----------------------------------------------------- | ---- |
| 3.1 | CA 管理タブビューを作成           | `demos/learning-vci/views/admin/wallet-provider-ca.ejs` | [x]  |
| 3.2 | ナビゲーションにタブを追加        | `demos/learning-vci/views/layout.ejs`                 | [x]  |

### Phase 4: x5cValidator 実装

| #   | タスク                                         | ファイル                                            | 状態 |
| --- | ---------------------------------------------- | --------------------------------------------------- | ---- |
| 4.1 | 証明書チェーン検証関数を実装                   | `demos/learning-vci/src/logic/x5cValidator.ts`      | [x]  |
| 4.2 | vciConfigProvider に x5cValidator を統合       | `demos/learning-vci/src/logic/vciConfigProvider.ts` | [x]  |

### Phase 5: ドキュメント更新

| #   | タスク                              | ファイル                         | 状態 |
| --- | ----------------------------------- | -------------------------------- | ---- |
| 5.1 | learning-vci ドキュメントを更新     | `docs/demos/learning-vci.md`     | [x]  |

---

## アーキテクチャ設計

### データベース拡張

```sql
-- 信頼するWallet Provider CAの管理
CREATE TABLE trusted_wallet_provider_cas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(255) NOT NULL,              -- CA名（表示用）
  rootCertPem TEXT NOT NULL,               -- ルート証明書（PEM形式）
  enabled BOOLEAN DEFAULT TRUE,            -- 有効/無効
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- チェーン検証設定
CREATE TABLE wallet_attestation_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enableChainValidation BOOLEAN DEFAULT FALSE,  -- チェーン検証の有効/無効
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 処理フロー

```
1. 管理画面でCA証明書をインポート
   └─> trusted_wallet_provider_cas テーブルに保存

2. チェーン検証設定を有効化
   └─> wallet_attestation_settings.enableChainValidation = true

3. Token Endpoint でクライアント認証時
   ├─ enableChainValidation === false → x5cValidatorスキップ
   └─ enableChainValidation === true
       └─> x5cValidator実行
           ├─ x5c[0]（Wallet Provider証明書）を取得
           ├─ trusted_wallet_provider_cas から有効なCA証明書を取得
           └─ 証明書チェーンを検証
               ├─ 成功 → { valid: true }
               └─ 失敗 → { valid: false, error: "..." }
```

### 証明書チェーン検証ロジック

```typescript
// x5cValidator実装イメージ
async function createX5cValidator(): Promise<X5cChainValidator | undefined> {
  const settings = await getWalletAttestationSettings();
  if (!settings.enableChainValidation) {
    return undefined; // 検証スキップ
  }

  return async (x5cChain: string[]): Promise<{ valid: boolean; error?: string }> => {
    // 1. x5c[0]からWallet Provider証明書を取得
    const walletProviderCert = x5cChain[0];

    // 2. 信頼するCA証明書リストを取得
    const trustedCAs = await getEnabledTrustedCAs();

    // 3. 証明書チェーン検証
    for (const ca of trustedCAs) {
      const result = await verifyCertificateChain(walletProviderCert, x5cChain, ca.rootCertPem);
      if (result.valid) {
        return { valid: true };
      }
    }

    return { valid: false, error: "Certificate chain validation failed: no trusted CA found" };
  };
}
```

---

## 管理画面仕様

### Wallet Provider CA 管理タブ

**パス**: `/admin/wallet-provider-ca`

**機能**:

1. **CA 証明書一覧**
   - 登録済み CA 証明書の一覧表示
   - 各 CA の有効/無効状態を表示
   - 削除ボタン

2. **CA 証明書インポート**
   - 名前（表示用）入力フィールド
   - PEM 形式のルート証明書テキストエリア
   - インポートボタン

3. **チェーン検証設定**
   - 「証明書チェーン検証を有効にする」チェックボックス
   - 保存ボタン

### UI モックアップ

```html
<div class="tab-content">
  <h2>Wallet Provider CA 管理</h2>

  <!-- チェーン検証設定 -->
  <div class="settings-section">
    <h3>検証設定</h3>
    <label>
      <input type="checkbox" name="enableChainValidation" />
      証明書チェーン検証を有効にする
    </label>
    <p class="help-text">
      有効にすると、Wallet Attestation の x5c 証明書チェーンを登録済み CA 証明書で検証します。
    </p>
    <button type="submit">設定を保存</button>
  </div>

  <!-- CA証明書一覧 -->
  <div class="ca-list-section">
    <h3>登録済み CA 証明書</h3>
    <table>
      <tr>
        <th>名前</th>
        <th>状態</th>
        <th>登録日</th>
        <th>操作</th>
      </tr>
      <!-- CA証明書リスト -->
    </table>
  </div>

  <!-- CA証明書インポート -->
  <div class="import-section">
    <h3>CA 証明書をインポート</h3>
    <form method="POST" action="/admin/wallet-provider-ca/import">
      <div class="form-group">
        <label>CA 名</label>
        <input type="text" name="name" required />
      </div>
      <div class="form-group">
        <label>ルート証明書（PEM 形式）</label>
        <textarea name="rootCertPem" rows="10" required></textarea>
      </div>
      <button type="submit">インポート</button>
    </form>
  </div>
</div>
```

---

## 備考

### セキュリティ考慮事項

1. **証明書の検証**: インポート時に PEM 形式の妥当性を検証
2. **信頼の管理**: 無効化された CA は即座に検証から除外

### 依存ライブラリ

- `@ownd-project/ts-toolbox`: 証明書操作ユーティリティを使用予定

---

## 参考資料

- [Wallet Attestation 対応 作業ドキュメント](./2026-01-22-wallet-attestation.md)
- [OID4VCI モジュール概要](../modules/oid4vci/README.md)
- [クライアント認証モジュール](../modules/oid4vci/client-authentication.md)
