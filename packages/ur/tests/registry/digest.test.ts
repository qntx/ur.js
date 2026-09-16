import { sha256 } from "@noble/hashes/sha2.js";
import { CborDate, bytesToHex, hexToBytes } from "@blockchaincommons/dcbor";
import { expect, test } from "vite-plus/test";
import { seedDigest } from "../../src/registry/index.ts";
import { seedC709, seedYinmnFull } from "./goldens.ts";

test("c709 seedDigest is BCR-2021-002 payload SHA-256", () => {
  const digest = seedDigest({ payload: hexToBytes(seedC709.payloadHex) });
  expect(bytesToHex(digest)).toBe(seedC709.digestHex);
});

test("seedDigest ignores name date note", () => {
  const payload = hexToBytes(seedYinmnFull.payloadHex);
  const expected = bytesToHex(sha256(payload));
  const bare = seedDigest({ payload });
  const full = seedDigest({
    payload,
    creationDate: CborDate.fromEpochSeconds(seedYinmnFull.epochSeconds),
    name: seedYinmnFull.name,
    note: seedYinmnFull.note,
  });
  expect(bytesToHex(bare)).toBe(expected);
  expect(bytesToHex(full)).toBe(expected);
});
