/**
 * DPoP (Demonstrating Proof of Possession) Module
 * RFC9449: https://www.rfc-editor.org/rfc/rfc9449.html
 */

// Types
export type {
  DpopProofHeader,
  DpopProofPayload,
  DpopValidationOptions,
  DpopValidationResult,
  DpopValidationSuccess,
  DpopValidationFailure,
  DpopErrorCode,
  TokenType,
  DpopBoundAccessToken,
} from "./types.js";

// Validation
export { validateDpopProof, hasDpopHeader } from "./validateDpopProof.js";

// Utilities
export {
  calculateJwkThumbprint,
  calculateAccessTokenHash,
  normalizeHttpUri,
  compareHttpUri,
  hasPrivateKey,
  isAllowedAlgorithm,
  isIatWithinTolerance,
  DEFAULT_ALLOWED_ALGORITHMS,
  DEFAULT_IAT_TOLERANCE_SECONDS,
} from "./utils.js";
