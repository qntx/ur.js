import { sha256 } from "@noble/hashes/sha2.js";
import type { Seed } from "./seed.ts";

/** BCR-2021-002: SHA-256 of the raw seed payload, not the CBOR map. */
export function seedDigest(seed: Seed): Uint8Array {
  return sha256(seed.payload);
}
