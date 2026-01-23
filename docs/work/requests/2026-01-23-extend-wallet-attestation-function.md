# 作業依頼
## 機能追加

- docs/work/2026-01-22-wallet-attestation.md

こちらの作業ドキュメントで対応した内容の拡張作業です。

### 要件
- learning-vciの管理画面に「Wallet Provider CA管理」タブを追加してください。
    - タブで表示した画面で以下を実現できる
        - Wallete Providerの証明書を発行したCAのルート証明書をテキストとしてインポートできる
        - クライアント認証の際、x5cで取り出したwallet providerの証明書とルートCAの証明書のチェーンを検証するかをチェックボックスで設定で切り替えができる
        - チェーン検証に関係する実装は以下のConfigを使用する

            ```
            // TokenIssuerConfig拡張
            interface ClientAuthenticationConfig {
            enabled: boolean;
            required?: boolean; // 全リクエストで必須化
            issuerAudience: string; // aud検証用（Credential Issuer URL）
            allowedAlgorithms?: string[]; // 許可する署名アルゴリズム
            iatToleranceSeconds?: number; // iat許容範囲
            x5cValidator?: X5cChainValidator; // 証明書チェーン検証関数（オプション）
            }
            ```

### 基本情報
- docs/api
- docs/architecture/overview.md
- docs/modules/oid4vci
- docs/demos/common.md
- docs/demos/learning-vci.md

### ブランチ
- 現在のブランチで対応して下さい。

### 作業ドキュメント
対応内容がまとまったら、まずは進捗が把握できるように作業ドキュメントを作成して下さい。

作業ドキュメントのパスとファイル名の形式

- docs/work/yyyy-mm-dd-xxx.md