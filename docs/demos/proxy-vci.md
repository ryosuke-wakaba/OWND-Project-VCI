# proxy-vci

プロキシ型のVCIデモ。外部認証と連携してCredentialを発行。

## 機能
- 外部認証連携
- ID Credential発行

## 主要ファイル
- `src/auth.ts` - 認証処理
- `src/logic/identityCredential.ts` - ID Credential発行
- `src/routes/vci/` - OID4VCIエンドポイント
