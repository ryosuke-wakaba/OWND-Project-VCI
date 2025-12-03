import store from "ownd-vci-common/dist/store.js";
import keyStore from "ownd-vci-common/dist/store/keyStore.js";
import authStore, {
  StoredAccessToken,
  TBL_NM_AUTH_CODES,
} from "ownd-vci-common/dist/store/authStore.js";
import {
  Identifiable,
  AuthorizedCode,
} from "ownd-vci/dist/oid4vci/types/types.js";

/*
@startuml

entity learners {
  * id: int
  --
  * learnerNo string PRIMARY KEY
  * givenName string
  * familyName string
  * issuingAuthority string
  * issuingCountry string
  * achievementTitle string
  * achievementDescription string
  * learningOutcomes string (JSON array)
  * assessmentGrade string
  * dateOfIssuance string
  * dateOfExpiry string
  * createdAt datetime
  * updatedAt datetime
}

entity auth_codes {
  * id int
  --
  * code string
  * pre_auth_flow boolean
  * pin string
  * needs_proof boolean
  * sub string (learner.id)
  * expired_in number
  * created_at datetime
  * used_at datetime
}

auth_codes ||..o| access_tokens
access_tokens ||..|{ c_nonces

@enduml
*/

const TBL_NM_LEARNERS = "learners";

const DDL_LEARNERS = `
  CREATE TABLE ${TBL_NM_LEARNERS} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    learnerNo VARCHAR(255) UNIQUE,
    givenName VARCHAR(255),
    familyName VARCHAR(255),
    issuingAuthority VARCHAR(255),
    issuingCountry VARCHAR(10),
    achievementTitle VARCHAR(255),
    achievementDescription TEXT,
    learningOutcomes TEXT,
    assessmentGrade VARCHAR(50),
    dateOfIssuance VARCHAR(20),
    dateOfExpiry VARCHAR(20),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`.trim();

const DDL_MAP = {
  [TBL_NM_LEARNERS]: DDL_LEARNERS,
};

const createDb = async () => {
  await keyStore.createDb();
  await authStore.createDb();
  await store.createDb(DDL_MAP);
};

const destroyDb = async () => {
  await keyStore.destroyDb();
  await authStore.destroyDb();
  await store.destroyDb(DDL_MAP);
};

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
}
export type NewLearner = Omit<Learner, "id">;

