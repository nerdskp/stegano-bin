import { encryptString, decryptString } from "./lib/core/crypto";
import { shatterPayload, reconstructPayload } from "./lib/core/sss";
import * as crypto from "crypto";

// Polyfill web crypto for the script
globalThis.crypto = crypto.webcrypto as any;

async function test() {
  const secret = "Hello World";
  const pass = "password";
  const encrypted = await encryptString(secret, pass);
  console.log("Encrypted length:", encrypted.length);
  console.log("Original Bytes:", encrypted.slice(0, 10));

  const shares = shatterPayload(encrypted, 4, 3);
  console.log("Shares generated:", shares.length);

  const reconstructed = reconstructPayload(shares.slice(0, 3));
  console.log("Reconstructed Bytes:", reconstructed.slice(0, 10));

  if (encrypted.length !== reconstructed.length) {
    console.error("Length mismatch!", encrypted.length, reconstructed.length);
  }

  let mismatch = false;
  for (let i = 0; i < encrypted.length; i++) {
    if (encrypted[i] !== reconstructed[i]) {
      console.error(`Mismatch at ${i}: expected ${encrypted[i]}, got ${reconstructed[i]}`);
      mismatch = true;
      break;
    }
  }

  if (!mismatch) {
    console.log("Match perfect!");
  }
}

test().catch(console.error);
