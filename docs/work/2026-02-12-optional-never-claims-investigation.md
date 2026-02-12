# オプション入力かつ選択開示不可(Never)クレームの調査

## 概要

教育クレデンシャルに含めるクレームの中で、選択開示不可(Never)のもので、入力がオプションのものが現在の実装でSD-JWTにどう含まれるか、また本来どう含まれるべきかを調査した。

## 調査対象

### 該当クレーム

v1.02仕様において、SD(Selective Disclosure): **Never** かつ **オプション** のフィールド:

| フィールド名 | 型 | SD | 入力 | 説明 |
|-------------|------|------|------|------|
| `date_of_expiry` | string | Never | Optional | 有効期限 (YYYY-MM-DD) |
| `achievement_description` | string | Never | Optional | 実績の説明 |

**参照**: `docs/demos/learning-vci.md`

---

## 現在の実装

### ファイル: `demos/learning-vci/src/logic/learningCredential.ts:149-157`

```typescript
const claims: Record<string, unknown> = {
  // Required fields
  issuing_authority: issuingAuthority,
  issuing_country: issuingCountry,
  date_of_issuance: dateOfIssuance,
  // ...

  // Optional fields
  ...(achievementDescription && {
    achievement_description: achievementDescription,
  }),
  ...(dateOfExpiry && { date_of_expiry: dateOfExpiry }),
  // ...
};
```

### 現在の動作

| 値の状態 | 動作 |
|---------|------|
| 値あり | クレームがJWTペイロードに**直接含まれる**（`_sd`配列外） |
| 値なし（空/null/undefined） | クレームが**省略される**（JWTに含まれない） |

### Disclosure Frame設定

```typescript
const selectivelyDisclosableClaims = [
  "family_name",
  "given_name",
  "learning_outcomes",
  "assessment_grade",
  "learner_identification",
  "expected_study_time",
  "level_of_learning_experience",
  "types_of_quality_assurance",
  "prerequisites_to_enroll",
  "integration_stackability_options",
];
// date_of_expiryとachievement_descriptionは含まれていない
// → _sd配列に入らず、JWTペイロードに直接含まれる
```

---

## 仕様調査

### 1. SD-JWT仕様 (RFC 9901)

**参照**: https://datatracker.ietf.org/doc/rfc9901/

> "Claims that are not selectively disclosable are included in the SD-JWT in plaintext just as they would be in any other JSON structure."

**解釈**: SD: Neverのクレームは通常のJSON構造と同様に扱う。オプショナルなクレームを省略することは通常のJSON慣例に従う。

### 2. SD-JWT VC仕様 (draft-ietf-oauth-sd-jwt-vc)

**参照**: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-sd-jwt-vc-13

- クレームメタデータに `mandatory` プロパティがあり、`false`（デフォルト）の場合はオプショナル
- **値がない場合の具体的な処理については明確な規定なし**
- 個別のエコシステムや実装によって定義されると想定

### 3. 過去の関連調査

**参照**: `docs/work/2025-12-05-sd-jwt-disclosure-frame-fix.md`

この調査で確認された事項:
- SD: Neverのクレームは `_sd` 配列に入れず、JWTペイロードに直接含める（**現在は正しく実装済み**）
- 仕様: "Claims that are not selectively disclosable are included in the SD-JWT in plaintext"

---

## 分析

### SD: Neverの意味

1. **選択開示の禁止**: このクレームはHolder（ウォレット）が開示/非開示を選択できない
2. **常時表示**: クレームが存在する場合、Verifierには常に見える
3. **存在の保証ではない**: 「クレームが必ず存在する」という意味ではない

### Optionalの意味

1. **入力任意**: 発行時にこのクレームの値は必須ではない
2. **省略可能**: 値がない場合、クレーム自体を含めなくてもよい

### 組み合わせの解釈

**SD: Never + Optional** の場合:
- 値が**ある**場合: JWTペイロードに直接含め、常にVerifierに表示
- 値が**ない**場合: クレームを省略（JWTに含めない）

---

## プレゼンテーション時の問題点

### 問題の概要

現在の実装では、`date_of_expiry`が未入力の場合、クレームがSD-JWTに含まれない。これにより、**Verifierが有効期限を要求するシステムに対して、無期限のクレデンシャルを提示できない**という問題が発生する可能性がある。

### 技術的背景

