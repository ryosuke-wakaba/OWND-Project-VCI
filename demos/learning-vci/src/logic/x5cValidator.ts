import {
  verifyCertificateChain,
  checkEcdsaKeyEquality,
  CERT_PEM_PREAMBLE,
  CERT_PEM_POSTAMBLE,
} from "@ownd-project/ts-toolbox";
import authStore from "ownd-vci-common/dist/store/authStore.js";
import type { X5cChainValidator } from "ownd-vci/dist/oid4vci/clientAuthentication/types.js";

/**
 * Convert a base64-encoded certificate to PEM format
 */
const base64ToPem = (base64Cert: string): string => {
  return `${CERT_PEM_PREAMBLE}\n${base64Cert}\n${CERT_PEM_POSTAMBLE}`;
};

/**
 * Check if the x5c certificate's public key matches any of the trusted certificates
 * @param x5cChain - Array of Base64 DER encoded certificates
 * @returns Validation result
 */
const checkCertificatePublicKeyMatch = async (
  x5cChain: string[],
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const settings = await authStore.getWalletAttestationSettings();

    if (!settings.enableCertMatching) {
      console.log(
        "[x5cValidator] Certificate matching is disabled, skipping public key check",
      );
      return { valid: true };
    }

    console.log("[x5cValidator] Certificate matching is enabled");

    if (!x5cChain || x5cChain.length === 0) {
      return { valid: false, error: "x5c chain is empty" };
    }

    // Get enabled trusted certificates
    const trustedCerts = await authStore.getEnabledTrustedWalletProviderCerts();

    if (trustedCerts.length === 0) {
      return {
        valid: false,
        error:
          "No trusted certificates registered. Please register at least one certificate.",
      };
    }

    console.log(
      `[x5cValidator] Checking x5c certificate public key against ${trustedCerts.length} trusted certificates`,
    );

    // Get the leaf certificate (first in chain) and convert to PEM
    const x5cLeafCertPem = base64ToPem(x5cChain[0]);

    // Check if the public key matches any trusted certificate
    for (const trustedCert of trustedCerts) {
      try {
        const isMatch = checkEcdsaKeyEquality(
          trustedCert.certPem,
          x5cLeafCertPem,
        );
        if (isMatch) {
          console.log(
            `[x5cValidator] Public key matches trusted certificate: ${trustedCert.name}`,
          );
          return { valid: true };
        }
      } catch (err) {
        // Key comparison failed, try next certificate
        console.log(
          `[x5cValidator] Could not compare with certificate ${
            trustedCert.name
          }: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }

    return {
      valid: false,
      error: "Certificate public key does not match any trusted certificate",
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(
      "[x5cValidator] Error in certificate matching:",
      errorMessage,
    );
    return {
      valid: false,
      error: `Certificate matching error: ${errorMessage}`,
    };
  }
};

/**
 * Validate x5c certificate chain against trusted CA certificates
 * @param x5cChain - Array of Base64 DER encoded certificates
 * @returns Validation result
 */
const validateCertificateChain = async (
  x5cChain: string[],
): Promise<{ valid: boolean; error?: string }> => {
  try {
    const settings = await authStore.getWalletAttestationSettings();

    if (!settings.enableChainValidation) {
      console.log(
        "[x5cValidator] Chain validation is disabled, skipping x5c chain validation",
      );
      return { valid: true };
    }

    console.log("[x5cValidator] Chain validation is enabled");

    if (!x5cChain || x5cChain.length === 0) {
      return { valid: false, error: "x5c chain is empty" };
    }

    // Get enabled trusted CA certificates
    const trustedCAs = await authStore.getEnabledTrustedWalletProviderCAs();

    if (trustedCAs.length === 0) {
      return {
        valid: false,
        error:
          "No trusted CA certificates registered. Please register at least one CA certificate.",
      };
    }

    console.log(
      `[x5cValidator] Validating x5c chain (${x5cChain.length} certs) against ${trustedCAs.length} trusted CAs`,
    );

    // Extract base64 content from trusted CA certificates (remove PEM headers)
    const trustedRootCerts = trustedCAs.map((ca) => {
      return ca.rootCertPem
        .replace(/-----BEGIN CERTIFICATE-----/g, "")
        .replace(/-----END CERTIFICATE-----/g, "")
        .replace(/\s/g, "");
    });

    // Try to verify the certificate chain against trusted CAs
    try {
      await verifyCertificateChain(x5cChain, { trustedRootCerts });
      console.log("[x5cValidator] Certificate chain validation succeeded");
      return { valid: true };
    } catch (chainError) {
      const errorMessage =
        chainError instanceof Error
          ? chainError.message
          : "Unknown validation error";
      console.log(
        `[x5cValidator] Certificate chain validation failed: ${errorMessage}`,
      );
      return {
        valid: false,
        error: `Certificate chain validation failed: ${errorMessage}`,
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[x5cValidator] Unexpected error:", errorMessage);
    return {
      valid: false,
      error: `Certificate chain validation error: ${errorMessage}`,
    };
  }
};

/**
 * x5cValidator function that validates x5c certificate chains.
 *
 * The validator performs two independent checks:
 * 1. Certificate chain validation against trusted CA certificates (if enabled)
 * 2. Public key matching against trusted certificates (if enabled)
 *
 * @param x5cChain - Array of Base64 DER encoded certificates
 * @returns Validation result
 */
export const x5cValidator: X5cChainValidator = async (
  x5cChain: string[],
): Promise<{ valid: boolean; error?: string }> => {
  // Phase 1: Certificate chain validation
  const chainValidationResult = await validateCertificateChain(x5cChain);
  if (!chainValidationResult.valid) {
    return chainValidationResult;
  }

  // Phase 2: Certificate public key matching
  const certMatchResult = await checkCertificatePublicKeyMatch(x5cChain);
  if (!certMatchResult.valid) {
    return certMatchResult;
  }

  return { valid: true };
};

export default { x5cValidator };
