# 作業依頼
## 機能追加
- docs/work/2026-01-23-wallet-provider-ca-management.md

こちらのドキュメントで対応した機能について、

1. CAではなくCAが発行した証明書をインポートする機能を追加してください。
    - １インポートで１証明書
    - インポートは何階でも可能
2. そして、こちらでインポートした証明書をwallet attestationの検証時、x5cに格納されている証明書が同じであることをチェック処理として追加してください。

    一致の条件: お互いの公開鍵が同一であることです。

### 基本情報
- docs/api
- docs/architecture/overview.md
- docs/modules/oid4vci
- docs/demos/common.md
- docs/demos/learning-vci.md

### ブランチ
- 新しいブランチで対応して下さい。
    - 派生元ブランチ: 現在のブランチ

### 作業ドキュメント
対応内容がまとまったら、まずは進捗が把握できるように作業ドキュメントを作成して下さい。

作業ドキュメントのパスとファイル名の形式

- docs/work/yyyy-mm-dd-xxx.md