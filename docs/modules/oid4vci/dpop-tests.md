# DPoP テストケース

本ドキュメントでは、DPoP（Demonstrating Proof of Possession）モジュールのテストケースについて説明する。

テストコードは [`tests/oid4vci/dpop`](../../../tests/oid4vci/dpop) ディレクトリに配置されている。

## テストファイル構成

| ファイル | 説明 |
|----------|------|
| [`validateDpopProof.test.ts`](../../../tests/oid4vci/dpop/validateDpopProof.test.ts) | DPoP Proof検証テスト |
| [`utils.test.ts`](../../../tests/oid4vci/dpop/utils.test.ts) | ユーティリティ関数テスト |

## ユーティリティ関数テスト（utils.test.ts）

### JWK Thumbprint 計算（calculateJwkThumbprint）

| テストケース | 検証内容 |
|-------------|---------|
| EC鍵のThumbprint計算 | P-256 EC鍵のThumbprintが正しく計算される（Base64URL形式） |
| 一貫性確認 | 同一鍵に対して常に同じThumbprintが生成される |
| 異なる鍵 | 異なる鍵に対して異なるThumbprintが生成される |

### Access Token ハッシュ計算（calculateAccessTokenHash）

| テストケース | 検証内容 |
|-------------|---------|
| SHA-256ハッシュ | アクセストークンのSHA-256ハッシュが計算される（Base64URL形式） |
| 一貫性確認 | 同一トークンに対して常に同じハッシュが生成される |
| 異なるトークン | 異なるトークンに対して異なるハッシュが生成される |

### URI正規化（normalizeHttpUri）

| テストケース | 検証内容 |
|-------------|---------|
| クエリ文字列削除 | `?query=value` が削除される |
| フラグメント削除 | `#fragment` が削除される |
| 両方削除 | クエリ文字列とフラグメントの両方が削除される |
| scheme/host/path保持 | ポート番号を含むURIが正しく保持される |
| パスなしURI | パスがない場合、`/` が付与される |

### URI比較（compareHttpUri）

| テストケース | 検証内容 |
|-------------|---------|
| 一致するURI | 同一URIで `true` を返す |
| クエリのみ異なる | クエリ文字列のみ異なる場合に `true` を返す |
| フラグメントのみ異なる | フラグメントのみ異なる場合に `true` を返す |
| パスが異なる | パスが異なる場合に `false` を返す |
| ホストが異なる | ホストが異なる場合に `false` を返す |

### 秘密鍵判定（hasPrivateKey）

| テストケース | 検証内容 |
|-------------|---------|
| 秘密鍵あり | 秘密鍵を含むJWKで `true` を返す |
| 公開鍵のみ | 公開鍵のみのJWKで `false` を返す |

### アルゴリズム許可判定（isAllowedAlgorithm）

| テストケース | 検証内容 |
|-------------|---------|
| 許可アルゴリズム | ES256, ES384, ES512, PS256 で `true` を返す |
| none禁止 | `none` アルゴリズムで `false` を返す |
| 対称鍵禁止 | HS256, HS384 などで `false` を返す |
| カスタム許可リスト | 指定したリストに基づいて判定 |

### iat許容範囲判定（isIatWithinTolerance）

| テストケース | 検証内容 |
|-------------|---------|
| 現在時刻 | 現在のタイムスタンプで `true` を返す |
| 許容範囲内 | 許容範囲内の過去/未来のタイムスタンプで `true` を返す |
| 許容範囲外 | 許容範囲外のタイムスタンプで `false` を返す |

## DPoP ヘッダー存在確認テスト（hasDpopHeader）

| テストケース | 検証内容 |
|-------------|---------|
| 空でない文字列 | 非空文字列で `true` を返す |
| 空文字列 | 空文字列で `false` を返す |
| undefined | `undefined` で `false` を返す |
| 要素1つの配列 | 1要素の配列で `true` を返す |
| 空配列 | 空配列で `false` を返す |

## DPoP Proof 検証テスト（validateDpopProof）

### 基本検証

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| ヘッダー欠落 | DPoP ヘッダーが存在しない | `invalid_dpop_proof`, "Missing DPoP header" |
| 複数ヘッダー | DPoP ヘッダーが複数存在 | `invalid_dpop_proof`, "Multiple DPoP headers" |
| 不正なJWT形式 | 形式が不正な文字列 | `invalid_dpop_proof`, "Invalid JWT format" |

### ヘッダー検証

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| 不正なtyp | `typ` が `dpop+jwt` 以外 | `invalid_dpop_proof`, "Invalid typ" |
| alg=none | アルゴリズムが `none` | `invalid_dpop_proof` |
| jwk欠落 | `jwk` ヘッダーが存在しない | `invalid_dpop_proof`, "Missing jwk" |
| jwkに秘密鍵 | `jwk` に秘密鍵が含まれている | `invalid_dpop_proof`, "private key" |

### ペイロード検証

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| htm不一致 | `htm` が HTTPメソッドと不一致 | `invalid_dpop_proof`, "htm mismatch" |
| htu不一致 | `htu` が HTTP URI と不一致 | `invalid_dpop_proof`, "htu mismatch" |
| クエリ文字列無視 | クエリ文字列を除いた `htu` 比較 | `valid: true` |
| iat許容範囲外 | `iat` が許容範囲外 | `invalid_dpop_proof`, "iat" |

### Nonce 検証

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| nonce必須だが欠落 | サーバーnonce要求時に nonce がない | `use_dpop_nonce`, "nonce mismatch" |
| nonce不一致 | nonce がサーバー期待値と不一致 | `use_dpop_nonce` |
| nonce一致 | nonce がサーバー期待値と一致 | `valid: true` |

### Access Token バインディング（ath）

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| ath欠落 | accessToken提供時にathがない | `invalid_dpop_proof`, "Missing ath" |
| athハッシュ不一致 | ath がトークンハッシュと不一致 | `invalid_dpop_proof`, "ath claim does not match" |
| ath一致 | ath がトークンハッシュと一致 | `valid: true` |

### Thumbprint バインディング

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| thumbprint不一致 | jwk の thumbprint が期待値と不一致 | `invalid_dpop_proof`, "does not match" |

### 成功ケース

| テストケース | 検証内容 | 期待結果 |
|-------------|---------|---------|
| 正常なProof | 正しく構成された DPoP Proof の検証 | `valid: true`, thumbprint/header/payload を返す |
| secp256k1鍵 | ES256K アルゴリズムでの検証 | `valid: true` |

## 関連ドキュメント

- [DPoP（Demonstrating Proof of Possession）](./dpop.md) - 機能の詳細説明
