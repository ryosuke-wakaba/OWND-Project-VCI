#!/bin/bash
set -e

# ts-toolboxのパス（環境変数またはデフォルト値）
TOOLBOX_PATH="${TOOLBOX_PATH:-/Users/ryousuke/repositories/ownd/tool-box}"

echo "=== ts-toolbox更新スクリプト ==="
echo "TOOLBOX_PATH: $TOOLBOX_PATH"
echo ""

# Step 1: ts-toolboxでnpm pack
echo ">>> Step 1: ts-toolboxパッケージ作成"
cd "$TOOLBOX_PATH"
npm run build
PACK_OUTPUT=$(npm pack 2>&1)
TGZ_FILE=$(echo "$PACK_OUTPUT" | tail -1)
TGZ_PATH="$TOOLBOX_PATH/$TGZ_FILE"
echo "生成: $TGZ_PATH"
echo ""

# Step 2: VCI側でインストール
echo ">>> Step 2: VCIにローカルインストール"
cd - > /dev/null
npm install "$TGZ_PATH"
echo ""

# Step 3: ビルド・テスト
echo ">>> Step 3: VCIビルド・テスト"
npm run build
npm test

echo ""
echo "=== 完了 ==="
