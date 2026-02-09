# Learning Credential Data Model 更新作業

## 概要

EUDI-Wallet-NiScy_JP EU pilot_v1.02.docx の「3 Learning Credential Data Model」に基づき、
learning-vci デモアプリの教育クレデンシャルのデータ項目を更新する。

## 参照ドキュメント

- EUDI-Wallet-NiScy_JP EU pilot_v1.02.docx (2026-02-02更新)
- Section 3: Learning Credential Data Model

## 変更点サマリ

### 新規追加フィールド（必須: M）

| フィールド名 | SD-JWT-VC claim | 型 | SD | 説明 |
|------------|-----------------|-----|-----|------|
| 授業言語 | `language_of_classes` | string[] | Never | 授業で使用された言語（en/ja）|
| 学習者ID | `learner_identification` | string | Always | 学習者識別番号 |
| 予想学習時間 | `expected_study_time` | string | Always | 学習成果を得るための予想学習時間 |
| 学習経験レベル | `level_of_learning_experience` | int | Always | EQFレベル（1-8）|
| 品質保証タイプ | `types_of_quality_assurance` | string[] | Always | 品質保証の種類 |

### 新規追加フィールド（任意: O）

| フィールド名 | SD-JWT-VC claim | 型 | SD | 説明 |
|------------|-----------------|-----|-----|------|
| 履修要件 | `prerequisites_to_enroll` | string[] | Always | 履修に必要な前提条件 |
| 積み上げ可能性 | `integration_stackability_options` | boolean | Always | 積み上げ可能かどうか（Yes/No）|

### 除外フィールド

以下のフィールドはドキュメントで取消線が入っているため、今回の実装から除外:
- ~~`form_of_participation`~~ - 参加形態
- ~~`evaluator_verification`~~ - 評価者検証

### 変更されたフィールド

| フィールド名 | 変更内容 |
|------------|---------|
| given_name | 必須（M）→ 任意（O）に変更 |

### フィールド対応表（現在 → 更新後）

| 現在のclaim | DB カラム | 更新後のclaim |
|------------|--------------|--------------|
| family_name | familyName | family_name（変更なし）|
| given_name | givenName | given_name（M必須に変更）|
| issuing_authority | issuingAuthority | issuing_authority（変更なし）|
| issuing_country | issuingCountry | issuing_country（変更なし）|
| achievement_title | achievementTitle | achievement_title（変更なし）|
| achievement_description | achievementDescription | achievement_description（変更なし）|
| learning_outcomes | learningOutcomes | learning_outcomes（変更なし）|
| assessment_grade | assessmentGrade | assessment_grade（変更なし）|
| date_of_issuance | dateOfIssuance | date_of_issuance（変更なし）|
| date_of_expiry | dateOfExpiry | date_of_expiry（変更なし）|
| - | learnerNo | learner_identification（新規、learnerNoをマッピング）|
| - | - | language_of_classes（新規追加）|
| - | - | expected_study_time（新規追加）|
| - | - | level_of_learning_experience（新規追加）|
| - | - | types_of_quality_assurance（新規追加）|
| - | - | prerequisites_to_enroll（新規追加）|
| - | - | integration_stackability_options（新規追加）|

## 影響範囲

### 1. データベーススキーマ（store.ts）

**ファイル**: `demos/learning-vci/src/store.ts`

追加するカラム:
```sql
ALTER TABLE learners ADD COLUMN languageOfClasses TEXT; -- JSON array: ["en", "ja"]
ALTER TABLE learners ADD COLUMN expectedStudyTime VARCHAR(100);
ALTER TABLE learners ADD COLUMN levelOfLearningExperience INTEGER;
ALTER TABLE learners ADD COLUMN typesOfQualityAssurance TEXT; -- JSON array
ALTER TABLE learners ADD COLUMN prerequisitesToEnroll TEXT; -- JSON array
ALTER TABLE learners ADD COLUMN integrationStackabilityOptions BOOLEAN;
```

### 2. TypeScript型定義（store.ts）

**ファイル**: `demos/learning-vci/src/store.ts`

```typescript
export interface Learner {
  id: number;
  learnerNo: string;
  givenName: string;
  familyName: string;
  issuingAuthority: string;
  issuingCountry: string;
  achievementTitle: string;
  achievementDescription?: string;
  learningOutcomes?: string; // JSON array string
  assessmentGrade?: string;
  dateOfIssuance: string;
  dateOfExpiry?: string;
  // 新規追加フィールド
  languageOfClasses: string; // JSON array string: ["en", "ja"]
  expectedStudyTime: string;
  levelOfLearningExperience: number;
  typesOfQualityAssurance: string; // JSON array string
  prerequisitesToEnroll?: string; // JSON array string
  integrationStackabilityOptions?: boolean;
}
```

### 3. クレデンシャル発行ロジック（learningCredential.ts）

**ファイル**: `demos/learning-vci/src/logic/learningCredential.ts`

更新内容:
- 新規フィールドをclaimsオブジェクトに追加
- selectivelyDisclosableClaimsに新規フィールドを追加

