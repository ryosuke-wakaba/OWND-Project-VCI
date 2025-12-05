# OID4VCI Issuer - デプロイメントガイド

## 概要

このドキュメントでは、OID4VCI Issuerシステムのデプロイメント手順について説明します。

## デプロイ方法

デプロイ方法は環境により異なります。以下のオプションから選択してください：

- **直接実行**: `NODE_ENV=prod npm start`
- **PM2**: Node.jsプロセス管理ツールを使用
- **Docker**: コンテナ化してデプロイ
- **AWS CodeDeploy**: AWS EC2へのCI/CDデプロイ（後述）
- **その他**: Kubernetes、AWS ECS等のコンテナオーケストレーション

## AWS CodeDeployを使用したデプロイ

AWS環境へのCI/CDデプロイについて説明します。

### アーキテクチャ

```
GitHub Actions (Build) → S3 (Artifact) → CodePipeline → CodeDeploy → EC2 (PM2)
```

### デプロイ前提条件

- AWS アカウント
- GitHub リポジトリ
- 以下の AWS リソース（Terraform で構築済み）:
  - EC2 インスタンス（CodeDeploy Agent 導入済み）
  - S3 バケット（アーティファクト保存用）
  - CodePipeline パイプライン
  - CodeDeploy アプリケーション・デプロイグループ
  - IAM ロール（GitHub Actions 用 OIDC、CodeDeploy 用）
  - SSM Parameter Store（環境変数管理）
  - CloudWatch Logs（ログ管理）

### デプロイフロー

1. **GitHub Actions でビルド** (`.github/workflows/deploy.yml`)
   - `develop` ブランチへの push をトリガー
   - 依存関係インストール (`yarn install`)
   - TypeScript ビルド (`yarn build`)
   - ソースコードを zip 圧縮
   - S3 バケットにアップロード
   - CodePipeline を手動トリガー

2. **CodePipeline の実行**
   - S3 からアーティファクトを取得
   - CodeDeploy にデプロイ指示

3. **CodeDeploy によるデプロイ** (`appspec.yml`)
   - **ApplicationStop**: 既存の PM2 プロセスを停止
   - **BeforeInstall**: アプリケーションディレクトリのクリーンアップ
   - **Install**: ソースコードを `/opt/app/` に展開
   - **AfterInstall**:
     - 依存関係インストール
     - TypeScript ビルド
     - AWS リージョンの取得
     - S3 から証明書ファイルのダウンロード
     - SSM Parameter Store から環境変数を取得して `.env` 生成
   - **ApplicationStart**: PM2 で Node.js アプリケーションを起動

### 重要な設定ポイント

#### 1. GitHub Actions のブランチ設定

`develop` ブランチへの push のみデプロイされるよう設定します。

`.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches:
      - develop
```

#### 2. PM2 の実行ユーザー

PM2 は `ec2-user` として実行し、ログファイルへの書き込み権限を確保します。

`codedeploy/scripts/application_start.sh`:

```bash
# Ensure log directory exists with correct permissions
mkdir -p /var/log/pm2
chown -R ec2-user:ec2-user /var/log/pm2

# Start application with pm2 as ec2-user
sudo -u ec2-user bash -c 'cd /opt/app && pm2 start yarn --name issuer --output /var/log/pm2/out.log --error /var/log/pm2/error.log -- start'

# Save pm2 process list
sudo -u ec2-user pm2 save
```

#### 3. SSM Parameter Store による環境変数管理

環境変数は SSM Parameter Store で一元管理され、デプロイ時に自動的に取得されます。

パス: `/ownd-eujp/experiment/issuer/*`

例:

- `/ownd-eujp/experiment/issuer/CREDENTIAL_ISSUER_IDENTIFIER`
- `/ownd-eujp/experiment/issuer/DATABASE_FILEPATH`
- `/ownd-eujp/experiment/issuer/BASIC_AUTH_USERNAME`
- `/ownd-eujp/experiment/issuer/BASIC_AUTH_PASSWORD` (SecureString)

