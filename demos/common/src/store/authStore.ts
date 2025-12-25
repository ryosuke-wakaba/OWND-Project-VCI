import {
  Identifiable,
  AuthorizedCode,
  VCIAccessToken,
} from "ownd-vci/dist/oid4vci/types/types.js";
import store, { handleError, UNIQUE_CONSTRAINT_FAILED } from "../store.js";
import sqlite3 from "sqlite3";
import { ISqlite } from "sqlite";
/*
@startuml

entity auth_codes {
  * id int
  --
  * code string
  * pre_auth_flow boolean
  * pin string
  * needs_proof boolean
  * expired_in number
  * created_at datetime
  * used_at datetime
}

entity access_tokens {
  * id number
  --
  * auth_code_id number <<FK>>
  * token string
  * expired_in number
  * created_at datetime
}

entity c_nonces {
  * id number
  --
  * nonce string
  * expired_in number
  * created_at datetime
}

package service_specific {
  abstract subject ##[dashed]
  abstract auth_codes_subject_rel ##[dashed]
  note top of subject: `subject` is entity \n defined by each vci system
}

auth_codes ||..o| access_tokens

auth_codes ||..|{ auth_codes_subject_rel
subject ||..|{ auth_codes_subject_rel

@enduml
*/
export const TBL_NM_AUTH_CODES = "auth_codes";
export const TBL_NM_ACCESS_TOKENS = "access_tokens";
export const TBL_NM_C_NONCES = "c_nonces";
export const TBL_NM_AUTH_CODE_METADATA = "auth_code_metadata";

const DDL_AUTH_CODES = `
  CREATE TABLE ${TBL_NM_AUTH_CODES} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(32),
    expiresIn INTEGER,
    preAuthFlow BOOLEAN,
    txCode VARCHAR(8),
    needsProof BOOLEAN,
    sub VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    usedAt DATETIME DEFAULT NULL
  )
`.trim();
const DDL_ACCESS_TOKENS = `
  CREATE TABLE ${TBL_NM_ACCESS_TOKENS} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token VARCHAR(2048) UNIQUE,
    expiresIn INTEGER,
    authorized_code_id INTEGER NOT NULL,
    dpopJkt VARCHAR(255) DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (authorized_code_id) REFERENCES ${TBL_NM_AUTH_CODES}(id)
  )
`.trim();
const DDL_C_NONCES = `
  CREATE TABLE ${TBL_NM_C_NONCES} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nonce TEXT NOT NULL,
  expired_in INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`.trim();

const DDL_AUTH_CODE_METADATA = `
  CREATE TABLE ${TBL_NM_AUTH_CODE_METADATA} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authCodeId INTEGER UNIQUE,
    signingKeyKid VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (authCodeId) REFERENCES ${TBL_NM_AUTH_CODES}(id)
  )
`.trim();

const DDL_MAP = {
  [TBL_NM_AUTH_CODES]: DDL_AUTH_CODES,
  [TBL_NM_ACCESS_TOKENS]: DDL_ACCESS_TOKENS,
  [TBL_NM_C_NONCES]: DDL_C_NONCES,
  [TBL_NM_AUTH_CODE_METADATA]: DDL_AUTH_CODE_METADATA,
};

/**
 * Run database migrations for schema changes
 */
const runMigrations = async () => {
  // Migration: Add dpopJkt column to access_tokens table (DPoP support)
  await store.addColumnIfNotExists(
    TBL_NM_ACCESS_TOKENS,
    "dpopJkt",
    "VARCHAR(255) DEFAULT NULL",
  );
};

export const createDb = async () => {
  await store.createDb(DDL_MAP);
  // Run migrations for existing databases
  await runMigrations();
};
export const destroyDb = async () => {
  await store.destroyDb(DDL_MAP);
};
interface JoinedAuthCode {
  authorized_code_id: number;
  code: string;
  txCode: string;
  needsProof: boolean;
  preAuthFlow: boolean;
  codeExpiresIn: number;
  codeCreatedAt: string;
  usedAt: string;
  sub: string;
}
export const addAuthCode = async (
  code: string,
  expiresIn: number,
  preAuthFlow: boolean,
  txCode: string,
  needsProof: boolean,
  sub?: string,
) => {
  try {
    const db = await store.openDb();
    const result = await db.run(
      `INSERT INTO ${TBL_NM_AUTH_CODES} (code, expiresIn, preAuthFlow, txCode, needsProof, sub) VALUES (?, ?, ?, ?, ?, ?)`,
      code,
      expiresIn,
      preAuthFlow,
      txCode,
      needsProof,
      sub || null,
    );
    return result.lastID!;
  } catch (err) {
    handleError(err);
  }
};

