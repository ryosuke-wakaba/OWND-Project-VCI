import { assert } from "chai";
import ellipticJwk, { publicJwkFromPrivate } from "elliptic-jwk";
import * as jose from "jose";

import {
  calculateJwkThumbprint,
  calculateAccessTokenHash,
  normalizeHttpUri,
  compareHttpUri,
  hasPrivateKey,
  isAllowedAlgorithm,
  isIatWithinTolerance,
  DEFAULT_ALLOWED_ALGORITHMS,
} from "../../../src/oid4vci/dpop/utils.js";

describe("DPoP Utils", () => {
  describe("calculateJwkThumbprint", () => {
    it("should calculate JWK thumbprint for EC key", async () => {
      const privateJwk = ellipticJwk.newPrivateJwk("P-256");
      const publicJwk = publicJwkFromPrivate(privateJwk);

      const thumbprint = await calculateJwkThumbprint(publicJwk);

      assert.isString(thumbprint);
      assert.isNotEmpty(thumbprint);
      // Base64URL format
      assert.match(thumbprint, /^[A-Za-z0-9_-]+$/);
    });

    it("should produce consistent thumbprint for same key", async () => {
      const privateJwk = ellipticJwk.newPrivateJwk("P-256");
      const publicJwk = publicJwkFromPrivate(privateJwk);

      const thumbprint1 = await calculateJwkThumbprint(publicJwk);
      const thumbprint2 = await calculateJwkThumbprint(publicJwk);

      assert.equal(thumbprint1, thumbprint2);
    });

    it("should produce different thumbprints for different keys", async () => {
      const privateJwk1 = ellipticJwk.newPrivateJwk("P-256");
      const privateJwk2 = ellipticJwk.newPrivateJwk("P-256");
      const publicJwk1 = publicJwkFromPrivate(privateJwk1);
      const publicJwk2 = publicJwkFromPrivate(privateJwk2);

      const thumbprint1 = await calculateJwkThumbprint(publicJwk1);
      const thumbprint2 = await calculateJwkThumbprint(publicJwk2);

      assert.notEqual(thumbprint1, thumbprint2);
    });
  });

  describe("calculateAccessTokenHash", () => {
    it("should calculate SHA-256 hash of access token", () => {
      const accessToken = "test-access-token";
      const hash = calculateAccessTokenHash(accessToken);

      assert.isString(hash);
      assert.isNotEmpty(hash);
      // Base64URL format
      assert.match(hash, /^[A-Za-z0-9_-]+$/);
    });

    it("should produce consistent hash for same token", () => {
      const accessToken = "test-access-token";

      const hash1 = calculateAccessTokenHash(accessToken);
      const hash2 = calculateAccessTokenHash(accessToken);

      assert.equal(hash1, hash2);
    });

    it("should produce different hashes for different tokens", () => {
      const hash1 = calculateAccessTokenHash("token1");
      const hash2 = calculateAccessTokenHash("token2");

      assert.notEqual(hash1, hash2);
    });
  });

  describe("normalizeHttpUri", () => {
    it("should remove query string", () => {
      const uri = "https://example.com/path?query=value";
      const normalized = normalizeHttpUri(uri);

      assert.equal(normalized, "https://example.com/path");
    });

    it("should remove fragment", () => {
      const uri = "https://example.com/path#fragment";
      const normalized = normalizeHttpUri(uri);

      assert.equal(normalized, "https://example.com/path");
    });

    it("should remove both query and fragment", () => {
      const uri = "https://example.com/path?query=value#fragment";
      const normalized = normalizeHttpUri(uri);

      assert.equal(normalized, "https://example.com/path");
    });

    it("should preserve scheme, host and path", () => {
      const uri = "https://example.com:8080/api/token";
      const normalized = normalizeHttpUri(uri);

      assert.equal(normalized, "https://example.com:8080/api/token");
    });

    it("should handle URI without path", () => {
      const uri = "https://example.com";
      const normalized = normalizeHttpUri(uri);

      assert.equal(normalized, "https://example.com/");
    });
  });

  describe("compareHttpUri", () => {
    it("should return true for matching URIs", () => {
      assert.isTrue(
        compareHttpUri("https://example.com/path", "https://example.com/path"),
      );
    });

    it("should return true when only query differs", () => {
      assert.isTrue(
        compareHttpUri(
          "https://example.com/path?a=1",
          "https://example.com/path?b=2",
        ),
      );
    });

    it("should return true when only fragment differs", () => {
      assert.isTrue(
        compareHttpUri(
          "https://example.com/path#section1",
          "https://example.com/path#section2",
        ),
      );
    });

    it("should return false for different paths", () => {
      assert.isFalse(
        compareHttpUri(
          "https://example.com/path1",
          "https://example.com/path2",
        ),
      );
    });

    it("should return false for different hosts", () => {
      assert.isFalse(
        compareHttpUri("https://example.com/path", "https://other.com/path"),
      );
    });
  });

  describe("hasPrivateKey", () => {
    it("should return true for JWK with private key", () => {
      const privateJwk = ellipticJwk.newPrivateJwk("P-256");
      assert.isTrue(hasPrivateKey(privateJwk as jose.JWK));
    });

    it("should return false for JWK without private key", () => {
      const privateJwk = ellipticJwk.newPrivateJwk("P-256");
      const publicJwk = publicJwkFromPrivate(privateJwk);
      assert.isFalse(hasPrivateKey(publicJwk as jose.JWK));
    });
  });

  describe("isAllowedAlgorithm", () => {
    it("should return true for allowed algorithms", () => {
      assert.isTrue(isAllowedAlgorithm("ES256"));
      assert.isTrue(isAllowedAlgorithm("ES384"));
      assert.isTrue(isAllowedAlgorithm("ES512"));
      assert.isTrue(isAllowedAlgorithm("PS256"));
    });

    it("should return false for none algorithm", () => {
      assert.isFalse(isAllowedAlgorithm("none"));
    });

    it("should return false for symmetric algorithms", () => {
      assert.isFalse(isAllowedAlgorithm("HS256"));
      assert.isFalse(isAllowedAlgorithm("HS384"));
    });

    it("should respect custom allowed list", () => {
      assert.isTrue(isAllowedAlgorithm("ES256", ["ES256"]));
      assert.isFalse(isAllowedAlgorithm("ES384", ["ES256"]));
    });
  });

  describe("isIatWithinTolerance", () => {
    it("should return true for current timestamp", () => {
      const now = Math.floor(Date.now() / 1000);
      assert.isTrue(isIatWithinTolerance(now));
    });

    it("should return true for timestamp within tolerance", () => {
      const now = Math.floor(Date.now() / 1000);
      assert.isTrue(isIatWithinTolerance(now - 100, 300));
      assert.isTrue(isIatWithinTolerance(now + 100, 300));
    });

    it("should return false for timestamp outside tolerance", () => {
      const now = Math.floor(Date.now() / 1000);
      assert.isFalse(isIatWithinTolerance(now - 400, 300));
      assert.isFalse(isIatWithinTolerance(now + 400, 300));
    });
  });
});
