import { describe, it, expect } from "vitest";
import { extractTransferToken } from "./transferQr";

const TOKEN = "V1StGXR8_Z5jdHi6B-myTQ0oGsQqVf6pNkLxWbYaCzE"; // 43-char base64url

describe("extractTransferToken", () => {
  it("extracts the token from a well-formed payload", () => {
    expect(extractTransferToken(`maxspace-transfer:${TOKEN}`)).toBe(TOKEN);
  });

  it("trims surrounding whitespace from the scanned string", () => {
    expect(extractTransferToken(`  maxspace-transfer:${TOKEN}\n`)).toBe(TOKEN);
  });

  it("accepts a shorter-but-valid token (20 chars)", () => {
    expect(extractTransferToken("maxspace-transfer:abcdefghij0123456789")).toBe(
      "abcdefghij0123456789"
    );
  });

  it("returns null for a missing prefix", () => {
    expect(extractTransferToken(TOKEN)).toBeNull();
    expect(extractTransferToken("https://passport.battery-eu.org/passports/BATT-1")).toBeNull();
  });

  it("returns null for a too-short token", () => {
    expect(extractTransferToken("maxspace-transfer:abcdefghij012345678")).toBeNull();
  });

  it("returns null when the token contains invalid characters", () => {
    expect(extractTransferToken(`maxspace-transfer:${TOKEN}!`)).toBeNull();
    expect(extractTransferToken(`maxspace-transfer:${TOKEN}:extra`)).toBeNull();
    expect(extractTransferToken(`maxspace-transfer:${TOKEN} has space`)).toBeNull();
  });

  it("returns null for empty or missing input", () => {
    expect(extractTransferToken("")).toBeNull();
    expect(extractTransferToken("   ")).toBeNull();
    expect(extractTransferToken(null)).toBeNull();
    expect(extractTransferToken(undefined)).toBeNull();
  });
});
