import * as fs from "fs";
import * as crypto from "crypto";
import { CRV } from "elliptic-jwk";
import keyStore from "ownd-vci-common/dist/store/keyStore.js";

interface KeyLoaderConfig {
  keyFilePath?: string;
  certFilePath?: string;
  keyId?: string;
}

const pemToBase64 = (pem: string): string => {
  return pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "");
};

const getKeyConfig = (): KeyLoaderConfig => {
  return {
    keyFilePath: process.env.KEY_FILE_PATH,
    certFilePath: process.env.CERT_FILE_PATH,
    keyId: process.env.KEY_ID || "issuer-key-1",
  };
};

export const loadKeyAndCertificate = async (): Promise<void> => {
  const config = getKeyConfig();

  if (!config.keyFilePath || !config.certFilePath) {
    console.log(
      "KEY_FILE_PATH or CERT_FILE_PATH not set, skipping key/certificate loading",
    );
    return;
  }

  if (!fs.existsSync(config.keyFilePath)) {
    console.error(`Key file not found: ${config.keyFilePath}`);
    return;
  }

  if (!fs.existsSync(config.certFilePath)) {
    console.error(`Certificate file not found: ${config.certFilePath}`);
    return;
  }

  const kid = config.keyId!;

  try {
    // Read private key PEM
    const keyPem = fs.readFileSync(config.keyFilePath, "utf-8");
    const privateKey = crypto.createPrivateKey(keyPem);
    const jwk = privateKey.export({ format: "jwk" });

    // Validate key type
    if (jwk.kty !== "EC") {
      console.error("Only EC keys are supported");
      return;
    }

    // Check if key already exists
    const existingKey = await keyStore.getEcKeyPair(kid);

    if (existingKey) {
      // Check if key matches
      if (existingKey.x === jwk.x && existingKey.y === jwk.y) {
        console.log(`Key ${kid} already exists with same public key`);
      } else {
        console.log(
          `Key ${kid} exists with different public key, revoking old key`,
        );
        await keyStore.revokeECKeyPair(kid);
        // Insert new key with different kid
        const newKid = `${kid}-${Date.now()}`;
        await keyStore.insertECKeyPair({
          kid: newKid,
          kty: jwk.kty,
          crv: jwk.crv as CRV,
          x: jwk.x!,
          y: jwk.y!,
          d: jwk.d!,
        });
        console.log(`Inserted new key: ${newKid}`);

        // Register certificate for new key
        await registerCertificate(newKid, config.certFilePath);
        return;
      }
    } else {
      // Insert new key
      await keyStore.insertECKeyPair({
        kid,
        kty: jwk.kty,
        crv: jwk.crv as CRV,
        x: jwk.x!,
        y: jwk.y!,
        d: jwk.d!,
      });
      console.log(`Inserted key: ${kid}`);
    }

    // Register certificate
    await registerCertificate(kid, config.certFilePath);
  } catch (err) {
    console.error("Failed to load key/certificate:", err);
  }
};

const registerCertificate = async (
  kid: string,
  certFilePath: string,
): Promise<void> => {
  const certPem = fs.readFileSync(certFilePath, "utf-8");

  // Split multiple certificates if present (certificate chain)
  const certMatches = certPem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
  );

  if (!certMatches || certMatches.length === 0) {
    console.error("No valid certificates found in file");
    return;
  }

  // Convert PEM to base64 DER format for x5c
  const x5c = certMatches.map((cert) => pemToBase64(cert));

  // Check existing certificate
  const existingChain = await keyStore.getX509Chain(kid);

  if (existingChain.length > 0) {
    // Compare first certificate
    if (existingChain[0] === x5c[0]) {
      console.log(`Certificate for ${kid} already registered`);
      return;
    }
    console.log(`Updating certificate for ${kid}`);
  }

  await keyStore.insertEcKeyX509Certificate(kid, JSON.stringify(x5c));
  console.log(`Registered certificate chain for ${kid} (${x5c.length} certs)`);
};

export default {
  loadKeyAndCertificate,
};
