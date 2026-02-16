# 作業依頼
## 実装状況の調査
教育クレデンシャルのSD-JWTクレデンシャルについて、issを指定しているかを確認してください。
また、実装があった場合、テストコードによる実装状況も調査してください。


### 基本情報
- docs/api
- docs/architecture/overview.md
- docs/modules/oid4vci
- docs/demos/common.md
- docs/demos/learning-vci.md

### ブランチ
- 新しいブランチで対応して下さい。
    - 派生元ブランチ: 現在のブランチ

---

## 調査結果

### 1. `iss`クレームの実装状況

#### 1.1 設定場所

**ファイル**: `demos/learning-vci/src/logic/learningCredential.ts`

```typescript
// 70行目
const iss = process.env.CREDENTIAL_ISSUER_IDENTIFIER;
```

`iss`クレームは環境変数 `CREDENTIAL_ISSUER_IDENTIFIER` から取得され、JWTペイロードに含められます（165行目付近）:

```typescript
const claims: Record<string, unknown> = {
  // ... その他のクレーム ...
  iss,
  iat,
  exp,
  vct,
  cnf,
  // ... credential-specific claims ...
};
```

#### 1.2 環境変数の設定

**ファイル**: `.env.sample`

```
CREDENTIAL_ISSUER=http://localhost:3002
CREDENTIAL_ISSUER_IDENTIFIER=http://localhost:3002
```

2つの環境変数が分離管理されている:
- `CREDENTIAL_ISSUER`: メタデータ用（Credential Issuer URL）
- `CREDENTIAL_ISSUER_IDENTIFIER`: `iss`クレーム用の値

#### 1.3 SD-JWTでの`iss`クレームの扱い

**ファイル**: `/Users/ryousuke/repositories/ownd/tool-box/src/sd-jwt/issue.ts`

`iss`クレームは `AlwaysDisclosedClaimNames` に含まれており、**常に公開されるクレーム**として扱われる（Selective Disclosure対象外）:

```typescript
export const AlwaysDisclosedClaimNames = [
  "iss",        // ← 常に公開
  "iat",
  "cnf",
  "vct",
  "nbf",
  "exp",
  "aud",
  "jti",
];
```

### 2. テストコードの実装状況

**ファイル**: `/Users/ryousuke/repositories/ownd/tool-box/tests/sd-jwt/issuer.test.ts`

テストケースで`iss`クレームが使用されている（34行目）:

```typescript
iss: "https://issuer.example.com",
```

ts-toolboxのテストで`iss`クレームの検証が行われている。

### 3. 実装状況サマリー

| 項目 | 状態 | 詳細 |
|------|------|------|
| `iss`クレームの設定 | ✅ 実装済み | 環境変数 `CREDENTIAL_ISSUER_IDENTIFIER` から取得 |
| SD-JWT生成時の処理 | ✅ 実装済み | `AlwaysDisclosedClaimNames`に含まれ、常に公開 |
| クレーム構築時の取り扱い | ✅ 実装済み | Selective Disclosure フレームには含まれない |
| 環境変数の分離 | ✅ 実装済み | `CREDENTIAL_ISSUER`と`CREDENTIAL_ISSUER_IDENTIFIER`を分離管理 |
| テストコード | ✅ 実装済み | ts-toolboxのテストで`iss`クレームの検証を確認 |

### 4. 注記

- `iss`クレームはSD-JWT Draft-22の仕様に準拠して、常に公開クレームとして扱われている

---

## 実装: issを入力フォームから設定可能に

### 変更内容

以下のファイルを変更し、`iss`クレームを入力フォームから設定できるようにした:

1. **データベーススキーマ** (`demos/learning-vci/src/store.ts`)
   - `credentialIssuer`カラムを追加（必須項目）
   - `Learner`インターフェースに`credentialIssuer`フィールドを追加
   - 既存DBへのマイグレーション処理を追加

2. **入力フォーム**
   - `demos/learning-vci/views/admin/learner-new.ejs`: 新規登録フォームに`credentialIssuer`フィールドを追加
   - `demos/learning-vci/views/admin/learner-edit.ejs`: 編集フォームに`credentialIssuer`フィールドを追加

3. **ルートハンドラー** (`demos/learning-vci/src/routes/admin/routesHandler.ts`)
   - `credentialIssuer`フィールドのバリデーションを追加（必須項目として検証）
   - `NewLearner`オブジェクトへの`credentialIssuer`の設定を追加

4. **クレデンシャル生成ロジック** (`demos/learning-vci/src/logic/learningCredential.ts`)
   - 環境変数`CREDENTIAL_ISSUER_IDENTIFIER`の代わりに、学習者登録時に入力された`credentialIssuer`を使用

5. **ローカライゼーション**
   - `demos/learning-vci/locales/ja/learners.json`: 日本語翻訳を追加
   - `demos/learning-vci/locales/en/learners.json`: 英語翻訳を追加

### 使用方法

学習者の新規登録・編集フォームで「クレデンシャル発行者 (iss)」フィールドにURLを入力する（必須項目）。
入力されたURLがSD-JWTの`iss`クレームとして使用される。
