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
export const TBL_NM_SIGNED_METADATA = "signed_metadata";
export const TBL_NM_TRUSTED_WALLET_PROVIDER_CAS = "trusted_wallet_provider_cas";
export const TBL_NM_WALLET_ATTESTATION_SETTINGS = "wallet_attestation_settings";

const DDL_AUTH_CODES = `
  CREATE TABLE ${TBL_NM_AUTH_CODES} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(32),
    expiresIn INTEGER,
    preAuthFlow BOOLEAN,
    txCode VARCHAR(8),
    needsProof BOOLEAN,
    sub VARCHAR(255),
    requireClientAuth BOOLEAN DEFAULT FALSE,
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

const DDL_SIGNED_METADATA = `
  CREATE TABLE ${TBL_NM_SIGNED_METADATA} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jwt TEXT NOT NULL,
    signingKeyKid VARCHAR(255),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    revokedAt DATETIME DEFAULT NULL
  )
`.trim();

const DDL_TRUSTED_WALLET_PROVIDER_CAS = `
  CREATE TABLE ${TBL_NM_TRUSTED_WALLET_PROVIDER_CAS} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    rootCertPem TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`.trim();

const DDL_WALLET_ATTESTATION_SETTINGS = `
  CREATE TABLE ${TBL_NM_WALLET_ATTESTATION_SETTINGS} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enableChainValidation BOOLEAN DEFAULT FALSE,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`.trim();

const DDL_MAP = {
  [TBL_NM_AUTH_CODES]: DDL_AUTH_CODES,
  [TBL_NM_ACCESS_TOKENS]: DDL_ACCESS_TOKENS,
  [TBL_NM_C_NONCES]: DDL_C_NONCES,
  [TBL_NM_AUTH_CODE_METADATA]: DDL_AUTH_CODE_METADATA,
  [TBL_NM_SIGNED_METADATA]: DDL_SIGNED_METADATA,
  [TBL_NM_TRUSTED_WALLET_PROVIDER_CAS]: DDL_TRUSTED_WALLET_PROVIDER_CAS,
  [TBL_NM_WALLET_ATTESTATION_SETTINGS]: DDL_WALLET_ATTESTATION_SETTINGS,
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

  // Migration: Add requireClientAuth column to auth_codes table (Wallet Attestation support)
  await store.addColumnIfNotExists(
    TBL_NM_AUTH_CODES,
    "requireClientAuth",
    "BOOLEAN DEFAULT FALSE",
  );

  // Migration: Add requireDpop column to auth_codes table (per-credential DPoP requirement)
  await store.addColumnIfNotExists(
    TBL_NM_AUTH_CODES,
    "requireDpop",
    "BOOLEAN DEFAULT FALSE",
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
  requireClientAuth: boolean;
  requireDpop: boolean;
}
export const addAuthCode = async (
  code: string,
  expiresIn: number,
  preAuthFlow: boolean,
  txCode: string,
  needsProof: boolean,
  sub?: string,
  requireClientAuth?: boolean,
  requireDpop?: boolean,
) => {
  try {
    const db = await store.openDb();
    const result = await db.run(
      `INSERT INTO ${TBL_NM_AUTH_CODES} (code, expiresIn, preAuthFlow, txCode, needsProof, sub, requireClientAuth, requireDpop) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      code,
      expiresIn,
      preAuthFlow,
      txCode,
      needsProof,
      sub || null,
      requireClientAuth || false,
      requireDpop || false,
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
      `SELECT id, code, expiresIn, preAuthFlow, txCode, needsProof, requireClientAuth, requireDpop, createdAt, usedAt FROM ${TBL_NM_AUTH_CODES} WHERE code = ?`,
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
        p.requireClientAuth,
        p.requireDpop,
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
          requireClientAuth: row.requireClientAuth || false,
          requireDpop: row.requireDpop || false,
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

// ========================================
// Signed Metadata Management
// ========================================

export interface SignedMetadata {
  id: number;
  jwt: string;
  signingKeyKid?: string;
  createdAt: string;
  revokedAt?: string;
}

/**
 * Add a signed metadata JWT to the database
 * @param jwt - The signed metadata JWT
 * @param signingKeyKid - The key ID used to sign the metadata
 * @returns The ID of the inserted record
 */
