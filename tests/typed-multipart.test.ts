import { cbor, cborEquals } from "@blockchaincommons/dcbor";
import { expect, test } from "vite-plus/test";
import { UrError } from "../src/error.ts";
import { Encoder, UrType } from "../src/ur/index.ts";
import { MultipartDecoder, MultipartEncoder } from "../src/typed/multipart.ts";
import { Ur } from "../src/typed/ur.ts";

function errorOf(fn: () => void): UrError {
  try {
    fn();
  } catch (e) {
    if (e instanceof UrError) return e;
    throw e;
  }
  throw new Error("expected UrError");
}

function largeTestUr(): Ur {
  const bytes = new Uint8Array(256);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i & 0xff;
  return Ur.create("test", bytes);
}

test("K==1 emits single-part", () => {
  const ur = Ur.create("test", cbor([1, 2, 3]));
  const encoder = MultipartEncoder.create(ur, 64);
  expect(encoder.isSinglePart).toBe(true);
  expect(encoder.fragmentCount).toBe(1);
  const part = encoder.nextPart();
  expect(part.includes("/1-1/")).toBe(false);
  expect(part).toBe("ur:test/lsadaoaxjygonesw");
});

test("drop-odd-parts roundtrip same Cbor", () => {
  const ur = largeTestUr();
  const encoder = MultipartEncoder.create(ur, 30);
  expect(encoder.isSinglePart).toBe(false);
  const decoder = new MultipartDecoder();
  let skip = false;
  while (!decoder.complete) {
    const part = encoder.nextPart();
    if (!skip) decoder.receive(part);
    skip = !skip;
  }
  const recovered = decoder.message();
  expect(recovered).toBeDefined();
  expect(cborEquals(recovered!.cbor, ur.cbor)).toBe(true);
  expect(recovered!.type.equals(ur.type)).toBe(true);
});

test("expectedType mismatch is UnexpectedType and is not poison", () => {
  const ur = Ur.create("alpha", cbor([1, 2, 3]));
  const encoder = MultipartEncoder.create(ur, 64);
  const decoder = new MultipartDecoder({ expectedType: UrType.parse("beta") });
  const err = errorOf(() => decoder.receive(encoder.nextPart()));
  expect(err.code).toBe("UnexpectedType");
  expect(err.expected).toBe("beta");
  expect(err.found).toBe("alpha");
  expect(decoder.isPoisoned).toBe(false);
});

test("maxUriLen poisons on a longer URI", () => {
  const ur = Ur.create("test", cbor([1, 2, 3]));
  const part = MultipartEncoder.create(ur, 64).nextPart();
  const decoder = new MultipartDecoder({ limits: { maxUriLen: 8 } });
  expect(part.length).toBeGreaterThan(8);
  const err = errorOf(() => decoder.receive(part));
  expect(err.code).toBe("ResourceLimit");
  expect(err.limit).toBe("uri_len");
  expect(decoder.isPoisoned).toBe(true);
  expect(decoder.poisonState).toEqual({ code: "ResourceLimit", limit: "uri_len" });
});

test("non-dCBOR complete payload is CborDecode and not poison", () => {
  const encoder = Encoder.bytes(new TextEncoder().encode("hello"), 64);
  const decoder = new MultipartDecoder();
  decoder.receive(encoder.nextPart());
  expect(decoder.complete).toBe(true);
  expect(errorOf(() => decoder.message()).code).toBe("CborDecode");
  expect(decoder.isPoisoned).toBe(false);
});

test("uppercase fountain parts roundtrip", () => {
  const ur = largeTestUr();
  const encoder = MultipartEncoder.create(ur, 30);
  expect(encoder.isSinglePart).toBe(false);
  const decoder = new MultipartDecoder();
  while (!decoder.complete) {
    decoder.receive(encoder.nextPart().toUpperCase());
  }
  const recovered = decoder.message();
  expect(recovered).toBeDefined();
  expect(cborEquals(recovered!.cbor, ur.cbor)).toBe(true);
  expect(recovered!.type.equals(ur.type)).toBe(true);
});