```typescript
const claims: Record<string, unknown> = {
  // ... 既存フィールド
  // 新規必須フィールド
  language_of_classes: parsedLanguageOfClasses, // SD: Never
  learner_identification: learnerNo, // SD: Always（learnerNoをマッピング）
  expected_study_time: expectedStudyTime, // SD: Always
  level_of_learning_experience: levelOfLearningExperience, // SD: Always
  types_of_quality_assurance: parsedTypesOfQualityAssurance, // SD: Always
  // 新規任意フィールド
  ...(prerequisitesToEnroll && { prerequisites_to_enroll: parsedPrerequisites }), // SD: Always
  ...(integrationStackabilityOptions !== undefined && { integration_stackability_options: integrationStackabilityOptions }), // SD: Always
};

const selectivelyDisclosableClaims = [
  "family_name",
  "given_name",
  "learning_outcomes",
  "assessment_grade",
  // 新規追加
  "learner_identification",
  "expected_study_time",
  "level_of_learning_experience",
  "types_of_quality_assurance",
  "prerequisites_to_enroll",
  "integration_stackability_options",
];
```

### 4. クレデンシャル設定（credentialConfigs.ts）

**ファイル**: `demos/learning-vci/src/metadata/credentialConfigs.ts`

credential_metadataに新規フィールドの表示情報を追加

### 5. 管理画面テンプレート

**ファイル**:
- `demos/learning-vci/views/admin/learner-new.ejs`
- `demos/learning-vci/views/admin/learner-edit.ejs`
- `demos/learning-vci/views/admin/learners.ejs`

追加するフォームフィールド:
- languageOfClasses（チェックボックス: en/ja）
- expectedStudyTime（テキスト入力）
- levelOfLearningExperience（セレクトボックス: 1-8）
- typesOfQualityAssurance（テキストエリア、カンマ区切り）
- prerequisitesToEnroll（テキストエリア、カンマ区切り）
- integrationStackabilityOptions（チェックボックス）

### 6. 国際化ファイル

**ファイル**:
- `demos/learning-vci/locales/ja/learners.json`
- `demos/learning-vci/locales/en/learners.json`

追加する翻訳キー:
- form.languageOfClasses / 授業言語 / Language of Classes
- form.expectedStudyTime / 予想学習時間 / Expected Study Time
- form.levelOfLearningExperience / 学習経験レベル / Level of Learning Experience
- form.typesOfQualityAssurance / 品質保証タイプ / Types of Quality Assurance
- form.prerequisitesToEnroll / 履修要件 / Prerequisites to Enroll
- form.integrationStackabilityOptions / 積み上げ可能性 / Integration/Stackability Options

### 7. ルートハンドラ

**ファイル**: `demos/learning-vci/src/routes/admin/routesHandler.ts`

- 学習者登録・更新時のリクエストボディパース処理を更新

### 8. ドキュメント更新

**ファイル**:
- `docs/demos/learning-vci.md` - データフィールド仕様を更新

## タスクリスト

- [ ] 新しいブランチ作成（feature/update-learning-credential-data-model）
- [ ] store.ts: Learnerインターフェース更新
- [ ] store.ts: DDL_LEARNERS更新
- [ ] store.ts: registerLearner, updateLearner関数更新
- [ ] learningCredential.ts: claims構築ロジック更新
- [ ] learningCredential.ts: selectivelyDisclosableClaims更新
- [ ] credentialConfigs.ts: credential_metadata更新
- [ ] routesHandler.ts: リクエストボディパース更新
- [ ] learner-new.ejs: フォームフィールド追加
- [ ] learner-edit.ejs: フォームフィールド追加
- [ ] learners.ejs: 一覧表示更新（必要に応じて）
- [ ] locales/ja/learners.json: 翻訳追加
- [ ] locales/en/learners.json: 翻訳追加
- [ ] docs/demos/learning-vci.md: 仕様ドキュメント更新
- [ ] マイグレーションSQLを docs/demos/learning-vci.md に追加
- [ ] ビルド・テスト実行
- [ ] 動作確認

## マイグレーションSQL

既存DBを使用している場合に実行するSQL:

```sql
-- v1.02 Learning Credential Data Model 対応
ALTER TABLE learners ADD COLUMN languageOfClasses TEXT DEFAULT '["ja"]';
ALTER TABLE learners ADD COLUMN expectedStudyTime VARCHAR(100) DEFAULT '';
ALTER TABLE learners ADD COLUMN levelOfLearningExperience INTEGER DEFAULT 1;
ALTER TABLE learners ADD COLUMN typesOfQualityAssurance TEXT DEFAULT '[]';
ALTER TABLE learners ADD COLUMN prerequisitesToEnroll TEXT;
ALTER TABLE learners ADD COLUMN integrationStackabilityOptions BOOLEAN;
```

## 注意事項

- 既存のlearnerNoフィールドは、learner_identification claimにマッピングされる
- given_nameは必須（M）になったため、既存データで空の場合は更新が必要
- language_of_classesのデフォルト値は["ja"]とする
- levelOfLearningExperienceはEQFレベル（1-8）の整数値
- 配列フィールドはJSON文字列としてSQLiteに保存する（既存のlearningOutcomesと同様）
- ~~form_of_participation~~ と ~~evaluator_verification~~ はドキュメントで取消線があるため実装対象外
