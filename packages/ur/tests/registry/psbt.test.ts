import {
  CborError,
  bytesToHex,
  decodeCbor,
  encodeCbor,
  expectBytes,
  hexToBytes,
} from "@blockchaincommons/dcbor";
import { expect, test } from "vite-plus/test";
import {
  Ur,
  UrError,
  fromUr,
  fromUrString,
  psbtCodec,
  toUr,
  toUrString,
  type Psbt,
} from "../../src/registry/index.ts";
import { psbt167 } from "./goldens.ts";

function errorOf(fn: () => void): UrError {
  try {
    fn();
  } catch (e) {
    if (e instanceof UrError) return e;
    throw e;
  }
  throw new Error("expected UrError");
}

function psbtBytes(): Uint8Array {
  return new Uint8Array(expectBytes(decodeCbor(hexToBytes(psbt167.cborHex))));
}

test("psbt codec tag", () => {
  expect(psbtCodec.tags[0]?.name).toBe("psbt");
  expect(psbtCodec.tags[0]?.value).toBe(40_310);
});

test("167-byte PSBT write golden", () => {
  const psbt: Psbt = { bytes: psbtBytes() };
  expect(psbt.bytes.byteLength).toBe(167);
  expect(bytesToHex(encodeCbor(psbtCodec.untaggedCbor(psbt)))).toBe(psbt167.cborHex);
  expect(toUrString(psbt, psbtCodec)).toBe(psbt167.ur);
  const decoded = fromUrString(psbt167.ur, psbtCodec);
  expect(bytesToHex(decoded.bytes)).toBe(bytesToHex(psbt.bytes));
});

test("toUr copies caller bytes", () => {
  const bytes = psbtBytes();
  const ur = toUr({ bytes }, psbtCodec);
  bytes[0] = 0;
  expect(ur.string()).toBe(psbt167.ur);
});

test("fromUr copies decoded bytes", () => {
  const ur = Ur.fromUrString(psbt167.ur);
  const decoded = fromUr(ur, psbtCodec);
  decoded.bytes[0] = 0;
  expect(bytesToHex(fromUr(ur, psbtCodec).bytes)).toBe(bytesToHex(psbtBytes()));
});

test("PSBT without magic prefix is CborType", () => {
  const bytes = new Uint8Array(167);
  bytes.set([0x70, 0x73, 0x62, 0x74, 0xfe]);
  const encodeErr = errorOf(() => toUrString({ bytes }, psbtCodec));
  expect(encodeErr.code).toBe("CborType");
  expect(CborError.isCborError(encodeErr.cause)).toBe(true);
  if (CborError.isCborError(encodeErr.cause)) expect(encodeErr.cause.code).toBe("WrongType");

  const uri = Ur.create("psbt", bytes).string();
  const decodeErr = errorOf(() => fromUrString(uri, psbtCodec));
  expect(decodeErr.code).toBe("CborType");
});

test("PSBT shorter than magic is CborType OutOfRange", () => {
  const err = errorOf(() =>
    toUrString({ bytes: new Uint8Array([0x70, 0x73, 0x62, 0x74]) }, psbtCodec),
  );
  expect(err.code).toBe("CborType");
  expect(CborError.isCborError(err.cause)).toBe(true);
  if (CborError.isCborError(err.cause)) expect(err.cause.code).toBe("OutOfRange");
});

test("crypto-psbt type token is UnexpectedType", () => {
  const uri = Ur.create("crypto-psbt", psbtCodec.untaggedCbor({ bytes: psbtBytes() })).string();
  const err = errorOf(() => fromUrString(uri, psbtCodec));
  expect(err.code).toBe("UnexpectedType");
  expect(err.expected).toBe("psbt");
  expect(err.found).toBe("crypto-psbt");
});
