# 有効期限フィールドを任意入力に変更

## 概要

教育クレデンシャルの学習者登録フォームにおいて、有効期限（`date_of_expiry`）を任意入力に変更する。

## 背景

- v1.02仕様では`date_of_expiry`はオプションフィールドとして定義されている
- ストア層では既にオプショナル（`dateOfExpiry?: string`）として実装済み
- フォームの`required`属性のみが必須入力を強制している

## 変更対象

| ファイル | 変更内容 |
|----------|----------|
| `demos/learning-vci/views/admin/learner-new.ejs` | `dateOfExpiry`から`required`属性と`*`を削除 |
| `demos/learning-vci/views/admin/learner-edit.ejs` | `dateOfExpiry`から`required`属性と`*`を削除 |

## 進捗

- [x] ブランチ作成: `feature/optional-date-of-expiry`
- [x] learner-new.ejs 修正
- [x] learner-edit.ejs 修正
- [x] ビルド確認
- [x] コミット

## コミット履歴

- bbc9cf8 Make date of expiry field optional in learner registration form
