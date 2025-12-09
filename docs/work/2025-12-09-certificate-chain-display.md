# 作業ドキュメント: キーペア詳細の証明書チェーン表示仕様

## 概要

キーペア管理のキーペア詳細画面において、上位証明書（中間証明書・ルート証明書）が表示される条件と表示仕様について調査した結果をまとめる。

## 作業状況

| フェーズ | 状態 |
|---------|------|
| 調査 | 完了 |
| ドキュメント作成 | 完了 |

---

## 調査結果

### 上位証明書が表示される条件

上位証明書が表示されるのは、**リーフ証明書（Leaf Certificate）として発行した場合**のみ。

#### 条件の詳細

1. 証明書タイプ（`certType`）が `"leaf"` であること
2. 発行者キー（`issuerKid`）が指定されていること
3. 発行者キーに証明書チェーンが登録されていること

#### 該当コード

**ファイル**: `demos/learning-vci/src/routes/admin/routesHandler.ts:516-524`

```typescript
// If leaf cert, include issuer chain
if (certType === "leaf" && issuerKid) {
  const issuerChain = await keyStore.getX509Chain(issuerKid);
  if (issuerChain && issuerChain.length > 0) {
    certificates = [cert, ...issuerChain];
  }
}
```

### 証明書発行方法による違い

| 証明書発行方法 | 上位証明書表示 | 説明 |
|---------------|---------------|------|
| 自己署名証明書（`certType === "self"`） | なし | 単一証明書のみ格納 |
| リーフ証明書（`certType === "leaf"`） | あり | 発行者の証明書チェーンが含まれる |

---

## 表示仕様

### 画面表示

**ファイル**: `demos/learning-vci/views/admin/key-detail.ejs:54-56`

```ejs
<h4>証明書 <%= index + 1 %>
  <% if (index === 0) { %> (End Entity)
  <% } else if (index === x509Chain.length - 1) { %> (Root)
  <% } else { %> (Intermediate)
  <% } %>
</h4>
```

### ラベル付けルール

| 配列インデックス | ラベル | 説明 |
|-----------------|--------|------|
| 0 | End Entity | 対象キーの証明書（リーフ証明書） |
| 1 〜 n-1 | Intermediate | 中間証明書 |
| n（最後） | Root | ルート証明書 |

### 表示例

#### 2階層チェーン（リーフ + ルート）

```
証明書 1 (End Entity)
  Subject: CN=Issuer Key
  Issuer: CN=Root CA

証明書 2 (Root)
  Subject: CN=Root CA
  Issuer: CN=Root CA
```

#### 3階層チェーン（リーフ + 中間 + ルート）

```
証明書 1 (End Entity)
  Subject: CN=Issuer Key
  Issuer: CN=Intermediate CA

証明書 2 (Intermediate)
  Subject: CN=Intermediate CA
  Issuer: CN=Root CA

証明書 3 (Root)
  Subject: CN=Root CA
  Issuer: CN=Root CA
```

---

## データ格納形式

### テーブル構造

**テーブル**: `ec_key_x509_certificate`

| カラム | 型 | 説明 |
|--------|------|------|
| kid | VARCHAR(80) | 鍵識別子（FK → ec_key_pairs） |
| x509cert | VARCHAR(8192) | 証明書チェーン（JSON配列） |
| description | VARCHAR(255) | 証明書の説明 |
| createdAt | DATETIME | 作成日時 |

### x509cert カラムの形式

JSON配列としてBase64エンコードされた証明書を格納:

```json
[
  "MIIB...(End Entity証明書のBase64)...",
  "MIIC...(中間証明書のBase64、もしあれば)...",
  "MIID...(ルート証明書のBase64)..."
]
```

- 配列の先頭（index 0）: エンドエンティティ証明書
- 後続の要素: 上位証明書（順に中間証明書、ルート証明書）

---

## 証明書情報の取得・表示フロー

### 1. 詳細画面表示時

**ファイル**: `demos/learning-vci/src/routes/admin/routesHandler.ts:411-454`

