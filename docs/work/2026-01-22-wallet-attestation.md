# Wallet Attestation 対応 作業ドキュメント

## 概要

OID4VCI の Wallet Attestation（クライアント認証）機能を実装する。

### 関連仕様

- [OID4VCI Appendix E - Wallet Attestations in JWT format](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-E)
- [OAuth 2.0 Attestation-Based Client Authentication](https://drafts.oauth.net/draft-ietf-oauth-attestation-based-client-auth/draft-ietf-oauth-attestation-based-client-auth.html)
- [HAIP 4.4.1 - Wallet Attestation](https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0-05.html#name-wallet-attestation)

### 要件（リクエストより）

1. **管理画面**: 「クレデンシャル発行準備」画面に「クライアント認証を要求する」チェックボックスを追加
2. **クレデンシャル発行時**: クライアント認証が有効時、クレデンシャル発行フローの中でクライアント認証を実行する

---

## 作業ブランチ

- **ブランチ名**: `feature/wallet-attestation`
- **派生元**: `develop`

---

## 実装計画

### Phase 1: 型定義・インターフェース設計

| #   | タスク                              | ファイル                                           | 状態 |
| --- | ----------------------------------- | -------------------------------------------------- | ---- |
| 1.1 | ClientAuthentication 型定義を追加   | `src/oid4vci/tokenEndpoint/types.ts`               | [x]  |
| 1.2 | ClientAttestationJwt 型を定義       | `src/oid4vci/clientAuthentication/types.ts` (新規) | [x]  |
| 1.3 | ClientAttestationPopJwt 型を定義    | `src/oid4vci/clientAuthentication/types.ts`        | [x]  |
| 1.4 | ClientAuthenticationConfig 型を定義 | `src/oid4vci/clientAuthentication/types.ts`        | [x]  |

### Phase 2: データベーススキーマ拡張

| #   | タスク                                                     | ファイル                              | 状態         |
| --- | ---------------------------------------------------------- | ------------------------------------- | ------------ |
| 2.1 | auth_codes テーブルに requireClientAuth 列を追加           | `demos/common/src/store/authStore.ts` | [x]          |
| 2.2 | addAuthCode 関数を拡張（requireClientAuth パラメータ追加） | `demos/common/src/store/authStore.ts` | [x]          |
| 2.3 | getAuthCode 関数を拡張（requireClientAuth 返却）           | `demos/common/src/store/authStore.ts` | [x]          |
| 2.4 | trusted_wallet_issuers テーブルを追加（オプション）        | `demos/common/src/store/authStore.ts` | [-] スキップ |

### Phase 3: クライアント認証検証ロジック

| #   | タスク                                                          | ファイル                                                            | 状態 |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------- | ---- |
| 3.1 | Client Attestation JWT 検証関数を実装（x5c ヘッダーで署名検証） | `src/oid4vci/clientAuthentication/validateAttestation.ts` (新規)    | [x]  |
| 3.2 | Client Attestation PoP JWT 検証関数を実装                       | `src/oid4vci/clientAuthentication/validateAttestationPoP.ts` (新規) | [x]  |
| 3.3 | HTTP ヘッダー抽出関数を実装                                     | `src/oid4vci/clientAuthentication/extractHeaders.ts` (新規)         | [x]  |
| 3.4 | 統合検証関数を実装                                              | `src/oid4vci/clientAuthentication/index.ts` (新規)                  | [x]  |

### Phase 4: Token Endpoint 統合

| #   | タスク                                               | ファイル                                   | 状態 |
| --- | ---------------------------------------------------- | ------------------------------------------ | ---- |
| 4.1 | TokenIssuerConfig に clientAuthentication 設定を追加 | `src/oid4vci/tokenEndpoint/types.ts`       | [x]  |
| 4.2 | TokenIssuer.issue()にクライアント認証検証を追加      | `src/oid4vci/tokenEndpoint/TokenIssuer.ts` | [x]  |
| 4.3 | AuthorizedCode に requireClientAuth を追加           | `src/oid4vci/types/types.ts`               | [x]  |

### Phase 5: 管理画面対応

| #   | タスク                                                                      | ファイル                                               | 状態 |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------ | ---- |
| 5.1 | Credential Offer 画面に「クライアント認証を要求する」チェックボックスを追加 | `demos/learning-vci/views/admin/learner-offer.ejs`     | [x]  |
| 5.2 | ルートハンドラでチェックボックス値を処理                                    | `demos/learning-vci/src/routes/admin/routesHandler.ts` | [x]  |
| 5.3 | Credential Offer 表示画面にクライアント認証要件を表示                       | `demos/learning-vci/views/admin/credential-offer.ejs`  | [x]  |

### Phase 6: VCI 設定プロバイダ更新

| #   | タスク                                             | ファイル                                            | 状態 |
| --- | -------------------------------------------------- | --------------------------------------------------- | ---- |
| 6.1 | authCodeStateProvider で requireClientAuth を返却  | `demos/learning-vci/src/logic/vciConfigProvider.ts` | [x]  |
| 6.2 | tokenConfigure()に clientAuthentication 設定を追加 | `demos/learning-vci/src/logic/vciConfigProvider.ts` | [x]  |

### Phase 7: テスト

| #   | タスク                                      | ファイル                                                            | 状態 |
| --- | ------------------------------------------- | ------------------------------------------------------------------- | ---- |
| 7.1 | Client Attestation JWT 検証のユニットテスト | `tests/oid4vci/clientAuthentication/validateAttestation.test.ts`    | [x]  |
| 7.2 | Client Attestation PoP 検証のユニットテスト | `tests/oid4vci/clientAuthentication/validateAttestationPoP.test.ts` | [x]  |
| 7.3 | 統合テスト                                  | `tests/oid4vci/clientAuthentication/clientAuthentication.test.ts`   | [x]  |

### Phase 8: ドキュメント

| #   | タスク                                                   | ファイル                                        | 状態 |
| --- | -------------------------------------------------------- | ----------------------------------------------- | ---- |
| 8.1 | Token Endpoint API 仕様にクライアント認証を追記          | `docs/api/token-endpoint.md`                    | [x]  |
| 8.2 | モジュールドキュメントに clientAuthentication 項目を追加 | `docs/modules/oid4vci/client-authentication.md` | [x]  |
| 8.3 | 管理画面操作手順を更新                                   | `docs/demos/learning-vci.md`                    | [x]  |

---

## テストケース詳細

### テストファイル構成

| ファイル                                                            | 説明                                       |
| ------------------------------------------------------------------- | ------------------------------------------ |
| `tests/oid4vci/clientAuthentication/testUtils.ts`                   | テスト用ユーティリティ（証明書・JWT 生成） |
| `tests/oid4vci/clientAuthentication/validateAttestation.test.ts`    | Client Attestation JWT 検証テスト          |
| `tests/oid4vci/clientAuthentication/validateAttestationPoP.test.ts` | Client Attestation PoP JWT 検証テスト      |
| `tests/oid4vci/clientAuthentication/clientAuthentication.test.ts`   | 統合テスト                                 |

### validateAttestation.test.ts（15 テスト）

| カテゴリ                | テストケース                                              |
| ----------------------- | --------------------------------------------------------- |
| Valid attestation       | 正常な Attestation JWT の検証成功                         |
| Valid attestation       | wallet_name/wallet_link を含む Attestation JWT の検証成功 |
| Invalid typ             | 不正な typ 値の拒否                                       |
| Invalid algorithm       | 許可されていないアルゴリズムの拒否                        |
| Invalid algorithm       | allowedAlgorithms で指定したアルゴリズムの許可            |
| Missing x5c header      | x5c ヘッダーなしの拒否                                    |
| Missing required claims | iss クレームなしの拒否                                    |
| Missing required claims | sub クレームなしの拒否                                    |
| Expiration              | 期限切れ JWT の拒否                                       |
| Not Before (nbf)        | nbf が未来の JWT の拒否                                   |
| Not Before (nbf)        | 有効な nbf の JWT 許可                                    |
| x5c certificate chain   | カスタム x5c バリデータの呼び出し確認                     |
| x5c certificate chain   | x5c バリデータ失敗時の拒否                                |
| Invalid JWT format      | 不正な JWT 形式の拒否                                     |
| Signature verification  | 改ざんされた署名の拒否                                    |

### validateAttestationPoP.test.ts（15 テスト）

| カテゴリ                    | テストケース                             |
| --------------------------- | ---------------------------------------- |
| Valid PoP JWT               | 正常な PoP JWT の検証成功                |
| Invalid typ                 | 不正な typ 値の拒否                      |
| Invalid algorithm           | 許可されていないアルゴリズムの拒否       |
| Issuer (iss) validation     | iss が client_id と一致しない場合の拒否  |
| Audience (aud) validation   | aud が issuer URL と一致しない場合の拒否 |
| Issued At (iat) validation  | iat が許容範囲外（過去）の場合の拒否     |
| Issued At (iat) validation  | iat が許容範囲外（未来）の場合の拒否     |
| Issued At (iat) validation  | iat が許容範囲内の場合の許可             |
| Not Before (nbf) validation | nbf が未来の JWT の拒否                  |
| Challenge validation        | challenge が一致する場合の検証成功       |
| Challenge validation        | challenge が一致しない場合の拒否         |
| JTI replay detection        | jti バリデータの呼び出し確認             |
| JTI replay detection        | 重複 jti（リプレイ攻撃）の拒否           |
| Signature verification      | 不正な鍵で署名された JWT の拒否          |
| Invalid JWT format          | 不正な JWT 形式の拒否                    |

### clientAuthentication.test.ts（15 テスト）

| カテゴリ                        | テストケース                              |
| ------------------------------- | ----------------------------------------- |
| extractClientAttestationHeaders | ヘッダーの正常抽出                        |
| extractClientAttestationHeaders | ヘッダーなしの処理                        |
| extractClientAttestationHeaders | 配列ヘッダーの処理（最初の値を使用）      |
| hasClientAttestationHeaders     | 両ヘッダーありで true                     |
| hasClientAttestationHeaders     | attestation なしで false                  |
| hasClientAttestationHeaders     | attestationPoP なしで false               |
| validateClientAuthentication    | 完全なクライアント認証の検証成功          |
| validateClientAuthentication    | attestation ヘッダーなしの拒否            |
| validateClientAuthentication    | PoP ヘッダーなしの拒否                    |
| validateClientAuthentication    | PoP.iss と Attestation.sub の不一致で拒否 |
| validateClientAuthentication    | 不正な鍵で署名された PoP の拒否           |
| validateClientAuthentication    | カスタム x5c バリデータの検証             |
| validateClientAuthentication    | x5c バリデータ失敗時の拒否                |
| validateClientAuthentication    | jti バリデータの検証                      |
| validateClientAuthentication    | jti リプレイ検出の検証                    |

### テスト実行コマンド

```bash
# 全テスト実行
npm test

# クライアント認証テストのみ実行
npm test -- --grep "Client"
```

---

## アーキテクチャ設計

### 処理フロー（Token Endpoint）

```
Wallet → Token Endpoint
         │
         ├─ 1. DPoP Proof検証（既存）
         │
         ├─ 2. HTTPヘッダー抽出（新規）
         │     ├─ OAuth-Client-Attestation
         │     └─ OAuth-Client-Attestation-PoP
         │
         ├─ 3. Pre-authorized Code検証（既存）
         │     └─ requireClientAuthフラグ取得
         │
         ├─ 4. クライアント認証検証（新規）
         │     ├─ requireClientAuth=true かつ ヘッダー無し → エラー
         │     ├─ Client Attestation JWT検証
         │     │   ├─ typ: "oauth-client-attestation+jwt"
         │     │   ├─ x5cヘッダーから証明書チェーン抽出
         │     │   ├─ 署名検証（x5c[0]の公開鍵で検証）
         │     │   ├─ 証明書チェーン検証（オプション: トラストアンカーまで）
         │     │   ├─ exp検証
         │     │   └─ cnf.jwk抽出
         │     └─ Client Attestation PoP JWT検証
         │         ├─ typ: "oauth-client-attestation-pop+jwt"
         │         ├─ iss = Attestationのsub
         │         ├─ aud = Credential Issuer URL
         │         ├─ 署名検証（cnf.jwkで検証）
         │         └─ jti重複チェック（リプレイ防止）
         │
         └─ 5. Access Token発行（既存）
```

### ディレクトリ構造（新規追加分）

```
src/oid4vci/
├── clientAuthentication/          # 新規モジュール
│   ├── types.ts                   # 型定義
│   ├── validateAttestation.ts     # Attestation JWT検証
│   ├── validateAttestationPoP.ts  # Attestation PoP検証
│   ├── extractHeaders.ts          # ヘッダー抽出
│   └── index.ts                   # 統合検証関数
└── tokenEndpoint/
    ├── types.ts                   # ClientAuthenticationConfig追加
    └── TokenIssuer.ts             # 検証処理追加
```

### データベース拡張

```sql
-- auth_codesテーブルにカラム追加
ALTER TABLE auth_codes ADD COLUMN requireClientAuth BOOLEAN DEFAULT FALSE;

-- オプション: 信頼するWallet Providerの管理（トラストアンカー証明書）
CREATE TABLE trusted_wallet_issuers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issuerUrl VARCHAR(2048) UNIQUE NOT NULL,
  issuerName VARCHAR(255),
  trustAnchorCert TEXT,            -- トラストアンカー証明書（PEM形式）
  active BOOLEAN DEFAULT TRUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 型定義（主要）

```typescript
// Client Attestation JWT Header（HAIP準拠）
interface ClientAttestationJwtHeader {
  typ: "oauth-client-attestation+jwt";
  alg: string;
  x5c: string[]; // 証明書チェーン（Base64 DER形式）- HAIP必須
}

// Client Attestation JWT Payload
interface ClientAttestationJwtPayload {
  iss: string; // Wallet Provider URL
  sub: string; // Wallet client_id
  exp: number;
  nbf?: number;
  iat?: number;
  cnf: {
    jwk: JsonWebKey; // PoP検証用公開鍵
  };
  wallet_name?: string;
  wallet_link?: string;
}

// Client Attestation PoP JWT Header
interface ClientAttestationPopJwtHeader {
  typ: "oauth-client-attestation-pop+jwt";
  alg: string;
}

// Client Attestation PoP JWT Payload
interface ClientAttestationPopJwtPayload {
  iss: string; // = Attestation.sub
  aud: string; // Credential Issuer URL
  jti: string; // リプレイ防止用ID
  iat: number;
  nbf?: number;
  challenge?: string;
}

// TokenIssuerConfig拡張
interface ClientAuthenticationConfig {
  enabled: boolean;
  required?: boolean; // 全リクエストで必須化
  issuerAudience: string; // aud検証用（Credential Issuer URL）
  allowedAlgorithms?: string[]; // 許可する署名アルゴリズム
  iatToleranceSeconds?: number; // iat許容範囲
  x5cValidator?: X5cChainValidator; // 証明書チェーン検証関数（オプション）
}

// x5c証明書チェーン検証関数型
type X5cChainValidator = (
  x5cChain: string[], // Base64 DER形式の証明書チェーン
) => Promise<{ valid: boolean; error?: string }>;
```

---

## HTTP ヘッダー仕様

### リクエスト例

```http
POST /token HTTP/1.1
Content-Type: application/x-www-form-urlencoded
OAuth-Client-Attestation: eyJ0eXAiOiJvYXV0aC1jbGllbnQtYXR0ZXN0YXRpb24...
OAuth-Client-Attestation-PoP: eyJhbGciOiJFUzI1NiIsInR5cCI6Im9hdXRoLWNs...

grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code
&pre-authorized_code=xxx
&tx_code=1234
```

### エラーレスポンス

| エラーコード     | 説明                                  |
| ---------------- | ------------------------------------- |
| `invalid_client` | クライアント認証必須だがヘッダーなし  |
| `invalid_client` | Attestation JWT に x5c ヘッダーがない |
| `invalid_client` | Attestation JWT 署名検証失敗          |
| `invalid_client` | x5c 証明書チェーン検証失敗            |
| `invalid_client` | Attestation PoP 署名検証失敗          |
| `invalid_client` | Attestation 期限切れ                  |

---

## 管理画面仕様

### Credential Offer 画面

「クライアント認証を要求する」チェックボックスを追加:

```html
<div class="form-group">
  <label>
    <input type="checkbox" name="requireClientAuth" value="true" />
    クライアント認証を要求する（Wallet Attestation）
  </label>
  <p class="help-text">
    チェックすると、ウォレットはクレデンシャル発行時にWallet
    Attestationを提示する必要があります。
  </p>
</div>
```

### Credential Offer 表示画面

クライアント認証要件を表示:

```html
<% if (requireClientAuth) { %>
<div class="alert alert-info">
  <strong>クライアント認証:</strong> 必須
  <p>
    このCredential Offerでは、WalletはWallet
    Attestationを提示する必要があります。
  </p>
</div>
<% } %>
```

---

## 備考

### セキュリティ考慮事項

1. **x5c 証明書チェーン検証**: HAIP 仕様に基づき、Client Attestation JWT の`x5c`ヘッダーから公開鍵証明書チェーンを取得し、署名検証に使用
2. **リプレイ攻撃対策**: `jti`（JWT ID）の重複チェック実装
3. **時刻検証**: `exp`, `nbf`, `iat`の適切な検証と許容範囲設定
4. **証明書有効性検証**: x5c チェーン内の証明書の有効期限・失効状態の確認（オプション）

### 既存機能との関係

- **DPoP**: クライアント認証とは独立。両方同時に有効化可能
- **tx_code (PIN)**: クライアント認証とは独立。両方同時に有効化可能

### 今後の拡張

- 信頼する Wallet Provider 管理画面の追加（Phase 2 以降）
- Challenge メカニズムの実装（オプション）

---

## 参考資料

- [作業依頼ドキュメント](../work/requests/2026-01-22-support-wallet-attestation.md)
- [OID4VCI モジュール概要](../modules/oid4vci/README.md)
- [Token Endpoint 実装](../modules/oid4vci/token-issuer.md)
- [DPoP 実装](../modules/oid4vci/dpop.md)（参考パターン）
