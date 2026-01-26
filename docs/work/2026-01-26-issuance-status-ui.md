# クレデンシャル発行状況表示機能 作業ドキュメント

## 概要

learning-vci デモアプリの「クレデンシャル発行」画面に発行結果を表示する機能を追加する。

### 要件（リクエストより）

1. **結果確認リンク/ボタン**: クレデンシャル発行画面から発行結果を確認できるようにする
2. **発行状況の表示**:
   - 発行要求なし
   - 発行要求なし（期限切れ）
   - 発行要求あり（token/credential エンドポイントのアクセス結果）
3. **受信内容の表示**:
   - DPoP JWT（token/credential エンドポイント別、デコード内容、検証結果）
   - Wallet Attestation JWT（デコード内容、検証結果）
   - Wallet Attestation PoP JWT（デコード内容、検証結果）

---

## 作業ブランチ

- **ブランチ名**: `feature/issuance-status-ui`
- **派生元**: `feature/dpop-ui-setting`

---

## 実装計画

### Phase 1: データベーススキーマ拡張

| #   | タスク                                   | ファイル                              | 状態 |
| --- | ---------------------------------------- | ------------------------------------- | ---- |
| 1.1 | issuance_events テーブルを追加           | `demos/common/src/store/authStore.ts` | [x]  |
| 1.2 | addIssuanceEvent 関数を実装              | `demos/common/src/store/authStore.ts` | [x]  |
| 1.3 | getIssuanceEventsByAuthCodeId 関数を実装 | `demos/common/src/store/authStore.ts` | [x]  |

### Phase 2: Token Endpoint でのイベント記録

| #   | タスク                                        | ファイル                                     | 状態 |
| --- | --------------------------------------------- | -------------------------------------------- | ---- |
| 2.1 | DPoP JWT を抽出・保存するロジックを追加       | `demos/common/src/routes/vci/routesHandler.ts` | [x]  |
| 2.2 | Wallet Attestation JWT を抽出・保存           | `demos/common/src/routes/vci/routesHandler.ts` | [x]  |
| 2.3 | Token 発行成功時にイベントを記録              | `demos/common/src/routes/vci/routesHandler.ts` | [x]  |

### Phase 3: Credential Endpoint でのイベント記録

| #   | タスク                                  | ファイル                                     | 状態 |
| --- | --------------------------------------- | -------------------------------------------- | ---- |
| 3.1 | DPoP JWT を抽出・保存するロジックを追加 | `demos/common/src/routes/vci/routesHandler.ts` | [x]  |
| 3.2 | Credential 発行成功時にイベントを記録   | `demos/common/src/routes/vci/routesHandler.ts` | [x]  |

### Phase 4: 管理画面 UI 実装

| #   | タスク                                           | ファイル                                                  | 状態 |
| --- | ------------------------------------------------ | --------------------------------------------------------- | ---- |
| 4.1 | 発行状況表示ページのルートを追加                 | `demos/learning-vci/src/routes/admin/routes.ts`           | [x]  |
| 4.2 | 発行状況表示ページのハンドラを実装               | `demos/learning-vci/src/routes/admin/routesHandler.ts`    | [x]  |
| 4.3 | 発行状況表示ページの View を作成                 | `demos/learning-vci/views/admin/issuance-status.ejs`      | [x]  |
| 4.4 | credential-offer.ejs に発行状況確認リンクを追加  | `demos/learning-vci/views/admin/credential-offer.ejs`     | [x]  |

### Phase 5: JWT デコード・検証結果表示

| #   | タスク                                     | ファイル                                               | 状態 |
| --- | ------------------------------------------ | ------------------------------------------------------ | ---- |
| 5.1 | JWT デコードユーティリティ関数を追加       | `demos/common/src/utils/jwtDecode.ts` (新規)           | [x]  |
| 5.2 | View に JWT デコード結果表示を実装         | `demos/learning-vci/views/admin/issuance-status.ejs`   | [x]  |