```typescript
export async function handleKeyDetail(ctx: Koa.Context) {
  const { kid } = ctx.params;
  const keyPair = await keyStore.getEcKeyPair(kid);

  const x509Chain = await keyStore.getX509Chain(kid);
  let certInfos = [];

  if (x509Chain && x509Chain.length > 0) {
    // Parse all certificates in the chain
    const certPems = x509Chain.map((cert) =>
      CERT_PEM_PREAMBLE + "\n" + cert + "\n" + CERT_PEM_POSTAMBLE
    );
    certInfos = getCertificatesInfo(certPems);
  }

  await ctx.render("admin/key-detail", {
    key: keyPair,
    x509Chain,
    certInfos,
  });
}
```

### 2. 証明書情報の解析

`@ownd-project/ts-toolbox` の `getCertificatesInfo` 関数を使用:

- Subject（発行先）
- Issuer（発行者）
- Serial Number（シリアル番号）
- 有効期間（notBefore 〜 notAfter）

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `demos/learning-vci/src/routes/admin/routesHandler.ts` | 証明書発行・詳細表示ハンドラ |
| `demos/learning-vci/views/admin/key-detail.ejs` | キーペア詳細画面テンプレート |
| `demos/learning-vci/views/admin/key-certificate.ejs` | 証明書発行画面テンプレート |
| `demos/common/src/store/keyStore.ts` | 鍵・証明書データストア |
| `demos/common/src/keys.ts` | 鍵・証明書操作ロジック |

---

## 参考資料

- [common.md](../demos/common.md) - 共通モジュール仕様
- [2025-12-02-key-management.md](./2025-12-02-key-management.md) - キーペア管理画面の追加

---

# 機能追加: 上位証明書のインポート

## 概要

外部からインポートしたリーフ証明書に対して、後から上位証明書（中間証明書・ルート証明書）を追加インポートする機能を実装する。

## 作業状況

| フェーズ | 状態 |
|---------|------|
| Phase 1: データストア拡張 | 完了 |
| Phase 2: ビジネスロジック追加 | 完了 |
| Phase 3: UI実装 | 完了 |
| Phase 4: ルーティング追加 | 完了 |

---

## Phase 1: データストア拡張

### 1.1 updateX509Certificate 関数追加

**ファイル**: `demos/common/src/store/keyStore.ts`

既存の証明書チェーンを更新する関数を追加。

```typescript
export const updateX509Certificate = async (
  kid: string,
  x509cert: string,
) => {
  const db = await store.openDb();
  return db.run(
    `UPDATE ${TBL_NM_EC_KEY_X509_CERTIFICATE} SET x509cert = ? WHERE kid = ?`,
    x509cert,
    kid,
  );
};
```

---

## Phase 2: ビジネスロジック追加

### 2.1 appendCertificateChain 関数追加

**ファイル**: `demos/common/src/keys.ts`

上位証明書をチェーンに追加する関数。

処理:
1. 既存の証明書チェーンを取得
2. 入力された上位証明書をパース
3. チェーンを更新（既存 + 新規上位証明書）

---

## Phase 3: UI実装

### 3.1 キー詳細画面にボタン追加

**ファイル**: `demos/learning-vci/views/admin/key-detail.ejs`

証明書セクションに「上位証明書を追加」ボタンを追加。

### 3.2 上位証明書追加フォーム画面

**ファイル**: `demos/learning-vci/views/admin/add-parent-cert.ejs` (新規)

- 上位証明書のPEMテキストエリア（複数証明書対応）
- ヘルプ: 中間証明書→ルート証明書の順で入力

---

## Phase 4: ルーティング追加

### 4.1 ハンドラ追加

**ファイル**: `demos/learning-vci/src/routes/admin/routesHandler.ts`

- `handleAddParentCertForm` - フォーム表示
- `handleAddParentCert` - 追加処理

### 4.2 ルート追加

**ファイル**: `demos/learning-vci/src/routes/admin/routes.ts`

- `GET /admin/keys/:kid/add-parent-cert` - フォーム表示
- `POST /admin/keys/:kid/add-parent-cert` - 追加処理

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `demos/common/src/store/keyStore.ts` | `updateX509Certificate` 関数追加 |
| `demos/common/src/keys.ts` | `appendCertificateChain` 関数追加 |
| `demos/learning-vci/views/admin/key-detail.ejs` | ボタン追加 |
| `demos/learning-vci/views/admin/add-parent-cert.ejs` | 新規作成 |
| `demos/learning-vci/src/routes/admin/routesHandler.ts` | ハンドラ追加 |
| `demos/learning-vci/src/routes/admin/routes.ts` | ルート追加 |
