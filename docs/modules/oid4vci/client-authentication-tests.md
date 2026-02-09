# クライアント認証 テストケース

本ドキュメントでは、クライアント認証（Wallet Attestation）モジュールのテストケースについて説明する。

テストコードは [`tests/oid4vci/clientAuthentication`](../../../tests/oid4vci/clientAuthentication) ディレクトリに配置されている。

## テストファイル構成

| ファイル | 説明 |
|----------|------|
| [`clientAuthentication.test.ts`](../../../tests/oid4vci/clientAuthentication/clientAuthentication.test.ts) | 統合テスト |
| [`validateAttestation.test.ts`](../../../tests/oid4vci/clientAuthentication/validateAttestation.test.ts) | Attestation JWT 検証テスト |
| [`validateAttestationPoP.test.ts`](../../../tests/oid4vci/clientAuthentication/validateAttestationPoP.test.ts) | PoP JWT 検証テスト |
| [`testUtils.ts`](../../../tests/oid4vci/clientAuthentication/testUtils.ts) | テスト用ユーティリティ |

## ヘッダー抽出テスト（extractClientAttestationHeaders）

| テストケース | 検証内容 |
|-------------|---------|
| リクエストからの抽出 | `OAuth-Client-Attestation` および `OAuth-Client-Attestation-PoP` ヘッダーの正常抽出 |
| 欠落ヘッダーの処理 | ヘッダーが存在しない場合に `undefined` を返す |
| 配列ヘッダーの処理 | 配列形式のヘッダーから最初の値を使用 |

## ヘッダー存在確認テスト（hasClientAttestationHeaders）

| テストケース | 検証内容 |
|-------------|---------|
| 両ヘッダー存在 | `attestation` と `attestationPoP` の両方が存在する場合に `true` を返す |
| attestation欠落 | `attestation` が欠落している場合に `false` を返す |
| attestationPoP欠落 | `attestationPoP` が欠落している場合に `false` を返す |

## 統合検証テスト（validateClientAuthentication）

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| 完全な認証 | 正しい Attestation + PoP JWT の検証 | `valid: true`, clientId/walletProvider を返す |
| attestationヘッダー欠落 | Attestation JWT が欠落 | `invalid_client`, "Missing client authentication headers" |
| PoPヘッダー欠落 | PoP JWT が欠落 | `invalid_client`, "Missing client authentication headers" |
| iss/sub不一致 | PoP の `iss` が Attestation の `sub` と不一致 | `invalid_client`, "iss mismatch" |
| 署名鍵不一致 | PoP が異なる鍵で署名されている | `invalid_client`, "signature" |
| カスタムx5cバリデータ（成功） | x5c 証明書チェーンのカスタム検証 | バリデータが呼び出され、検証成功 |
| カスタムx5cバリデータ（失敗） | x5c 検証で拒否 | `invalid_client`, カスタムエラーメッセージ |
| JTIリプレイ検出 | 同一 JTI の再利用を検出 | 初回成功、2回目は "replay" エラー |

## Attestation JWT 検証テスト（validateClientAttestationJwt）

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| 正常な Attestation | 正しく構成された JWT の検証 | `valid: true`, ペイロードクレームの抽出 |
| オプションクレーム | `wallet_name`, `wallet_link` の検証 | オプションクレームが正しく抽出される |
| 不正な typ | `typ` が `oauth-client-attestation+jwt` 以外 | `invalid_client`, "Invalid typ" |
| 不正なアルゴリズム | 許可リストにないアルゴリズム | `invalid_client`, "algorithm" |
| x5c 欠落 | `x5c` ヘッダーが存在しない | `invalid_client`, "x5c" |
| iss 欠落 | `iss` クレームが空 | `invalid_client`, "iss" |
| sub 欠落 | `sub` クレームが空 | `invalid_client`, "sub" |
| 期限切れ | `exp` が過去の時刻 | `invalid_client`, "expired" または "exp" |
| nbf 未到来 | `nbf` が未来の時刻 | `invalid_client`, "not yet valid" または "nbf" |
| カスタムx5cバリデータ | 証明書チェーンの検証呼び出し | バリデータに x5c チェーンが渡される |
| x5cバリデータ拒否 | バリデータが invalid を返す | `invalid_client`, カスタムエラーメッセージ |
| 不正なJWT形式 | 形式が不正な文字列 | `invalid_client`, "Invalid JWT format" |
| 空文字列 | 空のJWT | `invalid_client` |
| 署名改ざん | 署名部分が改ざんされた JWT | `invalid_client`, "signature" |

## PoP JWT 検証テスト（validateClientAttestationPoP）

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| 正常な PoP | 正しく構成された PoP JWT の検証 | `valid: true`, ペイロードクレームの抽出 |
| 不正な typ | `typ` が `oauth-client-attestation-pop+jwt` 以外 | `invalid_client`, "Invalid typ" |
| 不正なアルゴリズム | 許可リストにないアルゴリズム | `invalid_client`, "algorithm" |
| iss 不一致 | `iss` が期待値と不一致 | `invalid_client`, "iss mismatch" |
| aud 不一致 | `aud` が期待値と不一致 | `invalid_client`, "aud mismatch" |
| iat 過去（許容範囲外） | `iat` が許容範囲より過去 | `invalid_client`, "iat is outside acceptable range" |
| iat 未来（許容範囲外） | `iat` が許容範囲より未来 | `invalid_client`, "iat is outside acceptable range" |
| iat 許容範囲内 | `iat` が許容範囲内 | `valid: true` |
| nbf 未到来 | `nbf` が未来の時刻 | `invalid_client`, "not yet valid" または "nbf" |
| challenge 検証（成功） | `challenge` クレームの一致 | `valid: true` |
| challenge 不一致 | `challenge` が期待値と不一致 | `invalid_client`, "challenge mismatch" |
| JTI バリデータ呼び出し | `jtiValidator` の呼び出し確認 | バリデータに jti が渡される |
| JTI リプレイ | `jtiValidator` が false を返す | `invalid_client`, "replay" |
| 署名鍵不一致 | 異なる鍵で署名された JWT | `invalid_client`, "signature" |
| 不正なJWT形式 | 形式が不正な文字列 | `invalid_client`, "Invalid JWT format" |

## テストユーティリティ

テストでは以下のユーティリティ関数を使用している。

| 関数 | 説明 |
|------|------|
| `generateTestKeyPair()` | x5c 証明書チェーンを含むテスト用鍵ペアを生成 |
| `generatePopKeyPair()` | PoP JWT 署名用の鍵ペアを生成 |
| `createTestAttestationJwt()` | テスト用 Attestation JWT を生成 |
| `createTestAttestationPopJwt()` | テスト用 PoP JWT を生成 |

## 関連ドキュメント

- [クライアント認証（Wallet Attestation）](./client-authentication.md) - 機能の詳細説明
