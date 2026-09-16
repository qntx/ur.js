import { bytesToHex, hexToBytes } from "@blockchaincommons/dcbor";
import { expect, test } from "vite-plus/test";
import { seedDigest } from "../../src/registry/index.ts";
import { seedC709, seedYinmnFull } from "./goldens.ts";

test("c709 seedDigest is BCR-2021-002 payload SHA-256", () => {
  const digest = seedDigest({ payload: hexToBytes(seedC709.payloadHex) });
  expect(bytesToHex(digest)).toBe(seedC709.digestHex);
});

test("seedDigest ignores name date note", () => {
  const digest = seedDigest({
    payload: hexToBytes(seedYinmnFull.payloadHex),
    name: seedYinmnFull.name,
    note: seedYinmnFull.note,
  });
  expect(bytesToHex(digest)).not.toBe(seedC709.digestHex);
  expect(digest.byteLength).toBe(32);
});