export const getAuthCode = async (code: string) => {
  try {
    const db = await store.openDb();
    const result = await db.get<AuthorizedCode>(
      `SELECT id, code, expiresIn, preAuthFlow, txCode, needsProof, createdAt, usedAt FROM ${TBL_NM_AUTH_CODES} WHERE code = ?`,
      code,
    );
    if (result) {
      return result;
    } else {
      return undefined;
    }
  } catch (err) {
    handleError(err);
  }
};

export const updateAuthCode = async (id: number) => {
  try {
    const db = await store.openDb();
    await db.run(
      `UPDATE ${TBL_NM_AUTH_CODES} SET usedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      id,
    );
  } catch (err) {
    handleError(err);
  }
};

export const addAccessToken = async (
  accessToken: string,
  expiresIn: number,
  authorizedCodeId: number,
  dpopJkt?: string,
): Promise<number | undefined> => {
  try {
    const db = await store.openDb();
    const result = await db.run(
      `INSERT INTO ${TBL_NM_ACCESS_TOKENS} (token, expiresIn, authorized_code_id, dpopJkt) VALUES (?, ?, ?, ?)`,
      accessToken,
      expiresIn,
      authorizedCodeId,
      dpopJkt || null,
    );
    return result.lastID; // アクセストークンのIDを返す
  } catch (err) {
    handleError(err);
  }
};

export const addCNonce = async (
  cNonce: string,
  cNonceExpiresIn: number,
  // @ts-ignore
): Promise<ISqlite.RunResult<sqlite3.Statement>> | never => {
  try {
    const db = await store.openDb();
    const createdAt = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    return await db.run(
      `INSERT INTO ${TBL_NM_C_NONCES} (nonce, expired_in, createdAt) VALUES (?, ?, ?)`,
      cNonce,
      cNonceExpiresIn,
      createdAt,
    );
  } catch (err) {
    handleError(err);
  }
};

export type StoredCNonce = {
  id: number;
  nonce: string;
  expired_in: number;
  createdAt: number; // Unix timestamp in seconds
};

export const getCNonce = async (
  nonce: string,
): Promise<StoredCNonce | undefined> => {
  try {
    const db = await store.openDb();
    const result = await db.get<StoredCNonce>(
      `SELECT * FROM ${TBL_NM_C_NONCES} WHERE nonce = ? ORDER BY createdAt DESC LIMIT 1`,
      nonce,
    );
    return result;
  } catch (err) {
    handleError(err);
  }
};

export type StoredAccessToken = {
  authorizedCode: AuthorizedCode & Identifiable;
  /** DPoP JWK Thumbprint (jkt) - set when token was issued with DPoP binding */
  dpopJkt?: string;
} & VCIAccessToken &
  Identifiable;

export const getAccessToken = async (
  accessToken: string,
): Promise<StoredAccessToken | undefined> => {
  try {
    const db = await store.openDb();
    const row = await db.get<
      VCIAccessToken & Identifiable & JoinedAuthCode & { dpopJkt?: string }
    >(
      `
      SELECT
        a.id,
        a.token,
        a.expiresIn,
        a.authorized_code_id,
        a.dpopJkt,
        p.code,
        p.expiresIn AS codeExpiresIn,
        p.createdAt AS codeCreatedAt,
        p.txCode,
        p.needsProof,
        p.preAuthFlow,
        p.usedAt,
        p.sub,
        a.createdAt
      FROM ${TBL_NM_ACCESS_TOKENS} as a
      LEFT JOIN ${TBL_NM_AUTH_CODES} AS p ON a.authorized_code_id = p.id
      WHERE a.token = ?
      ORDER BY a.createdAt DESC, a.rowid DESC
      `,
      accessToken,
    );
    if (row) {
      return {
        ...row,
        dpopJkt: row.dpopJkt || undefined,
        authorizedCode: {
          id: row.authorized_code_id,
          code: row.code,
          expiresIn: row.codeExpiresIn,
          txCode: row.txCode,
          needsProof: row.needsProof,
          preAuthFlow: row.preAuthFlow,
          isUsed: row.usedAt !== null,
          createdAt: row.codeCreatedAt,
          sub: row.sub,
        },
      };
    } else {
      return undefined;
    }
  } catch (err) {
    handleError(err);
  }
};

export const refreshNonce = async (
  cNonce: string,
  expiresIn: number,
) => {
  try {
    const db = await store.openDb();

    return await db.run(
      `INSERT INTO ${TBL_NM_C_NONCES} (nonce, expired_in) VALUES (?, ?)`,
      cNonce,
      expiresIn,
    );
  } catch (err) {
    console.error(err);
    if (err instanceof Error) {
      const { message } = err;
      if (message.includes("SQLITE_CONSTRAINT: UNIQUE constraint failed:")) {
        throw new Error(UNIQUE_CONSTRAINT_FAILED);
      }
    }
    throw err;
  }
};

export interface AuthCodeMetadata {
  id: number;
  authCodeId: number;
  signingKeyKid?: string;
  createdAt: string;
}

export const addAuthCodeMetadata = async (
  authCodeId: number,
  signingKeyKid?: string,
): Promise<number | undefined> => {
  if (!signingKeyKid) {
    return undefined;
  }
  try {
    const db = await store.openDb();
    const result = await db.run(
      `INSERT INTO ${TBL_NM_AUTH_CODE_METADATA} (authCodeId, signingKeyKid) VALUES (?, ?)`,
      authCodeId,
      signingKeyKid,
    );
    return result.lastID;
  } catch (err) {
    handleError(err);
  }
};

export const getAuthCodeMetadata = async (
  authCodeId: number,
): Promise<AuthCodeMetadata | undefined> => {
  try {
    const db = await store.openDb();
    const result = await db.get<AuthCodeMetadata>(
      `SELECT * FROM ${TBL_NM_AUTH_CODE_METADATA} WHERE authCodeId = ?`,
      authCodeId,
    );
    return result;
  } catch (err) {
    handleError(err);
  }
};

export const getAuthCodeMetadataByCode = async (
  code: string,
): Promise<AuthCodeMetadata | undefined> => {
  try {
    const db = await store.openDb();
    const result = await db.get<AuthCodeMetadata>(
      `SELECT m.* FROM ${TBL_NM_AUTH_CODE_METADATA} m
       INNER JOIN ${TBL_NM_AUTH_CODES} a ON m.authCodeId = a.id
       WHERE a.code = ?`,
      code,
    );
    return result;
  } catch (err) {
    handleError(err);
  }
};

// ========================================
// DPoP Nonce Management (uses c_nonces table)
// ========================================

const DPOP_NONCE_EXPIRES_IN = 300; // 5 minutes

/**
 * Generate a new DPoP nonce and store it
 * @returns The generated nonce string
 */
export const generateDpopNonce = async (): Promise<string> => {
  const nonce = crypto.randomUUID();
  await addCNonce(nonce, DPOP_NONCE_EXPIRES_IN);
  return nonce;
};

/**
 * Validate a DPoP nonce
 * @param nonce - The nonce to validate
 * @returns true if the nonce is valid and not expired
 */
export const validateDpopNonce = async (nonce: string): Promise<boolean> => {
  const stored = await getCNonce(nonce);
  if (!stored) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = stored.createdAt + stored.expired_in;
  return now < expiresAt;
};

export default {
  createDb,
  destroyDb,
  addAuthCode,
  updateAuthCode,
  getAuthCode,
  addAccessToken,
  addCNonce,
  getCNonce,
  getAccessToken,
  refreshNonce,
  addAuthCodeMetadata,
  getAuthCodeMetadata,
  getAuthCodeMetadataByCode,
  generateDpopNonce,
  validateDpopNonce,
};
