# Demos

本ライブラリを使用したデモアプリケーション群。

## 一覧

| デモ | 概要 | 状態 |
|------|------|------|
| [common](./common.md) | デモ共通モジュール | 有効 |
| [employee-vci](./employee-vci.md) | 従業員証明書VCI | 有効 |
| [event-certificate-manager](./event-certificate-manager.md) | イベント証明書管理（VCI + VP） | メンテナンス対象外 |
| [participation-cert-vci](./participation-cert-vci.md) | 参加証明書VCI | メンテナンス対象外 |
| [proxy-vci](./proxy-vci.md) | プロキシVCI | メンテナンス対象外 |

## 共通構成

各デモは以下の構成を持つ:

```
demos/<name>/
├── src/
│   ├── app.ts              # Expressアプリ
│   ├── index.ts            # エントリポイント
│   ├── store.ts            # データストア
│   ├── routes/
│   │   ├── admin/          # 管理API
│   │   └── vci/            # OID4VCIエンドポイント
│   └── logic/              # ビジネスロジック
└── tests/
```
