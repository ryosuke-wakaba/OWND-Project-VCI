import { decodeProtectedHeader, decodeJwt } from "jose";

export interface DecodedJwt {
  raw: string;
  header: object;
  payload: object;
}

/**
 * Decode a JWT into its header and payload parts
 * @param jwt - The JWT string to decode
 * @returns The decoded parts or null if decoding fails
 */
export function decodeJwtParts(jwt: string): DecodedJwt | null {
  try {
    const header = decodeProtectedHeader(jwt);
    const payload = decodeJwt(jwt);
    return { raw: jwt, header, payload };
  } catch {
    return null;
  }
}

/**
 * Safely stringify an object for storage
 * @param obj - The object to stringify
 * @returns JSON string or undefined
 */
export function safeStringify(obj: object | null | undefined): string | undefined {
  if (!obj) return undefined;
  try {
    return JSON.stringify(obj);
  } catch {
    return undefined;
  }
}