export const addSignedMetadata = async (
  jwt: string,
  signingKeyKid?: string,
): Promise<number | undefined> => {
  try {
    const db = await store.openDb();
    const result = await db.run(
      `INSERT INTO ${TBL_NM_SIGNED_METADATA} (jwt, signingKeyKid) VALUES (?, ?)`,
      jwt,
      signingKeyKid || null,
    );
    return result.lastID;
  } catch (err) {
    handleError(err);
  }
};

/**
 * Get the active (non-revoked) signed metadata
 * @returns The most recent active signed metadata, or undefined if none exists
 */
export const getActiveSignedMetadata = async (): Promise<
  SignedMetadata | undefined
> => {
  try {
    const db = await store.openDb();
    const result = await db.get<SignedMetadata>(
      `SELECT * FROM ${TBL_NM_SIGNED_METADATA} WHERE revokedAt IS NULL ORDER BY createdAt DESC LIMIT 1`,
    );
    return result;
  } catch (err) {
    handleError(err);
  }
};

/**
 * Revoke a signed metadata by ID
 * @param id - The ID of the signed metadata to revoke
 */
export const revokeSignedMetadata = async (id: number): Promise<void> => {
  try {
    const db = await store.openDb();
    await db.run(
      `UPDATE ${TBL_NM_SIGNED_METADATA} SET revokedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      id,
    );
  } catch (err) {
    handleError(err);
  }
};

/**
 * Revoke all active signed metadata
 */
export const revokeAllSignedMetadata = async (): Promise<void> => {
  try {
    const db = await store.openDb();
    await db.run(
      `UPDATE ${TBL_NM_SIGNED_METADATA} SET revokedAt = CURRENT_TIMESTAMP WHERE revokedAt IS NULL`,
    );
  } catch (err) {
    handleError(err);
  }
};

/**
 * Get all signed metadata (for history display)
 * @returns All signed metadata records, ordered by creation date descending
 */
export const getAllSignedMetadata = async (): Promise<SignedMetadata[]> => {
  try {
    const db = await store.openDb();
    const result = await db.all<SignedMetadata[]>(
      `SELECT * FROM ${TBL_NM_SIGNED_METADATA} ORDER BY createdAt DESC`,
    );
    return result || [];
  } catch (err) {
    handleError(err);
    return [];
  }
};

// ========================================
// Trusted Wallet Provider CA Management
// ========================================

export interface TrustedWalletProviderCA {
  id: number;
  name: string;
  rootCertPem: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Add a trusted wallet provider CA certificate
 * @param name - Display name for the CA
 * @param rootCertPem - Root certificate in PEM format
 * @returns The ID of the inserted record
 */
export const addTrustedWalletProviderCA = async (
  name: string,
  rootCertPem: string,
): Promise<number | undefined> => {
  try {
    const db = await store.openDb();
    const result = await db.run(
      `INSERT INTO ${TBL_NM_TRUSTED_WALLET_PROVIDER_CAS} (name, rootCertPem) VALUES (?, ?)`,
      name,
      rootCertPem,
    );
    return result.lastID;
  } catch (err) {
    handleError(err);
  }
};

/**
 * Get all trusted wallet provider CA certificates
 * @returns All CA certificates
 */
export const getAllTrustedWalletProviderCAs = async (): Promise<
  TrustedWalletProviderCA[]
> => {
  try {
    const db = await store.openDb();
    const result = await db.all<TrustedWalletProviderCA[]>(
      `SELECT * FROM ${TBL_NM_TRUSTED_WALLET_PROVIDER_CAS} ORDER BY createdAt DESC`,
    );
    return result || [];
  } catch (err) {
    handleError(err);
    return [];
  }
};

/**
 * Get all enabled trusted wallet provider CA certificates
 * @returns Enabled CA certificates
 */
export const getEnabledTrustedWalletProviderCAs = async (): Promise<
  TrustedWalletProviderCA[]
> => {
  try {
    const db = await store.openDb();
    const result = await db.all<TrustedWalletProviderCA[]>(
      `SELECT * FROM ${TBL_NM_TRUSTED_WALLET_PROVIDER_CAS} WHERE enabled = TRUE ORDER BY createdAt DESC`,
    );
    return result || [];
  } catch (err) {
    handleError(err);
    return [];
  }
};

/**
 * Get a trusted wallet provider CA by ID
 * @param id - The CA ID
 * @returns The CA certificate or undefined
 */
export const getTrustedWalletProviderCA = async (
  id: number,
): Promise<TrustedWalletProviderCA | undefined> => {
  try {
    const db = await store.openDb();
    const result = await db.get<TrustedWalletProviderCA>(
      `SELECT * FROM ${TBL_NM_TRUSTED_WALLET_PROVIDER_CAS} WHERE id = ?`,
      id,
    );
    return result;
  } catch (err) {
    handleError(err);
  }
};

/**
 * Update the enabled status of a trusted wallet provider CA
 * @param id - The CA ID
 * @param enabled - The new enabled status
 */
export const updateTrustedWalletProviderCAEnabled = async (
  id: number,
  enabled: boolean,
): Promise<void> => {
  try {
    const db = await store.openDb();
    await db.run(
      `UPDATE ${TBL_NM_TRUSTED_WALLET_PROVIDER_CAS} SET enabled = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      enabled,
      id,
    );
  } catch (err) {
    handleError(err);
  }
};

