# オプションクレームのnull値対応リバート

## 概要

オプションクレームをnull値で常に含める対応をリバートし、元の条件付き展開（値がある場合のみ含める）に戻す。

## 関連ドキュメント

- 作業依頼: docs/work/requests/2026-02-20-revert-null-claim.md
- 元の対応: docs/work/2026-02-12-optional-never-claims-investigation.md

## リバート対象コミット

- `4c36572` Use null for all optional claims to ensure presentation compatibility
- `cbdad0f` Use null for optional SD:Never claims to ensure presentation compatibility

## 変更内容

### 変更前（null値で常に含める）

```typescript
// Optional fields - Verifier要求に対応するため常に含める（nullで未設定を表現）
// SD: Always
given_name: givenName || null,
learning_outcomes: parsedLearningOutcomes || null,
assessment_grade: assessmentGrade || null,
prerequisites_to_enroll: parsedPrerequisitesToEnroll || null,
integration_stackability_options: integrationStackabilityOptions ?? null,
// SD: Never
date_of_expiry: dateOfExpiry || null,
achievement_description: achievementDescription || null,
```

### 変更後（条件付き展開）

```typescript
// Optional fields - 値がある場合のみ含める
// SD: Always
...(givenName && { given_name: givenName }),
...(parsedLearningOutcomes && { learning_outcomes: parsedLearningOutcomes }),
...(assessmentGrade && { assessment_grade: assessmentGrade }),
...(parsedPrerequisitesToEnroll && { prerequisites_to_enroll: parsedPrerequisitesToEnroll }),
...(integrationStackabilityOptions !== undefined && integrationStackabilityOptions !== null && { integration_stackability_options: integrationStackabilityOptions }),
// SD: Never
...(dateOfExpiry && { date_of_expiry: dateOfExpiry }),
...(achievementDescription && { achievement_description: achievementDescription }),
```

## 対象ファイル

- `demos/learning-vci/src/logic/learningCredential.ts`

## 進捗

| ステップ | ステータス |
|---------|----------|
| 作業ドキュメント作成 | 完了 |
| コード修正 | 完了 |
| ビルド確認 | 完了 |
| テスト実行 | 完了 (151 tests passing) |