### Phase 6: ドキュメント更新

| #   | タスク                           | ファイル                      | 状態 |
| --- | -------------------------------- | ----------------------------- | ---- |
| 6.1 | learning-vci.md に機能説明を追加 | `docs/demos/learning-vci.md`  | [x]  |
| 6.2 | common.md にスキーマ定義を追加   | `docs/demos/common.md`        | [x]  |

---

## データベース設計

### issuance_events テーブル

認可コードに対する発行フローのイベントを記録する。

```sql
CREATE TABLE issuance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  authCodeId INTEGER NOT NULL,
  eventType VARCHAR(32) NOT NULL,  -- 'token_request' | 'token_issued' | 'credential_request' | 'credential_issued'
  dpopJwt TEXT,                     -- DPoP JWT (生データ)
  dpopHeader TEXT,                  -- DPoP JWT Header (JSON)
  dpopPayload TEXT,                 -- DPoP JWT Payload (JSON)
  dpopValid BOOLEAN,                -- DPoP 検証結果
  dpopError TEXT,                   -- DPoP 検証エラー
  walletAttestationJwt TEXT,        -- Wallet Attestation JWT (生データ)
  walletAttestationHeader TEXT,     -- Wallet Attestation JWT Header (JSON)
  walletAttestationPayload TEXT,    -- Wallet Attestation JWT Payload (JSON)
  walletAttestationValid BOOLEAN,   -- Wallet Attestation 検証結果
  walletAttestationError TEXT,      -- Wallet Attestation 検証エラー
  walletAttestationPopJwt TEXT,     -- Wallet Attestation PoP JWT (生データ)
  walletAttestationPopHeader TEXT,  -- Wallet Attestation PoP JWT Header (JSON)
  walletAttestationPopPayload TEXT, -- Wallet Attestation PoP JWT Payload (JSON)
  walletAttestationPopValid BOOLEAN,-- Wallet Attestation PoP 検証結果
  walletAttestationPopError TEXT,   -- Wallet Attestation PoP 検証エラー
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (authCodeId) REFERENCES auth_codes(id)
);
```

### イベントタイプ

| eventType            | 説明                                   |
| -------------------- | -------------------------------------- |
| `token_request`      | Token エンドポイントへのリクエスト受信 |
| `token_issued`       | Access Token 発行成功                  |
| `credential_request` | Credential エンドポイントへのリクエスト受信 |
| `credential_issued`  | Credential 発行成功                    |

---

## 発行状況の判定ロジック

```typescript
function getIssuanceStatus(authCode: AuthCode, events: IssuanceEvent[]): IssuanceStatus {
  const now = Date.now();
  const createdAt = new Date(authCode.createdAt).getTime();
  const expiresAt = createdAt + authCode.expiresIn * 1000;

  // 期限切れチェック
  const isExpired = now > expiresAt;

  // イベントの有無をチェック
  const hasTokenRequest = events.some(e => e.eventType === 'token_request');
  const hasTokenIssued = events.some(e => e.eventType === 'token_issued');
  const hasCredentialRequest = events.some(e => e.eventType === 'credential_request');
  const hasCredentialIssued = events.some(e => e.eventType === 'credential_issued');

  if (!hasTokenRequest && !hasTokenIssued) {
    return isExpired ? 'no_request_expired' : 'no_request';
  }

  return {
    status: 'has_request',
    tokenRequested: hasTokenRequest,
    tokenIssued: hasTokenIssued,
    credentialRequested: hasCredentialRequest,
    credentialIssued: hasCredentialIssued,
    isExpired
  };
}
```

---

## UI 設計

### 発行状況表示ページ (`/admin/auth-codes/:authCodeId/status`)

