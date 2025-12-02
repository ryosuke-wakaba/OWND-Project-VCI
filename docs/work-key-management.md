# 作業ドキュメント: キーペア管理画面の追加

## 概要
Learning VCI管理画面にIssuerキーペア管理機能を追加し、クレデンシャル発行時に署名鍵を選択可能にする。

## 作業状況

| フェーズ | 状態 |
|---------|------|
| Phase 1: API拡張 | 完了 |
| Phase 2: 鍵管理UI | 完了 |
| Phase 3: クレデンシャル発行強化 | 完了 |

---

## Phase 1: API拡張

### 1.1 鍵一覧取得API
- [ ] `GET /admin/keys` - 全鍵一覧取得
- 場所: `demos/common/src/routes/admin/`
- keyStoreに`getAllKeyPairs()`関数追加

### 1.2 鍵・証明書インポートAPI
- [ ] `POST /admin/keys/import` - PEM形式の秘密鍵+証明書インポート
- 対応フォーマット:
  - EC秘密鍵: `-----BEGIN EC PRIVATE KEY-----`
  - X.509証明書: `-----BEGIN CERTIFICATE-----`
- 参考ファイル: `/Users/ryousuke/repositories/ownd/ipa2025/Certificate/`

### 1.3 リーフ証明書発行API
- [ ] `POST /admin/keys/:kid/signleafcert` - ルート証明書からリーフ証明書発行
- リクエスト: `{ csr: string, issuerKid: string }`
- ts-toolboxの証明書発行機能を使用

---

## Phase 2: 鍵管理UI

### 2.1 鍵一覧画面
- [ ] `/admin/keys` - 登録済み鍵の一覧
- 表示項目: kid, curve, 作成日, 証明書有無, 状態（有効/失効）
- ビューファイル: `views/admin/keys.ejs`

### 2.2 鍵詳細画面
- [ ] `/admin/keys/:kid` - 鍵詳細表示
- 表示項目:
  - 公開鍵情報（JWK形式）
  - X.509証明書（PEM形式）
  - 証明書の発行者情報（Subject, Issuer, 有効期限）
- ビューファイル: `views/admin/key-detail.ejs`

### 2.3 鍵新規登録画面
- [ ] `/admin/keys/new` - 鍵生成フォーム
- 入力項目: kid, curve（P-256/secp256k1）
- ビューファイル: `views/admin/key-new.ejs`

### 2.4 証明書発行画面
- [ ] `/admin/keys/:kid/certificate` - 証明書発行フォーム
- 機能:
  - CSR生成（Subject入力）
  - 自己署名証明書発行（ルート証明書として）
  - リーフ証明書発行（発行元ルート証明書を選択）
- ビューファイル: `views/admin/key-certificate.ejs`

### 2.5 鍵・証明書インポート画面
- [ ] `/admin/keys/import` - インポートフォーム
- 入力項目:
  - kid（鍵識別子）
  - 秘密鍵（PEMテキストまたはファイル）
  - 証明書チェーン（PEMテキストまたはファイル、オプション）
- ビューファイル: `views/admin/key-import.ejs`

### 2.6 ナビゲーション更新
- [ ] レイアウトにキーペア管理へのリンク追加
- ファイル: `views/layout.ejs`

---

## Phase 3: クレデンシャル発行強化

### 3.1 署名鍵選択機能
- [ ] クレデンシャル発行画面に署名鍵選択ドロップダウン追加
- ファイル: `views/admin/credential-offer.ejs` または `views/admin/learner-edit.ejs`

### 3.2 発行ロジック修正
- [ ] `src/logic/learningCredential.ts` 修正
  - 指定された鍵で発行
  - 証明書ありの場合: x5c方式
  - 証明書なしの場合: jwk方式（ヘッダーにjwk追加）

### 3.3 データモデル拡張（必要に応じて）
- [ ] learnersテーブルに署名鍵指定カラム追加（オプション）
- または発行時にパラメータで指定

---

## ファイル構成（予定）

```
demos/common/src/
├── store/
│   └── keyStore.ts          # getAllKeyPairs追加
├── keys.ts                   # importKey, signLeafCert追加
└── routes/admin/
    ├── routes.ts             # 新規エンドポイント追加
    └── routesHandler.ts      # ハンドラ追加

demos/learning-vci/
├── src/
│   ├── logic/
│   │   └── learningCredential.ts  # 発行ロジック修正
│   └── routes/admin/
│       ├── routes.ts              # UI用ルート追加
│       └── routesHandler.ts       # UIハンドラ追加
└── views/admin/
    ├── keys.ejs                   # 鍵一覧
    ├── key-detail.ejs             # 鍵詳細
    ├── key-new.ejs                # 鍵新規登録
    ├── key-certificate.ejs        # 証明書発行
    └── key-import.ejs             # インポート
```

---

## 技術メモ

### PEM→JWK変換
- ts-toolboxまたはjoseライブラリを使用
- EC秘密鍵のPEM形式をJWKに変換

### 証明書解析
- ts-toolboxの証明書解析機能を使用
- Subject, Issuer, 有効期限の抽出

### jwk方式での発行
```typescript
// x5c方式（現在）
header: { alg: "ES256", x5c: [...] }

// jwk方式（追加）
header: { alg: "ES256", jwk: { kty, crv, x, y } }
```

---

## 参考資料
- [common.md](./demos/common.md) - 共通モジュール仕様
- [learning-vci.md](./demos/learning-vci.md) - Learning VCI仕様
- [oid4vci.md](./modules/oid4vci.md) - OID4VCIモジュール仕様
