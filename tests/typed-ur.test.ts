import { cbor, cborEquals } from "@blockchaincommons/dcbor";
import { expect, test } from "vite-plus/test";
import { Encoder, encode } from "../src/ur/index.ts";
import { Ur, UrError, UrType } from "../src/typed/index.ts";

function errorOf(fn: () => void): UrError {
  try {
    fn();
  } catch (e) {
    if (e instanceof UrError) return e;
    throw e;
  }
  throw new Error("expected UrError");
}

test("dCBOR array golden roundtrip", () => {
  const created = Ur.create("test", cbor([1, 2, 3]));
  expect(created.string()).toBe("ur:test/lsadaoaxjygonesw");
  const decoded = Ur.fromUrString(created.string());
  expect(cborEquals(created.cbor, decoded.cbor)).toBe(true);
  expect(created.type.equals(decoded.type)).toBe(true);
  expect(decoded.string()).toBe(created.string());
});

test("L4 rejects L3 UTF-8 hello", () => {
  const hello = encode(new TextEncoder().encode("hello"), UrType.bytes());
  expect(errorOf(() => Ur.fromUrString(hello)).code).toBe("CborDecode");
});

test("empty L3 payload is CborDecode", () => {
  expect(errorOf(() => Ur.fromUrString(encode(new Uint8Array(), UrType.bytes()))).code).toBe(
    "CborDecode",
  );
});

test("non-canonical integer body is CborDecode", () => {
  const uri = encode(Uint8Array.from([0x18, 0x01]), UrType.bytes());
  expect(errorOf(() => Ur.fromUrString(uri)).code).toBe("CborDecode");
});

test("multipart URI is NotSinglePart", () => {
  const encoder = Encoder.bytes(new TextEncoder().encode("Ten chars!".repeat(8)), 5);
  expect(encoder.isSinglePart).toBe(false);
  expect(errorOf(() => Ur.fromUrString(encoder.nextPart())).code).toBe("NotSinglePart");
});

test("uppercase fromUrString matches golden", () => {
  const decoded = Ur.fromUrString("UR:TEST/LSADAOAXJYGONESW");
  expect(decoded.string()).toBe("ur:test/lsadaoaxjygonesw");
  expect(decoded.type.value).toBe("test");
  expect(cborEquals(decoded.cbor, cbor([1, 2, 3]))).toBe(true);
});

test("empty or illegal type on Ur.create is InvalidType", () => {
  expect(errorOf(() => Ur.create("", cbor([1, 2, 3]))).code).toBe("InvalidType");
  expect(errorOf(() => Ur.create("not_a_type", cbor([1, 2, 3]))).code).toBe("InvalidType");
});

test("encode-side cbor failure is CborType", () => {
  const tagged = errorOf(() => Ur.create("test", { tag: 1, value: 2 }));
  expect(tagged).toBeInstanceOf(UrError);
  expect(tagged.code).toBe("CborType");
  const range = errorOf(() => Ur.create("test", 1n << 64n));
  expect(range).toBeInstanceOf(UrError);
  expect(range.code).toBe("CborType");
});