```
┌─────────────────────────────────────────────────────────────┐
│ クレデンシャル発行状況                                        │
├─────────────────────────────────────────────────────────────┤
│ 認可コード: abc123...                                        │
│ 作成日時: 2026-01-26 10:00:00                                │
│ 有効期限: 2026-01-27 10:00:00                                │
│ 状態: ● 発行要求あり                                         │
├─────────────────────────────────────────────────────────────┤
│ ■ Token Endpoint                                             │
│   ├─ リクエスト受信: 2026-01-26 10:05:00 ✓                   │
│   └─ Access Token 発行: 2026-01-26 10:05:01 ✓                │
│                                                              │
│   ▼ DPoP JWT (Token Endpoint)                                │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 検証結果: ✓ 成功                                      │   │
│   │ 生データ: eyJ0eXAiOiJkcG9wK2p3dCIsImFsZ...           │   │
│   │                                                       │   │
│   │ Header:                                               │   │
│   │ {                                                     │   │
│   │   "typ": "dpop+jwt",                                  │   │
│   │   "alg": "ES256",                                     │   │
│   │   "jwk": { ... }                                      │   │
│   │ }                                                     │   │
│   │                                                       │   │
│   │ Payload:                                              │   │
│   │ {                                                     │   │
│   │   "jti": "...",                                       │   │
│   │   "htm": "POST",                                      │   │
│   │   "htu": "https://...",                               │   │
│   │   "iat": 1706234567                                   │   │
│   │ }                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   ▼ Wallet Attestation JWT                                   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 検証結果: ✓ 成功                                      │   │
│   │ ...                                                   │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
│   ▼ Wallet Attestation PoP JWT                               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ 検証結果: ✓ 成功                                      │   │
│   │ ...                                                   │   │
│   └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ ■ Credential Endpoint                                        │
│   ├─ リクエスト受信: 2026-01-26 10:06:00 ✓                   │
│   └─ Credential 発行: 2026-01-26 10:06:01 ✓                  │
│                                                              │
│   ▼ DPoP JWT (Credential Endpoint)                           │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ ...                                                   │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### credential-offer.ejs への追加

```html
<!-- Credential Offer 表示後に追加 -->
<div class="mt-4">
  <a href="/admin/auth-codes/<%= authCodeId %>/status" class="btn btn-secondary">
    発行状況を確認
  </a>
</div>
```

---

## 実装メモ

### JWT デコード

```typescript
import { decodeProtectedHeader, decodeJwt } from "jose";

export function decodeJwtParts(jwt: string): {
  header: object;
  payload: object;
  raw: string;
} | null {
  try {
    const header = decodeProtectedHeader(jwt);
    const payload = decodeJwt(jwt);
    return { header, payload, raw: jwt };
  } catch {
    return null;
  }
}
```

### Token Endpoint でのイベント記録

```typescript
// handleToken() 内
const dpopHeader = ctx.get("DPoP");
const walletAttestationHeader = ctx.get("OAuth-Client-Attestation");
const walletAttestationPopHeader = ctx.get("OAuth-Client-Attestation-PoP");

// トークン発行成功後
await authStore.addIssuanceEvent({
  authCodeId: authCode.id,
  eventType: "token_issued",
  dpopJwt: dpopHeader,
  dpopHeader: dpopHeader ? JSON.stringify(decodeProtectedHeader(dpopHeader)) : null,
  dpopPayload: dpopHeader ? JSON.stringify(decodeJwt(dpopHeader)) : null,
  dpopValid: true, // 検証成功時のみここに到達
  walletAttestationJwt: walletAttestationHeader,
  // ... 以下同様
});
```

---

## 参考資料

- [作業依頼ドキュメント](./requests/2026-01-26-add-ui-of-issuing-status.md)
- [learning-vci デモ仕様](../demos/learning-vci.md)
- [DPoP 実装ドキュメント](./2025-12-24-dpop-implementation.md)
- [Wallet Attestation 実装ドキュメント](./2026-01-22-wallet-attestation.md)
