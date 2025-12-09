import { PrivateJwk } from "elliptic-jwk";
import store, {
  FOREIGN_KEY_CONSTRAINT_FAILED,
  UNIQUE_CONSTRAINT_FAILED,
} from "../store.js";
import { ISqlite } from "sqlite";
import sqlite3 from "sqlite3";
/*
@startuml

entity ec_key_pairs {
  * kid string
  --
  * kty: string
  * crv string
  * x string
  * y string
  * d string
  * createdAt datetime
  * revokedAt datetime
}

entity x509_certificates {
  * kid number <<FK>>
  --
  * x509cert string
  * description string
  * createdAt datetime
}

ec_key_pairs ||..o{ x509_certificates

@enduml
*/
export const TBL_NM_EC_KEY_PAIRS = "ec_key_pairs";
export const TBL_NM_EC_KEY_X509_CERTIFICATE = "ec_key_x509_certificate";

const DDL_EC_KEY_PAIRS = `
  CREATE TABLE ${TBL_NM_EC_KEY_PAIRS} (
    kid VARCHAR(80) UNIQUE,
    kty VARCHAR(40),
    crv VARCHAR(40),
    x VARCHAR(1024),
    y VARCHAR(1024),
    d VARCHAR(1024),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    revokedAt DATETIME DEFAULT NULL
  )
`.trim();

const DDL_EC_KEY_X509_CERTIFICATE = `
  CREATE TABLE ${TBL_NM_EC_KEY_X509_CERTIFICATE} (
    kid VARCHAR(80),
    x509cert VARCHAR(8192),
    description VARCHAR(255) DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kid) references ${TBL_NM_EC_KEY_PAIRS}(kid)
  )
`.trim();

const DDL_MAP = {
  [TBL_NM_EC_KEY_PAIRS]: DDL_EC_KEY_PAIRS,
  [TBL_NM_EC_KEY_X509_CERTIFICATE]: DDL_EC_KEY_X509_CERTIFICATE,
};

export const createDb = async () => {
  await store.createDb(DDL_MAP);
};
export const destroyDb = async () => {
  await store.destroyDb(DDL_MAP);
};
export interface ECKeyPair extends PrivateJwk {
  kid: string;
  createdAt: string;
  revokedAt: string;
}
type NewECKeyPair = Omit<ECKeyPair, "createdAt" | "revokedAt">;

