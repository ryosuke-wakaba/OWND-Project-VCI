# 作業依頼
## 機能変更

- docs/work/2025-12-24-dpop-implementation.md

こちらの対応で追加したDPOPに関する設定ですが、環境変数の対応をやめて、UI上で切り替え可能としてください。

### 現在使用している環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `DPOP_ENABLED` | DPoPサポートを有効化 | `false` |
| `DPOP_REQUIRED` | DPoPを必須化 | `false` |

根本的に無効にする要件は不要なので、DPOP_ENABLEDによる制御に相当する部分はなくしてください。常に有効という前提でOKです。

クレデンシャル発行単位で、必須にするか否かが選択できればOKです。

### 参考機能
- docs/work/2026-01-22-wallet-attestation.md

こちらの対応で追加した「管理画面仕様」を参考にしてください。

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