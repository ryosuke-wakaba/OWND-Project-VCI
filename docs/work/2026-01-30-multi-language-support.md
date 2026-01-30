# 多言語対応作業

## 概要

learning-vci デモアプリケーションの管理画面を多言語対応にする。

## 作業ブランチ

- `feature/multi-language-support`（派生元: `feature/issuance-status-ui`）

## 対象範囲

### 対象ファイル（EJS テンプレート 16 ファイル）

```
demos/learning-vci/views/
├── layout.ejs                     # 共通レイアウト（ナビゲーション、フッター）
└── admin/
    ├── index.ejs                  # 管理画面トップ
    ├── learners.ejs               # 学習者一覧
    ├── learner-new.ejs            # 学習者新規登録
    ├── learner-edit.ejs           # 学習者編集
    ├── learner-offer.ejs          # Credential Offer 生成
    ├── credential-offer.ejs       # Credential Offer 表示（QR コード）
    ├── issuance-status.ejs        # 発行状況表示
    ├── keys.ejs                   # キーペア一覧
    ├── key-new.ejs                # キーペア新規登録
    ├── key-detail.ejs             # キーペア詳細
    ├── key-import.ejs             # キーペアインポート
    ├── key-certificate.ejs        # 証明書発行
    ├── add-parent-cert.ejs        # 上位証明書追加
    ├── metadata.ejs               # メタデータ管理
    └── wallet-provider-ca.ejs     # Wallet Provider CA 管理
```

### 翻訳対象テキスト数（推定）

| カテゴリ                 | 推定文字列数 |
| ------------------------ | ------------ |
| ナビゲーション・ヘッダー | 15           |
| フォームラベル           | 50+          |
| ボタンラベル             | 25+          |
| テーブルヘッダー         | 40+          |
| ヘルプテキスト           | 30+          |
| ステータス・バッジ       | 20+          |
| 確認ダイアログ           | 10+          |
| エラーメッセージ         | 15+          |
| 空状態メッセージ         | 10+          |
| **合計**                 | **約 280**   |

## 対応言語

1. 日本語（ja）- デフォルト
2. 英語（en）

## 技術選定

### 採用ライブラリ

- **i18next**: JavaScript/Node.js の標準的な国際化ライブラリ
- **i18next-fs-backend**: ファイルシステムからの翻訳データ読み込み

### 選定理由

- Node.js エコシステムで広く採用されている
- Koa との統合が容易
- 名前空間によるファイル分割に対応
- 変数補間、複数形対応などの機能が充実

## 実装方針

### 1. ディレクトリ構成

```
demos/learning-vci/
├── locales/
│   ├── ja/
│   │   ├── common.json           # 共通（ナビ、ボタン、フッター）
│   │   ├── learners.json         # 学習者管理
│   │   ├── keys.json             # キーペア管理
│   │   ├── metadata.json         # メタデータ管理
│   │   └── wallet.json           # Wallet Provider CA
│   └── en/
│       ├── common.json
│       ├── learners.json
│       ├── keys.json
│       ├── metadata.json
│       └── wallet.json
└── src/
    └── i18n.ts                   # i18next 設定
```

### 2. 翻訳キーの命名規則

```json
{
  "nav": {
    "top": "トップ",
    "learners": "学習者管理",
    "keys": "キーペア管理"
  },
  "buttons": {
    "new": "新規登録",
    "edit": "編集",
    "delete": "削除",
    "cancel": "キャンセル",
    "save": "保存"
  },
  "labels": {
    "familyName": "姓",
    "givenName": "名"
  },
  "messages": {
    "confirmDelete": "削除してもよろしいですか？",
    "emptyList": "データがありません"
  }
}
```

### 3. EJS テンプレートでの使用方法

```ejs
<!-- Before -->
<h1>学習者一覧</h1>
<button>新規登録</button>

<!-- After -->
<h1><%= t('learners:title') %></h1>
<button><%= t('common:buttons.new') %></button>
```

### 4. 言語切り替え

ブラウザの Accept-Language ヘッダーに基づいて自動的に言語を検出する。

- 日本語ブラウザ → 日本語表示
- 英語ブラウザ → 英語表示
- その他 → 日本語（フォールバック）

## 作業タスク

### フェーズ 1: インフラ構築

- [x] i18next 関連パッケージのインストール
- [x] i18n.ts 設定ファイルの作成
- [x] Koa ミドルウェアの組み込み
- [x] EJS への翻訳関数（t）の設定

### フェーズ 2: 翻訳ファイル作成（日本語）

- [x] common.json（共通）
- [x] learners.json（学習者管理）
- [x] keys.json（キーペア管理）
- [x] metadata.json（メタデータ管理）
- [x] wallet.json（Wallet Provider CA）

### フェーズ 3: テンプレート修正

- [x] layout.ejs
- [x] admin/index.ejs
- [x] admin/learners.ejs
- [x] admin/learner-new.ejs
- [x] admin/learner-edit.ejs
- [x] admin/learner-offer.ejs
- [x] admin/credential-offer.ejs
- [x] admin/issuance-status.ejs
- [x] admin/keys.ejs
- [x] admin/key-new.ejs
- [x] admin/key-detail.ejs
- [x] admin/key-import.ejs
- [x] admin/key-certificate.ejs
- [x] admin/add-parent-cert.ejs
- [x] admin/metadata.ejs
- [x] admin/wallet-provider-ca.ejs

### フェーズ 4: 英語翻訳

- [x] common.json（英語）
- [x] learners.json（英語）
- [x] keys.json（英語）
- [x] metadata.json（英語）
- [x] wallet.json（英語）

## 進捗状況

| フェーズ                   | 状態   | 完了日     |
| -------------------------- | ------ | ---------- |
| フェーズ 1: インフラ       | 完了   | 2026-01-30 |
| フェーズ 2: 日本語翻訳     | 完了   | 2026-01-30 |
| フェーズ 3: テンプレート修正 | 完了   | 2026-01-30 |
| フェーズ 4: 英語翻訳       | 完了   | 2026-01-30 |

## 参考資料

- [i18next 公式ドキュメント](https://www.i18next.com/)
- [demos/learning-vci ドキュメント](../demos/learning-vci.md)