export const insertECKeyPair = async (
  keyPair: NewECKeyPair,
): Promise<ISqlite.RunResult<sqlite3.Statement>> | never => {
  try {
    const { kid, kty, crv, x, y, d } = keyPair;
    const db = await store.openDb();
    return await db.run(
      `INSERT INTO ${TBL_NM_EC_KEY_PAIRS} (kid, kty, crv, x, y, d) VALUES (?, ?, ?, ?, ?, ?)`,
      kid,
      kty,
      crv,
      x,
      y,
      d,
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

export const insertEcKeyX509Certificate = async (
  kid: string,
  x509cert: string,
  description?: string,
) => {
  try {
    const db = await store.openDb();
    return await db.run(
      `INSERT INTO ${TBL_NM_EC_KEY_X509_CERTIFICATE} (kid, x509cert, description) VALUES (?, ?, ?)`,
      kid,
      x509cert,
      description || null,
    );
  } catch (err) {
    console.error(err);
    if (err instanceof Error) {
      const { message } = err;
      if (message.includes("SQLITE_CONSTRAINT: UNIQUE constraint failed:")) {
        throw new Error(UNIQUE_CONSTRAINT_FAILED);
      }
      if (message.includes("SQLITE_CONSTRAINT_FOREIGNKEY: ")) {
        throw new Error(FOREIGN_KEY_CONSTRAINT_FAILED);
      }
    }
    throw err;
  }
};

export const revokeECKeyPair = async (kid: string) => {
  try {
    const db = await store.openDb();
    return db.run(
      `UPDATE ${TBL_NM_EC_KEY_PAIRS} SET revokedAt = CURRENT_TIMESTAMP WHERE kid = ?`,
      kid,
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const updateX509CertificateDescription = async (
  kid: string,
  description: string | null,
) => {
  try {
    const db = await store.openDb();
    return db.run(
      `UPDATE ${TBL_NM_EC_KEY_X509_CERTIFICATE} SET description = ? WHERE kid = ?`,
      description,
      kid,
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const updateX509Certificate = async (kid: string, x509cert: string) => {
  try {
    const db = await store.openDb();
    return db.run(
      `UPDATE ${TBL_NM_EC_KEY_X509_CERTIFICATE} SET x509cert = ? WHERE kid = ?`,
      x509cert,
      kid,
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export const getEcKeyPair = async (kid: string) => {
  try {
    const db = await store.openDb();
    return await db.get<ECKeyPair>(
      `SELECT rowid, kid, kty, crv, x, y, d, createdAt, revokedAt FROM ${TBL_NM_EC_KEY_PAIRS} WHERE kid = ? ORDER BY createdAt DESC, rowid DESC`,
      kid,
    );
  } catch (err) {
    console.error(err);
    throw new Error("Failed to select data.");
  }
};

export interface X509CertificateData {
  x509cert: string;
  description?: string;
}

export const getX509CertificateData = async (
  kid: string,
): Promise<X509CertificateData | null> => {
  try {
    const db = await store.openDb();
    const row = await db.get<{ x509cert: string; description: string | null }>(
      `SELECT x509cert, description FROM ${TBL_NM_EC_KEY_X509_CERTIFICATE} WHERE kid = ?`,
      kid,
    );
    if (!row) return null;
    return {
      x509cert: row.x509cert,
      description: row.description || undefined,
    };
  } catch (err) {
    console.error(err);
    throw new Error("Failed to select data.");
  }
};

export const getX509Chain = async (kid: string) => {
  try {
    const db = await store.openDb();
    const row = await db.get<{ x509cert: string }>(
      `SELECT x509cert FROM ${TBL_NM_EC_KEY_X509_CERTIFICATE} WHERE kid = ?`,
      kid,
    );
    return JSON.parse(row?.x509cert || "[]");
  } catch (err) {
    console.error(err);
    throw new Error("Failed to select data.");
  }
};

export const getLatestKeyPair = async () => {
  try {
    const db = await store.openDb();

    const sql = `
      SELECT pairs.*, cert.x509cert
      FROM ${TBL_NM_EC_KEY_PAIRS} AS pairs
      LEFT JOIN ${TBL_NM_EC_KEY_X509_CERTIFICATE} AS cert ON pairs.kid = cert.kid
      WHERE pairs.revokedAt IS NULL
      ORDER BY pairs.createdAt DESC
      LIMIT 1;
    `;
    return await db.get<ECKeyPair & { x509cert?: string }>(sql);
  } catch (err) {
    console.error(err);
    throw new Error("Failed to get latest key pair and certificate.");
  }
};

export interface KeyPairWithCert extends ECKeyPair {
  x509cert?: string;
  certDescription?: string;
}

export const getAllKeyPairs = async (): Promise<KeyPairWithCert[]> => {
  try {
    const db = await store.openDb();

    const sql = `
      SELECT pairs.kid, pairs.kty, pairs.crv, pairs.x, pairs.y, pairs.createdAt, pairs.revokedAt, cert.x509cert, cert.description as certDescription
      FROM ${TBL_NM_EC_KEY_PAIRS} AS pairs
      LEFT JOIN ${TBL_NM_EC_KEY_X509_CERTIFICATE} AS cert ON pairs.kid = cert.kid
      ORDER BY pairs.createdAt DESC;
    `;
    return await db.all<KeyPairWithCert[]>(sql);
  } catch (err) {
    console.error(err);
    throw new Error("Failed to get all key pairs.");
  }
};

export default {
  createDb,
  destroyDb,
  insertECKeyPair,
  getEcKeyPair,
  insertEcKeyX509Certificate,
  getLatestKeyPair,
  getAllKeyPairs,
  revokeECKeyPair,
  updateX509CertificateDescription,
  updateX509Certificate,
  getX509Chain,
  getX509CertificateData,
};
