import * as secretsModule from "secrets.js-grempe";

type SecretsJs = {
  share(secret: string, numShares: number, threshold: number): string[];
  combine(shares: string[]): string;
};

const secrets = secretsModule as unknown as SecretsJs;

export class SecretSharingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretSharingError";
  }
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";

  for (let index = 0; index < bytes.length; index += 1) {
    hex += bytes[index].toString(16).padStart(2, "0");
  }

  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new SecretSharingError("Combined secret is not valid hexadecimal data.");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function assertShareConfig(total: number, threshold: number): void {
  if (!Number.isInteger(total) || total < 2) {
    throw new SecretSharingError("Total shares must be an integer greater than 1.");
  }

  if (!Number.isInteger(threshold) || threshold < 2) {
    throw new SecretSharingError("Threshold must be an integer greater than 1.");
  }

  if (threshold > total) {
    throw new SecretSharingError("Threshold cannot be greater than total shares.");
  }
}

/**
 * Splits encrypted bytes into Shamir Secret Sharing shares.
 *
 * secrets.js-grempe operates on hexadecimal strings, so the encrypted Uint8Array
 * is encoded as hex before being split over the library's Galois Field math.
 */
export function shatterPayload(
  encryptedData: Uint8Array,
  total: number,
  threshold: number,
): string[] {
  if (!(encryptedData instanceof Uint8Array) || encryptedData.length === 0) {
    throw new SecretSharingError("Encrypted data must be a non-empty Uint8Array.");
  }

  assertShareConfig(total, threshold);

  try {
    return secrets.share(bytesToHex(encryptedData), total, threshold);
  } catch (error) {
    throw new SecretSharingError(
      error instanceof Error
        ? `Failed to create shares: ${error.message}`
        : "Failed to create shares.",
    );
  }
}

/**
 * Recombines enough Shamir shares back into the original encrypted bytes.
 */
export function reconstructPayload(shares: string[]): Uint8Array {
  if (!Array.isArray(shares) || shares.length < 2) {
    throw new SecretSharingError("At least two shares are required for reconstruction.");
  }

  if (shares.some((share) => typeof share !== "string" || share.length === 0)) {
    throw new SecretSharingError("Shares must be non-empty strings.");
  }

  try {
    return hexToBytes(secrets.combine(shares));
  } catch (error) {
    throw new SecretSharingError(
      error instanceof Error
        ? `Failed to reconstruct payload: ${error.message}`
        : "Failed to reconstruct payload.",
    );
  }
}