export const registerLearner = async (
  newLearner: NewLearner,
): Promise<void> => {
  const db = await store.openDb();
  const sql = `
    INSERT INTO ${TBL_NM_LEARNERS}
    (learnerNo, givenName, familyName, issuingAuthority, issuingCountry,
     achievementTitle, achievementDescription, learningOutcomes, assessmentGrade,
     dateOfIssuance, dateOfExpiry)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    newLearner.learnerNo,
    newLearner.givenName,
    newLearner.familyName,
    newLearner.issuingAuthority,
    newLearner.issuingCountry,
    newLearner.achievementTitle,
    newLearner.achievementDescription || null,
    newLearner.learningOutcomes || null,
    newLearner.assessmentGrade || null,
    newLearner.dateOfIssuance,
    newLearner.dateOfExpiry || null,
  ];

  try {
    await db.run(sql, params);
    console.log("New learner inserted");
  } catch (err) {
    console.error("Could not insert new learner", err);
    throw err;
  }
};

export const getLearnerByNo = async (learnerNo: string) => {
  try {
    const db = await store.openDb();
    const learner = await db.get<Learner>(
      `SELECT * FROM ${TBL_NM_LEARNERS} WHERE learnerNo = ?`,
      learnerNo,
    );
    return learner || null;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const getLearnerById = async (id: string | number) => {
  try {
    const db = await store.openDb();
    const learner = await db.get<Learner>(
      `SELECT * FROM ${TBL_NM_LEARNERS} WHERE id = ?`,
      typeof id === "string" ? Number(id) : id,
    );
    return learner || null;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const addPreAuthCode = async (
  code: string,
  expiresIn: number,
  txCode: string,
  sub: string,
  signingKeyKid?: string,
) => {
  try {
    const authCodeId = await authStore.addAuthCode(
      code,
      expiresIn,
      true,
      txCode,
      true,
      sub,
    );
    // Store signing key kid in metadata if provided
    if (authCodeId && signingKeyKid) {
      await authStore.addAuthCodeMetadata(authCodeId, signingKeyKid);
    }
    return authCodeId;
  } catch (err) {
    store.handleError(err);
  }
};

type StoredPreAuthCode = {
  usedAt: string;
  sub?: string;
} & Omit<AuthorizedCode, "isUsed"> &
  Identifiable;

export const getPreAuthCodeAndLearner = async (code: string) => {
  try {
    const db = await store.openDb();

    const storedAuthCode = await db.get<StoredPreAuthCode>(
      `SELECT * FROM ${TBL_NM_AUTH_CODES} WHERE code = ?`,
      [code],
    );

    if (!storedAuthCode) {
      return null;
    }

    if (!storedAuthCode.sub) {
      throw new Error("AuthCode found but no sub (learner identifier) found");
    }

    const learner = await db.get<Learner>(
      `SELECT * FROM ${TBL_NM_LEARNERS} WHERE id = ?`,
      [Number(storedAuthCode.sub)],
    );

    if (!learner) {
      throw new Error("Learner not found for sub: " + storedAuthCode.sub);
    }

    // Get signing key kid from metadata
    const metadata = await authStore.getAuthCodeMetadataByCode(code);
    const signingKeyKid = metadata?.signingKeyKid;

    return { storedAuthCode, learner, signingKeyKid };
  } catch (err) {
    store.handleError(err);
  }
};

export const addAccessToken = async (
  accessToken: string,
  expiresIn: number,
  authorizedCodeId: number,
) => {
  const accessTokenId = await authStore.addAccessToken(
    accessToken,
    expiresIn,
    authorizedCodeId,
  );
  await authStore.updateAuthCode(authorizedCodeId);
  return accessTokenId;
};

export const getAccessToken = async (
  accessToken: string,
): Promise<StoredAccessToken | undefined> => {
  return await authStore.getAccessToken(accessToken);
};

export const getAllLearners = async (): Promise<Learner[]> => {
  try {
    const db = await store.openDb();
    const learners = await db.all<Learner[]>(
      `SELECT * FROM ${TBL_NM_LEARNERS} ORDER BY createdAt DESC`,
    );
    return learners;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const updateLearner = async (
  id: number,
  learner: NewLearner,
): Promise<void> => {
  try {
    const db = await store.openDb();
    const sql = `
      UPDATE ${TBL_NM_LEARNERS}
      SET learnerNo = ?, givenName = ?, familyName = ?, issuingAuthority = ?,
          issuingCountry = ?, achievementTitle = ?, achievementDescription = ?,
          learningOutcomes = ?, assessmentGrade = ?, dateOfIssuance = ?,
          dateOfExpiry = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await db.run(
      sql,
      learner.learnerNo,
      learner.givenName,
      learner.familyName,
      learner.issuingAuthority,
      learner.issuingCountry,
      learner.achievementTitle,
      learner.achievementDescription || null,
      learner.learningOutcomes || null,
      learner.assessmentGrade || null,
      learner.dateOfIssuance,
      learner.dateOfExpiry || null,
      id,
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const deleteLearner = async (id: number): Promise<void> => {
  try {
    const db = await store.openDb();
    await db.run(`DELETE FROM ${TBL_NM_LEARNERS} WHERE id = ?`, id);
  } catch (err) {
    console.error(err);
    throw err;
  }
};

/**
 * 暫定対応: 学習者IDから最新のsigningKeyKidを取得
 * VCIプロトコルの制約により、credential発行時にsubのみが渡されるため、
 * 最新のauth_codeに紐づくメタデータを参照する
 */
export const getLatestSigningKeyKidForLearner = async (
  learnerId: string,
): Promise<string | undefined> => {
  try {
    const db = await store.openDb();
    // 該当学習者の最新のauth_codeを取得し、そのメタデータからsigningKeyKidを取得
    const result = await db.get<{ signingKeyKid: string }>(
      `SELECT m.signingKeyKid
       FROM auth_code_metadata m
       INNER JOIN ${TBL_NM_AUTH_CODES} a ON m.authCodeId = a.id
       WHERE a.sub = ?
       ORDER BY a.createdAt DESC
       LIMIT 1`,
      [learnerId],
    );
    return result?.signingKeyKid;
  } catch (err) {
    console.error("Failed to get latest signing key kid:", err);
    return undefined;
  }
};

export default {
  createDb,
  destroyDb,
  registerLearner,
  getLearnerByNo,
  getLearnerById,
  getAllLearners,
  updateLearner,
  deleteLearner,
  addPreAuthCode,
  getPreAuthCodeAndLearner,
  addAccessToken,
  getAccessToken,
  getLatestSigningKeyKidForLearner,
};