/**
 * Delete a trusted wallet provider CA
 * @param id - The CA ID to delete
 */
export const deleteTrustedWalletProviderCA = async (
  id: number,
): Promise<void> => {
  try {
    const db = await store.openDb();
    await db.run(
      `DELETE FROM ${TBL_NM_TRUSTED_WALLET_PROVIDER_CAS} WHERE id = ?`,
      id,
    );
  } catch (err) {
    handleError(err);
  }
};

// ========================================
// Wallet Attestation Settings Management
// ========================================

export interface WalletAttestationSettings {
  id: number;
  enableChainValidation: boolean;
  updatedAt: string;
}

/**
 * Get wallet attestation settings
 * @returns The current settings, or default settings if none exist
 */
export const getWalletAttestationSettings =
  async (): Promise<WalletAttestationSettings> => {
    try {
      const db = await store.openDb();
      const result = await db.get<WalletAttestationSettings>(
        `SELECT * FROM ${TBL_NM_WALLET_ATTESTATION_SETTINGS} ORDER BY id LIMIT 1`,
      );
      if (result) {
        return {
          ...result,
          enableChainValidation: Boolean(result.enableChainValidation),
        };
      }
      // Return default settings if none exist
      return {
        id: 0,
        enableChainValidation: false,
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      handleError(err);
      return {
        id: 0,
        enableChainValidation: false,
        updatedAt: new Date().toISOString(),
      };
    }
  };

/**
 * Update wallet attestation settings
 * @param enableChainValidation - Whether to enable certificate chain validation
 */
export const updateWalletAttestationSettings = async (
  enableChainValidation: boolean,
): Promise<void> => {
  try {
    const db = await store.openDb();
    // Check if settings exist
    const existing = await db.get<{ id: number }>(
      `SELECT id FROM ${TBL_NM_WALLET_ATTESTATION_SETTINGS} LIMIT 1`,
    );
    if (existing) {
      await db.run(
        `UPDATE ${TBL_NM_WALLET_ATTESTATION_SETTINGS} SET enableChainValidation = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        enableChainValidation,
        existing.id,
      );
    } else {
      await db.run(
        `INSERT INTO ${TBL_NM_WALLET_ATTESTATION_SETTINGS} (enableChainValidation) VALUES (?)`,
        enableChainValidation,
      );
    }
  } catch (err) {
    handleError(err);
  }
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
  addSignedMetadata,
  getActiveSignedMetadata,
  revokeSignedMetadata,
  revokeAllSignedMetadata,
  getAllSignedMetadata,
  addTrustedWalletProviderCA,
  getAllTrustedWalletProviderCAs,
  getEnabledTrustedWalletProviderCAs,
  getTrustedWalletProviderCA,
  updateTrustedWalletProviderCAEnabled,
  deleteTrustedWalletProviderCA,
  getWalletAttestationSettings,
  updateWalletAttestationSettings,
};
