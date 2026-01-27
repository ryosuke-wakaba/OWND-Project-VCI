# 作業依頼
## 機能追加

learning-vciデモアプリの「クレデンシャル発行」画面に発行結果を表示する機能を追加してください。

### 要件
- 結果を確認するリンク or ボタンを設ける
- クリックすると当該のauth codeに対する発行結果を表示する
- 表示内容
    - 発行状況
        - 発行要求なし
        - 発行要求なし(期限切れ)
        - 発行要求あり
            - tokenエンドポイントのアクセス結果
            - credentialエンドポイントのアクセス結果
    - 受信内容
        - DPOP JWT
            - tokenエンドポイントに送信されたJWTとそのデコードした内容、および検証結果
            - credentialエンドポイントに送信されたJWTとそのデコードした内容、および検証結果
        - wallet attestationのJWTとそのデコードした内容、および検証結果
        - wallet attestation popのJWTとそのデコードした内容、および検証結果

### 基本情報
- docs/api
- docs/architecture/overview.md
- docs/modules/oid4vci
- docs/demos/common.md
- docs/demos/learning-vci.md
- docs/work/2025-12-24-dpop-implementation.md
- docs/work/2026-01-22-wallet-attestation.md

### ブランチ
- 新しいブランチで対応して下さい。
    - 派生元ブランチ: 現在のブランチ

### 作業ドキュメント
対応内容がまとまったら、まずは進捗が把握できるように作業ドキュメントを作成して下さい。

作業ドキュメントのパスとファイル名の形式

- docs/work/yyyy-mm-dd-xxx.md