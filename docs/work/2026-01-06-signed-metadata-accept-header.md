# Signed Metadata Accept Header対応

## 概要

Signed Metadata機能のレスポンス判定ロジックを、OID4VCI仕様に準拠するよう修正する。

## 参照仕様

- [OID4VCI Section 12.2.2](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-12.2.2)

> The Wallet is RECOMMENDED to send an Accept header in the HTTP GET request to indicate the Content Type(s) it supports, and by doing so, signaling whether it supports signed metadata.

## 問題点

### 現状の実装
署名付きメタデータの**存在有無**でレスポンス形式を決定:
- 署名付きメタデータあり → JWT (`application/jwt`)
- 署名付きメタデータなし → JSON (`application/json`)

### 正しい振る舞い
クライアントの**Accept Header**でレスポンス形式を決定:
- `Accept: application/jwt` → JWT (署名付きメタデータがあれば)
- `Accept: application/json` または指定なし → JSON

---

## 進捗状況

### Phase 1: 作業ドキュメント

- [x] 作業ドキュメント作成

### Phase 2: 実装修正

- [x] `handleIssueMetadata` 関数の分岐ロジック修正

### Phase 3: テスト更新

- [x] Accept Header分岐テスト追加
- [x] 既存テストの修正

### Phase 4: 動作確認

- [x] テスト実行
- [x] 手動テスト

---

## 実装詳細

### 修正対象

**ファイル**: `demos/common/src/routes/vci/routesHandler.ts`

**関数**: `handleIssueMetadata`

### 修正前

```typescript
const signedMetadata = await authStore.getActiveSignedMetadata();
if (signedMetadata) {
  ctx.body = signedMetadata.jwt;
  ctx.status = 200;
  ctx.set("Content-Type", "application/jwt");
  return;
}
// JSON返却...
```

### 修正後

```typescript
const acceptHeader = ctx.request.header["accept"];

// クライアントが application/jwt を要求し、署名付きメタデータがある場合
if (acceptHeader && acceptHeader.includes("application/jwt")) {
  const signedMetadata = await authStore.getActiveSignedMetadata();
  if (signedMetadata) {
    ctx.body = signedMetadata.jwt;
    ctx.status = 200;
    ctx.set("Content-Type", "application/jwt");
    return;
  }
  // 署名付きメタデータがない場合はJSONにフォールバック
}

// デフォルト: JSON返却
```

---

## テスト更新

### 更新対象

**ファイル**: `demos/learning-vci/tests/signedMetadata.test.ts`

### 追加・修正テストケース

| テスト | 内容 |
|--------|------|
| Accept: application/jwt + 署名あり | JWTを返却 |
| Accept: application/jwt + 署名なし | JSONにフォールバック |
| Accept: application/json | JSONを返却 |
| Accept Header なし | JSONを返却（デフォルト） |

---

## 手動テスト

```bash
# JWT形式を要求
curl -H "Accept: application/jwt" \
  http://localhost:3456/.well-known/openid-credential-issuer

# JSON形式を要求
curl -H "Accept: application/json" \
  http://localhost:3456/.well-known/openid-credential-issuer

# Accept Header なし（デフォルト: JSON）
curl http://localhost:3456/.well-known/openid-credential-issuer
```
