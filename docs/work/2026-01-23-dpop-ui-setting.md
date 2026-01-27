# DPoP設定のUI化対応

## 概要

DPoP（Demonstrating Proof of Possession）の設定を環境変数による制御からUI上での切り替えに変更する。

### 変更前
- `DPOP_ENABLED` 環境変数でDPoPサポートの有効/無効を制御
- `DPOP_REQUIRED` 環境変数でDPoP必須化を制御

### 変更後
- DPoPは常に有効（`DPOP_ENABLED`相当の制御を削除）
- クレデンシャル発行単位でDPoP必須化を選択可能（UI上のチェックボックス）

## 参照ドキュメント

- 作業依頼: docs/work/requests/2026-01-23-change-dpop-setting.md
- 元のDPoP実装: docs/work/2025-12-24-dpop-implementation.md
- 参考実装（Wallet Attestation）: docs/work/2026-01-22-wallet-attestation.md

## 実装計画

### 1. データベーススキーマ変更

**対象ファイル**: `demos/common/src/store/authStore.ts`

`auth_codes`テーブルに`requireDpop`カラムを追加:

```sql
ALTER TABLE auth_codes ADD COLUMN requireDpop BOOLEAN DEFAULT FALSE;
```

マイグレーション処理を`runMigrations()`に追加。

### 2. ストア関数の更新

**対象ファイル**:
- `demos/common/src/store/authStore.ts`
- `demos/learning-vci/src/store.ts`

#### authStore.ts

`addAuthCode()`関数に`requireDpop`パラメータを追加:

```typescript
export const addAuthCode = async (
  code: string,
  expiresIn: number,
  preAuthFlow: boolean,
  txCode: string,
  needsProof: boolean,
  sub?: string,
  requireClientAuth?: boolean,
  requireDpop?: boolean,  // 追加
): Promise<number | undefined>
```

`AuthorizedCode`インターフェースに`requireDpop`を追加:

```typescript
export interface AuthorizedCode {
  // ... existing fields
  requireDpop: boolean;
}
```

#### store.ts (learning-vci)

`addPreAuthCode()`関数に`requireDpop`パラメータを追加。

### 3. 管理画面UIの更新

**対象ファイル**: `demos/learning-vci/views/admin/learner-offer.ejs`

Wallet Attestationのチェックボックスと同様に、DPoP必須化のチェックボックスを追加:

```html
<div class="form-group">
  <label class="checkbox-label">
    <input type="checkbox" name="requireDpop" value="true">
    DPoPを必須にする
  </label>
  <small class="form-text">
    チェックすると、クレデンシャル発行時にDPoP Proofの提示が必須になります。
  </small>
</div>
```

### 4. ルートハンドラーの更新

**対象ファイル**: `demos/learning-vci/src/routes/admin/routesHandler.ts`

#### credentialOfferForLearner()

オプションに`requireDpop`を追加:

```typescript
interface CredentialOfferOptions {
  signingKeyKid?: string;
  requireClientAuth?: boolean;
  requireDpop?: boolean;  // 追加
}
```

#### handleLearnerCredentialOfferDisplay()

フォームから`requireDpop`を取得:

```typescript
const requireDpop = ctx.request.body?.requireDpop === "true";
```

### 5. Credential Offer表示画面の更新

**対象ファイル**: `demos/learning-vci/views/admin/credential-offer.ejs`

DPoP必須化の状態を表示:

```html
<div class="info-item">
  <label>DPoP:</label>
  <% if (requireDpop) { %>
  <span class="dpop-required">必須</span>
  <% } else { %>
  <span class="dpop-optional">任意</span>
  <% } %>
</div>
```

### 6. VCI設定プロバイダーの更新

**対象ファイル**:
- `demos/learning-vci/src/logic/vciConfigProvider.ts`
- `demos/learning-vci/src/logic/credentialsConfigProvider.ts`

#### vciConfigProvider.ts (Token Endpoint)

環境変数チェックを削除し、DPoPを常に有効化。`required`は認可コードごとの設定を参照:

```typescript
export const tokenConfigure = (): TokenIssuerConfig => {
  const config: TokenIssuerConfig = {
    authCodeStateProvider,
    accessTokenIssuer,
  };

  // DPoPは常に有効
  config.dpop = {
    enabled: true,
    required: false,  // デフォルトは任意、認可コードごとに判定
    allowedAlgorithms: ["ES256"],
    iatToleranceSeconds: 300,
  };
  config.tokenEndpointUrl = getTokenEndpointUrl();

  return config;
};
```

