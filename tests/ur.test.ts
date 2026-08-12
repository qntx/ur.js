import { expect, test } from "vite-plus/test";
import { UrError } from "../src/error.ts";
import { makeMessage } from "../src/rng/index.ts";
import { Decoder, Encoder, UrType, decode, encode, parse, toQrString } from "../src/ur/index.ts";

/** CBOR bstr wrapping (major type 2) — matches ur-rs test helper for message URs. */
function cborBstr(message: Uint8Array): Uint8Array {
  const len = message.length;
  let header: number[];
  if (len <= 23) header = [0x40 | len];
  else if (len <= 0xff) header = [0x58, len];
  else if (len <= 0xffff) header = [0x59, (len >>> 8) & 0xff, len & 0xff];
  else header = [0x5a, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
  const out = new Uint8Array(header.length + len);
  out.set(header);
  out.set(message, header.length);
  return out;
}

function makeMessageUr(length: number, seed: string): Uint8Array {
  return cborBstr(makeMessage(seed, length));
}

test("single part ur", () => {
  const ur = makeMessageUr(50, "Wolf");
  const encoded = encode(ur, UrType.bytes());
  const expected =
    "ur:bytes/hdeymejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtgwdpfnsboxgwlbaawzuefywkdplrsrjynbvygabwjldapfcsdwkbrkch";
  expect(encoded).toBe(expected);
  const decoded = decode(encoded);
  expect(decoded.kind).toBe("single");
  expect(decoded.payload).toEqual(ur);
});

test("ur encoder first three parts (smoke; full 20 in interop-ur-rs)", () => {
  const ur = makeMessageUr(256, "Wolf");
  const encoder = Encoder.bytes(ur, 30);
  const expected = [
    "ur:bytes/1-9/lpadascfadaxcywenbpljkhdcahkadaemejtswhhylkepmykhhtsytsnoyoyaxaedsuttydmmhhpktpmsrjtdkgslpgh",
    "ur:bytes/2-9/lpaoascfadaxcywenbpljkhdcagwdpfnsboxgwlbaawzuefywkdplrsrjynbvygabwjldapfcsgmghhkhstlrdcxaefz",
    "ur:bytes/3-9/lpaxascfadaxcywenbpljkhdcahelbknlkuejnbadmssfhfrdpsbiegecpasvssovlgeykssjykklronvsjksopdzmol",
  ];
  expect(encoder.fragmentCount).toBe(9);
  for (let index = 0; index < expected.length; index++) {
    expect(encoder.currentIndex).toBe(index);
    expect(encoder.nextPart()).toBe(expected[index]);
  }
});

test("multipart ur", () => {
  const ur = makeMessageUr(32767, "Wolf");
  const encoder = Encoder.bytes(ur, 1000);
  const decoder = new Decoder();
  while (!decoder.complete) {
    expect(decoder.message()).toBeUndefined();
    decoder.receive(encoder.nextPart());
  }
  expect(decoder.message()).toEqual(ur);
});

test("data encode", () => {
  expect(encode(new TextEncoder().encode("data"), UrType.bytes())).toBe(
    "ur:bytes/iehsjyhspmwfwfia",
  );
});

test("case fold", () => {
  const lower = encode(new TextEncoder().encode("data"), UrType.bytes());
  const upper = toQrString(lower);
  expect(decode(upper)).toEqual(decode(lower));
});

test("type stickiness", () => {
  const data = new TextEncoder().encode("Ten chars!".repeat(5));
  const encA = Encoder.create(data, 5, UrType.parse("alpha"));
  const encB = Encoder.create(data, 5, UrType.parse("beta"));
  const decoder = new Decoder();
  decoder.receive(encA.nextPart());
  expect(() => decoder.receive(encB.nextPart())).toThrowError(UrError);
});

test("invalid scheme", () => {
  expect(() => decode("uhr:bytes/aeadaolazmjendeoti")).toThrowError(UrError);
});

test("custom encoder", () => {
  const data = new TextEncoder().encode("Ten chars!");
  const encoder = Encoder.create(data, 5, UrType.parse("my-scheme"));
  expect(encoder.nextPart()).toBe("ur:my-scheme/1-2/lpadaobkcywkwmhfwnfeghihjtcxiansvomopr");
});

test("not multipart", () => {
  const decoder = new Decoder();
  expect(() => decoder.receive("ur:bytes/iehsjyhspmwfwfia")).toThrowError(UrError);
});

test("bc-ur example array", () => {
  const cbor = Uint8Array.from([0x83, 0x01, 0x02, 0x03]);
  const ur = encode(cbor, UrType.parse("test"));
  expect(ur).toBe("ur:test/lsadaoaxjygonesw");
  const { kind, payload } = decode(ur);
  expect(kind).toBe("single");
  expect(payload).toEqual(cbor);
});

test("parse", () => {
  const ur = encode(new TextEncoder().encode("data"), UrType.bytes());
  const parsed = parse(ur);
  expect(parsed.kind).toBe("single");
  expect(parsed.type.value).toBe("bytes");
  expect(parsed.indices).toBeUndefined();
});

test("empty single part", () => {
  const ur = encode(new Uint8Array(), UrType.bytes());
  const { kind, payload } = decode(ur);
  expect(kind).toBe("single");
  expect(payload).toEqual(new Uint8Array());
});
