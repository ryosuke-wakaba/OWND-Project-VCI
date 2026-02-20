/**
 * LearningCredentialの設定
 * EUDI Wallet仕様 (EUDI-Wallet-NiScy_JP EU pilot_v1.02.docx) に準拠
 */
export const learningCredentialConfig = {
  format: "dc+sd-jwt" as const,
  scope: "LearningCredential",
  cryptographic_binding_methods_supported: ["jwk"],
  credential_signing_alg_values_supported: ["ES256K"],
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: ["ES256", "ES256K"],
    },
  },
  vct: "urn:eu.europa.ec.eudi:learning:credential:1",
  credential_metadata: {
    display: [
      {
        name: "学習証明書",
        locale: "ja-JP",
        logo: {
          uri: "", // 動的に設定される
          alt_text: "学習証明書のロゴ",
        },
        background_color: "#1E3A5F",
        background_image: {
          uri: "", // 動的に設定される
        },
        text_color: "#FFFFFF",
      },
      {
        name: "Learning Credential",
        locale: "en-US",
        logo: {
          uri: "", // 動的に設定される
          alt_text: "a square logo of a Learning Credential",
        },
        background_color: "#1E3A5F",
        background_image: {
          uri: "", // 動的に設定される
        },
        text_color: "#FFFFFF",
      },
    ],
    claims: [
      {
        path: ["issuing_authority"],
        display: [
          { name: "発行機関", locale: "ja-JP" },
          { name: "Issuing Authority", locale: "en-US" },
        ],
      },
      {
        path: ["issuing_country"],
        display: [
          { name: "発行国", locale: "ja-JP" },
          { name: "Issuing Country", locale: "en-US" },
        ],
      },
      {
        path: ["date_of_issuance"],
        display: [
          { name: "発行日", locale: "ja-JP" },
          { name: "Date of Issuance", locale: "en-US" },
        ],
      },
      {
        path: ["family_name"],
        display: [
          { name: "姓", locale: "ja-JP" },
          { name: "Family Name", locale: "en-US" },
        ],
      },
      {
        path: ["given_name"],
        display: [
          { name: "名", locale: "ja-JP" },
          { name: "Given Name", locale: "en-US" },
        ],
      },
      {
        path: ["achievement_title"],
        display: [
          { name: "資格/コース名", locale: "ja-JP" },
          { name: "Achievement Title", locale: "en-US" },
        ],
      },
      {
        path: ["achievement_description"],
        display: [
          { name: "実績の説明", locale: "ja-JP" },
          { name: "Achievement Description", locale: "en-US" },
        ],
      },
      {
        path: ["learning_outcomes"],
        display: [
          { name: "学習成果", locale: "ja-JP" },
          { name: "Learning Outcomes", locale: "en-US" },
        ],
      },
      {
        path: ["assessment_grade"],
        display: [
          { name: "評価/成績", locale: "ja-JP" },
          { name: "Assessment Grade", locale: "en-US" },
        ],
      },
      {
        path: ["date_of_expiry"],
        display: [
          { name: "有効期限", locale: "ja-JP" },
          { name: "Date of Expiry", locale: "en-US" },
        ],
      },
      // v1.02 新規フィールド
      {
        path: ["language_of_classes"],
        display: [
          { name: "授業言語", locale: "ja-JP" },
          { name: "Language of Classes", locale: "en-US" },
        ],
      },
      {
        path: ["learner_identification"],
        display: [
          { name: "学習者ID", locale: "ja-JP" },
          { name: "Learner Identification", locale: "en-US" },
        ],
      },
      {
        path: ["expected_study_time"],
        display: [
          { name: "予想学習時間", locale: "ja-JP" },
          { name: "Expected Study Time", locale: "en-US" },
        ],
      },
      {
        path: ["level_of_learning_experience"],
        display: [
          { name: "学習経験レベル", locale: "ja-JP" },
          { name: "Level of Learning Experience", locale: "en-US" },
        ],
      },
      {
        path: ["types_of_quality_assurance"],
        display: [
          { name: "品質保証タイプ", locale: "ja-JP" },
          { name: "Types of Quality Assurance", locale: "en-US" },
        ],
      },
      {
        path: ["prerequisites_to_enroll"],
        display: [
          { name: "履修要件", locale: "ja-JP" },
          { name: "Prerequisites to Enroll", locale: "en-US" },
        ],
      },
      {
        path: ["integration_stackability_options"],
        display: [
          { name: "積み上げ可能性", locale: "ja-JP" },
          { name: "Integration/Stackability Options", locale: "en-US" },
        ],
      },
    ],
  },
};