**DCQL（Digital Credentials Query Language）の仕様**:
- [OpenID4VP Issue #440](https://github.com/openid/OpenID4VP/issues/440)で議論されているように、DCQLではクレームレベルでのオプション性は意図的に導入されていない
- Verifierが特定のクレームを要求した場合、そのクレームが存在しないとプレゼンテーションが失敗する

**シナリオ例**:
1. Verifierが`date_of_expiry`クレームを要求
2. ユーザーのクレデンシャルは「無期限」（`date_of_expiry`未設定）
3. クレームが存在しないためリクエストに応えられない
4. ユーザーはクレデンシャルを提示できない

### 解決策の選択肢

| 選択肢 | 実装 | メリット | デメリット |
|--------|------|----------|------------|
| **1. 現状維持（省略）** | クレームを含めない | 仕様に準拠 | Verifier要求に応えられない |
| **2. 空文字列** | `""` | クレームは存在する | 日付フォーマットとして不正 |
| **3. null値** | `null` | JSONとして有効、「値なし」を明示 | SD-JWTでの扱いが不明瞭 |
| **4. 遠い未来の日付** | `"9999-12-31"` | 日付フォーマット準拠 | 意味的に正確でない |
| **5. 特別な文字列** | `"indefinite"` | 意図が明確 | 日付フォーマットから逸脱 |

### 追加調査結果

**SD-JWT VC仕様（draft-14）**:
- JWTの`exp`クレームはオプションと明記されている
- ただし、`date_of_expiry`はEUDI Learning Credentialのデータモデル固有のクレーム（JWTの`exp`とは別）
- null値の扱いについては言及なし

**参照**: [SD-JWT VC draft-14](https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/)

---

## 結論

### SD: Neverの処理は正しい

現在の実装は以下の点で適切:

1. **SD: Neverの処理**: `date_of_expiry`と`achievement_description`は`selectivelyDisclosableClaims`に含まれておらず、`_sd`配列に入らない ✓
2. **値がある場合の処理**: JWTペイロードに直接含まれる ✓

### Optionalクレームの省略には課題あり

現在の実装の問題点:

1. **クレーム省略時の問題**: Verifierが`date_of_expiry`を要求するシステムに対して、無期限クレデンシャルを提示できない
2. **相互運用性の懸念**: 異なるVerifier実装との互換性問題が発生する可能性

### 対応方針: null値を使用

プレゼンテーション時の相互運用性を確保するため、**null値を使用**する方針とした。

**根拠**:
- RFC 9901: 「通常のJSON構造と同様に扱う」→ JSONではnullは有効な値
- SD-JWT VCドラフト仕様: null値の使用について明示的な禁止規定なし
- クレームが存在することでVerifierの要求に応えられる

---

## 実装

### 修正内容

**ファイル**: `demos/learning-vci/src/logic/learningCredential.ts`

すべてのオプションフィールドを常にnullで含めるように変更。

```typescript
// Before: 値がない場合は省略
...(givenName && { given_name: givenName }),
...(dateOfExpiry && { date_of_expiry: dateOfExpiry }),
// ...

// After: 常に含める（nullで未設定を表現）
given_name: givenName || null,
date_of_expiry: dateOfExpiry || null,
// ...
```

### 対象フィールド

| フィールド名 | SD | 変更前 | 変更後 |
|-------------|------|--------|--------|
| `given_name` | Always | 省略 | null |
| `learning_outcomes` | Always | 省略 | null |
| `assessment_grade` | Always | 省略 | null |
| `prerequisites_to_enroll` | Always | 省略 | null |
| `integration_stackability_options` | Always | 省略 | null |
| `date_of_expiry` | Never | 省略 | null |
| `achievement_description` | Never | 省略 | null |

### SD-JWT出力例

**date_of_expiry未設定の場合**:
```json
{
  "iss": "https://issuer.example.com",
  "date_of_expiry": null,
  "achievement_description": null,
  ...
}
```

### フォーム変更

`achievement_description`（実績の説明）も任意入力に変更。

**変更ファイル**:
- `demos/learning-vci/views/admin/learner-new.ejs`
- `demos/learning-vci/views/admin/learner-edit.ejs`

**変更内容**: `required`属性と`*`マークを削除

---

## 参考資料

- [RFC 9901 - Selective Disclosure for JSON Web Tokens](https://datatracker.ietf.org/doc/rfc9901/)
- [SD-JWT VC draft-13](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-sd-jwt-vc-13)
- [Learning Credential仕様](../demos/learning-vci.md)
- [過去の調査: SD-JWT Disclosure Frame修正](./2025-12-05-sd-jwt-disclosure-frame-fix.md)
- [過去の調査: 有効期限フィールドを任意入力に変更](./2026-02-10-optional-date-of-expiry.md)

---

## 進捗

- [x] 調査開始
- [x] 現在の実装確認
- [x] SD-JWT仕様（RFC 9901）確認
- [x] SD-JWT VC仕様確認
- [x] 過去の関連調査確認
- [x] プレゼンテーション時の問題点調査（OpenID4VP/DCQL）
- [x] 結論まとめ
- [x] ドキュメント作成
- [x] SD:Never オプションフィールドのnull対応
- [x] SD:Always オプションフィールドのnull対応
- [x] achievement_descriptionフォームを任意入力に変更
- [x] ビルド確認
