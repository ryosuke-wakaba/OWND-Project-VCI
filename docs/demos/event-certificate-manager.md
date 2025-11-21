# event-certificate-manager

イベント参加証明書の発行・検証を行うフルスタックデモ。

## 構成
- `backend/` - Express API
- `frontend/` - React管理画面

## 機能
- OID4VCI: チケット証明書・参加証明書の発行
- OID4VP: 証明書の検証

## 主要ファイル
### Backend
- `src/oid4vci/` - Credential発行
- `src/oid4vp/` - VP検証
- `src/admin/` - 管理API

### Frontend
- Vite + React