#### credentialsConfigProvider.ts (Credential Endpoint)

同様にDPoPを常に有効化。`required`はアクセストークンに紐づく認可コードの設定を参照。

### 7. 認可コード状態プロバイダーの更新

**対象ファイル**: `demos/learning-vci/src/logic/vciConfigProvider.ts`

`authCodeStateProvider`が返す`PreAuthorizedCode`に`requireDpop`を含める:

```typescript
const _preAuthorizedCode: PreAuthorizedCode<StoredData> = {
  // ... existing fields
  requireClientAuth: Boolean(storedAuthCode.requireClientAuth),
  requireDpop: Boolean(storedAuthCode.requireDpop),  // 追加
  storedData: { id: storedAuthCode.id },
};
```

### 8. ライブラリ側の型定義更新

**対象ファイル**: `src/oid4vci/types/types.ts`

`AuthorizedCode`インターフェースに`requireDpop`を追加:

```typescript
export interface AuthorizedCode extends Identifiable {
  // ... existing fields
  /** Whether DPoP proof is required for this authorization code */
  requireDpop?: boolean;
}
```

### 9. Token Endpointのロジック更新

**対象ファイル**: `src/oid4vci/tokenEndpoint/TokenIssuer.ts`

DPoP必須判定のロジックを更新:
- グローバル設定（`config.dpop.required`）に加えて
- 認可コードごとの設定（`authorizedCode.requireDpop`）も参照

### 10. 環境変数の削除

**対象ファイル**:
- `demos/learning-vci/.env.sample`
- `demos/learning-vci/src/logic/vciConfigProvider.ts`
- `demos/learning-vci/src/logic/credentialsConfigProvider.ts`

以下の環境変数参照を削除:
- `DPOP_ENABLED`
- `DPOP_REQUIRED`

`isDpopEnabled()`関数を削除。

## 実装タスク

- [x] データベースマイグレーション追加（`requireDpop`カラム）
- [x] authStore.ts: `addAuthCode()`に`requireDpop`パラメータ追加
- [x] authStore.ts: `AuthorizedCode`インターフェースに`requireDpop`追加
- [x] store.ts: `addPreAuthCode()`に`requireDpop`パラメータ追加
- [x] learner-offer.ejs: DPoP必須化チェックボックス追加
- [x] credential-offer.ejs: DPoP必須化状態の表示追加
- [x] routesHandler.ts: `credentialOfferForLearner()`オプション拡張
- [x] routesHandler.ts: `handleLearnerCredentialOfferDisplay()`でrequireDpop取得
- [x] types.ts: `AuthorizedCode`に`requireDpop`追加
- [x] vciConfigProvider.ts: 環境変数削除、DPoP常時有効化
- [x] credentialsConfigProvider.ts: 環境変数削除、DPoP常時有効化
- [x] TokenIssuer.ts: 認可コードごとのDPoP必須判定
- [x] .env.sample: `DPOP_ENABLED`, `DPOP_REQUIRED`削除
- [x] ビルド・動作確認

## 影響範囲

### 変更されるファイル

| ファイル | 変更内容 |
|---------|---------|
| `demos/common/src/store/authStore.ts` | スキーマ、マイグレーション、関数更新 |
| `demos/learning-vci/src/store.ts` | `addPreAuthCode()`パラメータ追加 |
| `demos/learning-vci/views/admin/learner-offer.ejs` | チェックボックス追加 |
| `demos/learning-vci/views/admin/credential-offer.ejs` | DPoP状態表示追加 |
| `demos/learning-vci/src/routes/admin/routesHandler.ts` | オプション拡張 |
| `demos/learning-vci/src/logic/vciConfigProvider.ts` | 環境変数削除、設定変更 |
| `demos/learning-vci/src/logic/credentialsConfigProvider.ts` | 環境変数削除、設定変更 |
| `demos/learning-vci/.env.sample` | 環境変数削除 |
| `src/oid4vci/types/types.ts` | `AuthorizedCode`に`requireDpop`追加 |
| `src/oid4vci/tokenEndpoint/TokenIssuer.ts` | 判定ロジック更新 |

### 後方互換性

- 既存の`auth_codes`レコードは`requireDpop = FALSE`（デフォルト）として扱われる
- 環境変数を設定していた場合は、UI経由での設定に移行が必要
