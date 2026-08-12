import { expect, test } from "vite-plus/test";
import { UrError } from "../src/error.ts";
import { FountainDecoder, FountainEncoder, Part } from "../src/fountain/index.ts";
import { makeMessage } from "../src/rng/index.ts";
import { Decoder, Encoder, UrType } from "../src/ur/index.ts";

function codeOf(fn: () => void): string {
  try {
    fn();
    return "none";
  } catch (e) {
    return e instanceof UrError ? e.code : "other";
  }
}

test("expectedType rejects mismatch", () => {
  const data = new TextEncoder().encode("Ten chars!".repeat(5));
  const enc = Encoder.create(data, 5, UrType.parse("alpha"));
  const part = enc.nextPart();
  const decoder = new Decoder({ expectedType: UrType.parse("beta") });
  expect(codeOf(() => decoder.receive(part))).toBe("UnexpectedType");
});

test("maxUriLen poisons uri path", () => {
  const data = new TextEncoder().encode("Ten chars!".repeat(5));
  const enc = Encoder.bytes(data, 5);
  const part = enc.nextPart();
  const decoder = new Decoder({ limits: { maxUriLen: 8 } });
  expect(codeOf(() => decoder.receive(part))).toBe("ResourceLimit");
});

test("multipart path index mismatch", () => {
  const data = new TextEncoder().encode("Ten chars!".repeat(5));
  const enc = Encoder.bytes(data, 5);
  const part = enc.nextPart();
  const corrupted = part.replace("/1-", "/2-");
  const decoder = new Decoder();
  expect(codeOf(() => decoder.receive(corrupted))).toBe("InvalidIndices");
});

test("empty part and zero sequence", () => {
  const decoder = new FountainDecoder();
  expect(codeOf(() => decoder.receive(Part.fromFields(1, 1, 1, 0, new Uint8Array())))).toBe(
    "EmptyPart",
  );
  expect(codeOf(() => decoder.receive(Part.fromFields(0, 1, 1, 0, new Uint8Array([0]))))).toBe(
    "InvalidSequence",
  );
});

test("part cbor rejects non-shortest integer", () => {
  // array(5) with sequence encoded as 0x18 0x01 (non-shortest for 1)
  const hex =
    "851801091901001a0167aa07581d916ec65cf77cadf55cd7f9cda1a1030026ddd42e905b77adc36e4f2d3c";
  const bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  expect(codeOf(() => Part.fromCbor(bytes))).toBe("InvalidPartCbor");
});

test("part cbor rejects trailing bytes", () => {
  const part = Part.fromFields(1, 1, 1, 0, new Uint8Array([0xab]));
  const cbor = part.toCbor();
  const withTrail = new Uint8Array(cbor.length + 1);
  withTrail.set(cbor);
  withTrail[cbor.length] = 0;
  expect(codeOf(() => Part.fromCbor(withTrail))).toBe("InvalidPartCbor");
});

test("part cbor oversize data is ResourceLimit", () => {
  const part = Part.fromFields(1, 1, 1, 0, new Uint8Array(32));
  const cbor = part.toCbor();
  expect(codeOf(() => Part.fromCbor(cbor, 16))).toBe("ResourceLimit");
});

test("not multipart on single-part receive", () => {
  const decoder = new Decoder();
  expect(codeOf(() => decoder.receive("ur:bytes/iehsjyhspmwfwfia"))).toBe("NotMultiPart");
});

test("fragment_count limit poisons fail-closed", () => {
  const decoder = new FountainDecoder({ maxFragmentCount: 1 });
  const message = makeMessage("Wolf", 64);
  const encoder = FountainEncoder.create(message, 8);
  expect(encoder.fragmentCount).toBeGreaterThan(1);
  expect(codeOf(() => decoder.receive(encoder.nextPart()))).toBe("ResourceLimit");
  expect(decoder.isPoisoned).toBe(true);
  expect(codeOf(() => decoder.receive(encoder.nextPart()))).toBe("ResourceLimit");
});
