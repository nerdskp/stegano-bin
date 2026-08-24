const MAGIC = "SGB1";
const VERSION = 1;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;
const PBKDF2_ITERATIONS = 310_000;
const AES_KEY_LENGTH_BITS = 256;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class CryptoPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoPayloadError";
  }
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new CryptoPayloadError(
      "Web Crypto API is unavailable. AES-GCM encryption requires a secure browser context.",
    );
  }

  return subtle;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.getRandomValues) {
    throw new CryptoPayloadError(
      "Secure random generation is unavailable in this environment.",
    );
  }

  return globalThis.crypto;
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new CryptoPayloadError(`${label} must be a non-empty string.`);
  }
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const passphraseKey = await subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passphraseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

function parseEncryptedPayload(payload: Uint8Array): {
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
} {
  const minimumLength =
    MAGIC.length + 1 + SALT_LENGTH_BYTES + IV_LENGTH_BYTES + 1;

  if (!(payload instanceof Uint8Array) || payload.length < minimumLength) {
    throw new CryptoPayloadError("Encrypted payload is too short or invalid.");
  }

  const magic = textDecoder.decode(payload.subarray(0, MAGIC.length));
  if (magic !== MAGIC) {
    throw new CryptoPayloadError("Encrypted payload has an unknown format.");
  }

  const version = payload[MAGIC.length];
  if (version !== VERSION) {
    throw new CryptoPayloadError(
      `Unsupported encrypted payload version: ${version}.`,
    );
  }

  const saltStart = MAGIC.length + 1;
  const ivStart = saltStart + SALT_LENGTH_BYTES;
  const ciphertextStart = ivStart + IV_LENGTH_BYTES;

  return {
    salt: payload.subarray(saltStart, ivStart),
    iv: payload.subarray(ivStart, ciphertextStart),
    ciphertext: payload.subarray(ciphertextStart),
  };
}

/**
 * Encrypts a UTF-8 string with AES-256-GCM using a key derived from a passphrase.
 *
 * Output format:
 *   4 bytes magic | 1 byte version | 16 bytes salt | 12 bytes IV | ciphertext+auth tag
 */
export async function encryptString(
  plaintext: string,
  passphrase: string,
): Promise<Uint8Array> {
  assertNonEmptyString(plaintext, "Plaintext");
  assertNonEmptyString(passphrase, "Passphrase");

  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const key = await deriveAesKey(passphrase, salt);

  const encrypted = await getSubtleCrypto().encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plaintext),
  );

  return concatBytes([
    textEncoder.encode(MAGIC),
    Uint8Array.of(VERSION),
    salt,
    iv,
    new Uint8Array(encrypted),
  ]);
}

/**
 * Decrypts a payload produced by encryptString back into a UTF-8 string.
 */
export async function decryptString(
  encryptedPayload: Uint8Array,
  passphrase: string,
): Promise<string> {
  assertNonEmptyString(passphrase, "Passphrase");

  const { salt, iv, ciphertext } = parseEncryptedPayload(encryptedPayload);
  const key = await deriveAesKey(passphrase, salt);

  try {
    const decrypted = await getSubtleCrypto().decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext,
    );

    return textDecoder.decode(decrypted);
  } catch {
    throw new CryptoPayloadError(
      "Decryption failed. The passphrase may be incorrect or the payload may be corrupted.",
    );
  }
}