#### 4. 証明書ファイルの配置

デプロイ時に S3 から証明書ファイルが自動的にダウンロードされます。

S3 バケット: `ownd-eujp-experiment-certificates`
プレフィックス: `issuer/`

配置先: `/opt/app/certificates/`

必要なファイル:

- `ec_private.key` - EC 秘密鍵
- `issuer.cer` - 証明書
- `trust-anchors/*.cer` - Trust Anchor 証明書

### ログ確認

デプロイ後のログは CloudWatch Logs で確認できます:

```bash
# アプリケーションログ
aws logs tail /app/ownd-eujp-experiment/issuer --follow --profile OWND-Project-EU_JP

# システムログ
aws logs tail /system/ownd-eujp-experiment/issuer --follow --profile OWND-Project-EU_JP
```

### トラブルシューティング

#### PM2 プロセスが起動しない

```bash
# EC2 にアクセスして PM2 の状態確認
sudo -u ec2-user pm2 list
sudo -u ec2-user pm2 logs issuer

# ログディレクトリの権限確認
ls -la /var/log/pm2
```

#### .env ファイルが見つからない

SSM Parameter Store からの環境変数取得が失敗している可能性があります。

```bash
# SSM Parameter Store の確認
aws ssm get-parameters-by-path \
  --path /ownd-eujp/experiment/issuer \
  --with-decryption \
  --region ap-northeast-1 \
  --profile OWND-Project-EU_JP
```

#### CodeDeploy Agent が停止している

```bash
# EC2 で CodeDeploy Agent の状態確認
sudo systemctl status codedeploy-agent

# 起動
sudo systemctl start codedeploy-agent
sudo systemctl enable codedeploy-agent
```

#### 証明書ファイルが見つからない

```bash
# 証明書ファイルの確認
ls -la /opt/app/certificates/

# S3 から手動ダウンロード
aws s3 cp s3://ownd-eujp-experiment-certificates/issuer/ /opt/app/certificates/ \
  --recursive \
  --region ap-northeast-1
```

### デプロイ後の確認

1. **ヘルスチェック（OID4VCI Well-Known エンドポイント）**

   ```bash
   curl -I https://issuer.eujp.ownd-project.com/.well-known/openid-credential-issuer
   # Expected: HTTP/1.1 200 OK
   ```

2. **OAuth Authorization Server メタデータ**

   ```bash
   curl -I https://issuer.eujp.ownd-project.com/.well-known/oauth-authorization-server
   # Expected: HTTP/1.1 200 OK
   ```

3. **Target Group の状態**

   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn <target-group-arn> \
     --profile OWND-Project-EU_JP
   # Expected: State: healthy
   ```

## 運用上の考慮事項

### データベース管理

- SQLiteデータベースの定期バックアップを推奨
- 期限切れレコードの定期クリーンアップを実装
- WALモードの有効化を推奨（`PRAGMA journal_mode=WAL`）

### セキュリティ

- 本番環境では必ずHTTPSを使用
- Basic認証の認証情報は SSM Parameter Store の SecureString で管理
- X.509証明書の有効期限管理
- 必要なポートのみ開放
- 依存パッケージの定期的なセキュリティアップデート

### 監視

- ヘルスチェックエンドポイント（`.well-known/openid-credential-issuer`）の監視
- アプリケーションログの監視（CloudWatch Logs）
- メモリ使用量の監視（CloudWatch Metrics）
- ALB Target Group の健全性監視

## まとめ

OID4VCI Issuerは単一ノード構成のため、デプロイが簡単です：

- **シンプルな構成**: 1つのNode.jsプロセスとSQLite
- **スケーラビリティ**: 必要に応じて水平スケール可能
- **柔軟性**: 様々なデプロイ環境に対応可能

本番環境では、HTTPS、適切な証明書管理、定期的なバックアップを必ず実施してください。
