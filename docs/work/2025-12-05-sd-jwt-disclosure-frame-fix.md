# SD-JWT Disclosure Frame修正

## Status
- [x] 調査完了
- [x] 仕様確認
- [x] 実装
- [x] ビルド確認
- [x] 動作確認 ← **2025-12-05 完了**

## 問題概要

SD-JWT VPトークン検証時に `TypeMetadataValidationFailure` エラーが発生。

### エラー内容
`selectivelyDisclosable: "never"` のクレームが、JWTペイロードに直接含まれるべきところ、`_sd` 配列経由で発行されている。

### 影響を受けるクレーム

| フィールド | SD属性 | 現状 | あるべき姿 |
|-----------|--------|------|-----------|
| `issuing_authority` | Never | `_sd`経由 | JWTペイロード直接 |
| `issuing_country` | Never | `_sd`経由 | JWTペイロード直接 |
| `date_of_issuance` | Never | `_sd`経由 | JWTペイロード直接 |
| `achievement_title` | Never | `_sd`経由 | JWTペイロード直接 |
| `date_of_expiry` | Never | `_sd`経由 | JWTペイロード直接 |
| `achievement_description` | Never | `_sd`経由 | JWTペイロード直接 |
| `family_name` | Always | `_sd`経由 | `_sd`経由（正しい） |
| `given_name` | Always | `_sd`経由 | `_sd`経由（正しい） |
| `learning_outcomes` | Always | `_sd`経由 | `_sd`経由（正しい） |
| `assessment_grade` | Always | `_sd`経由 | `_sd`経由（正しい） |

## 原因

`ts-toolbox` の `issueFlatCredential` 関数が、標準クレーム以外のすべてのクレームを `_sd` 配列に入れている。

**ファイル**: `/Users/ryousuke/repositories/ownd/tool-box/src/sd-jwt/issue.ts:27-38`

```typescript
export const issueFlatCredential = async (claims, issuerJwk, x5c) => {
  return await issueCredentialCore(
    claims,
    { _sd: getDisclosableClaims(claims) },  // ← すべてのカスタムクレームをSDに
    issuerJwk,
    x5c,
  );
};
```

## 解決策

`learning-vci/src/logic/learningCredential.ts` で `issueFlatCredential` の代わりに `issueCredentialCore` を使用し、`disclosureFrame` を明示的に指定する。

### 修正対象ファイル

- `demos/learning-vci/src/logic/learningCredential.ts`

### 修正内容（実装済み）

```typescript
// Before
import { issueFlatCredential } from "@ownd-project/ts-toolbox";
const credential = await issueFlatCredential(claims, issuerJwk, x5c);

// After
import { issueCredentialCore } from "@ownd-project/ts-toolbox";
import { DisclosureFrame } from "@meeco/sd-jwt";

// SD: Always のクレームのみをselective disclosureに
// SD: Never のクレームはJWTペイロードに直接含める
// 参照: docs/demos/learning-vci.md, SD-JWT Draft-22
const selectivelyDisclosableClaims = [
  "family_name",
  "given_name",
  "learning_outcomes",
  "assessment_grade",
];
const disclosureFrame: DisclosureFrame = {
  _sd: selectivelyDisclosableClaims.filter(
    (name) => name in claims,
  ) as string[],
};

const credential = await issueCredentialCore(
  claims,
  disclosureFrame,
  issuerJwk,
  x5c,
);
```

## 仕様確認（SD-JWT Draft-22）

**参照**: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-selective-disclosure-jwt-22

### 確認結果

1. **`selectivelyDisclosable: "never"` のクレームの扱い**
   - `_sd` 配列に入れず、JWTペイロードに**直接含める（plaintext）**
   - 仕様: "Claims that are not selectively disclosable are included in the SD-JWT in plaintext just as they would be in any other JSON structure."

2. **検証時の動作**
   - `_sd` 配列に含まれないクレームは**自動的に常時開示**扱い
   - Disclosureとの照合対象にならず、そのまま信頼される

3. **Holder（ウォレット）側の動作**
   - `_sd` 配列外のクレームについてはDisclosureの送信を省略する

### 結論

解釈は正しい。`selectivelyDisclosable: "never"` のクレームは `_sd` 配列の外に配置し、通常のJWT形式で扱うべき。

現在の問題は、発行時にすべてのクレームを `_sd` 配列に入れているため、Verifierが「このクレームはselectively disclosableであるべきではない」と判断してエラーを返している。

## 参考

- 元の調査ドキュメント: `/Users/ryousuke/repositories/ownd/ipa2025/OWND-Wallet-iOS/docs/work/2025-12-05-disclosure-validation-failure.md`
- Learning Credential仕様: `docs/demos/learning-vci.md`
- SD-JWT仕様: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-selective-disclosure-jwt-22
