/**
 * Canonical contract vectors for ur.js + bcur sister interop.
 * Files in tests/vectors/ are a byte-identical copy of
 * bcur crates/bcur/tests/vectors/contract/.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import {
  DEFAULT_LIMITS,
  Decoder,
  Encoder,
  FountainEncoder,
  Part,
  UrError,
  UrType,
  bytewords,
  decode,
  encode,
} from "../src/index.ts";
import { nextSequence } from "../src/fountain/index.ts";
import { MultipartDecoder, Ur } from "../src/typed/index.ts";

const VECTORS = join(import.meta.dirname, "vectors");

function readVector(name: string): string {
  return readFileSync(join(VECTORS, name), "utf8");
}

function jsonVector<T>(name: string): T {
  return JSON.parse(readVector(name)) as T;
}

function fromHex(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

function dataLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function assertLineFile(raw: string): void {
  expect(raw.endsWith("\n")).toBe(true);
  expect(raw.includes("\r")).toBe(false);
  expect(raw.split("\n").some((line) => line.startsWith("#"))).toBe(false);
}

function errorOf(fn: () => void): UrError {
  try {
    fn();
  } catch (e) {
    if (e instanceof UrError) return e;
    throw e;
  }
  throw new Error("expected UrError");
}

function assertSessionPoison(decoder: Decoder, part: string, limit: string): void {
  const first = errorOf(() => decoder.receive(part));
  expect(first.code).toBe("ResourceLimit");
  expect(first.limit).toBe(limit);
  expect(decoder.isPoisoned).toBe(true);
  const later = errorOf(() => decoder.receive(part));
  expect(later.code).toBe("ResourceLimit");
  expect(later.limit).toBe(limit);
  const msg = errorOf(() => decoder.message());
  expect(msg.code).toBe("ResourceLimit");
  expect(msg.limit).toBe(limit);
}

interface BytewordsSpec {
  inputHex: string;
  standard: string;
  uri: string;
  minimal: string;
}

interface PartCborSpec {
  sequence: number;
  sequenceCount: number;
  messageLength: number;
  checksum: number;
  dataHex: string;
  cborHex: string;
  nonShortestSequenceCborHex: string;
}

interface K1Spec {
  payloadUtf8: string;
  type: string;
  outboundMustNotContain: string;
  outboundEqualsSinglePartEncode: boolean;
  inboundFountain11Accepted: boolean;
}

interface L4Spec {
  type: string;
  cborHex: string;
  uri: string;
  uriUpper: string;
}

interface LimitsSpec {
  maxMessageLength: number;
  maxFragmentCount: number;
  maxFragmentDataLength: number;
  maxBufferParts: number;
  maxReceivedParts: number;
  maxUriLen: number;
}

interface PoisonLimit {
  limit: string;
  rust: string;
  sessionPoison: boolean;
}

interface PoisonSpec {
  limits: PoisonLimit[];
  receiveAndMessageSameCode: string[];
  notPoison: string[];
}

test("readme is canonical paragraph", () => {
  const readme = readVector("README.md");
  expect(readme.includes("ur.js")).toBe(true);
  expect(readme.includes("bcur")).toBe(true);
  expect(readme.includes("implementation bug")).toBe(true);
  expect(readme.includes("THIRD_PARTY.md")).toBe(true);
  expect(readme.includes("data-only")).toBe(true);
});

test("bytewords contract", () => {
  const spec = jsonVector<BytewordsSpec>("bytewords.json");
  const input = fromHex(spec.inputHex);
  expect(bytewords.encode(input, "standard")).toBe(spec.standard);
  expect(bytewords.encode(input, "uri")).toBe(spec.uri);
  expect(bytewords.encode(input, "minimal")).toBe(spec.minimal);
  expect(bytewords.decode(spec.standard, "standard")).toEqual(input);
  expect(bytewords.decode(spec.uri, "uri")).toEqual(input);
  expect(bytewords.decode(spec.minimal, "minimal")).toEqual(input);
});

test("part cbor contract", () => {
  const spec = jsonVector<PartCborSpec>("part-cbor.json");
  const part = Part.fromCbor(fromHex(spec.cborHex));
  expect(part.sequence).toBe(spec.sequence);
  expect(part.sequenceCount).toBe(spec.sequenceCount);
  expect(part.messageLength).toBe(spec.messageLength);
  expect(part.checksum).toBe(spec.checksum);
  expect(toHex(part.data)).toBe(spec.dataHex);
  expect(toHex(part.toCbor())).toBe(spec.cborHex);
  expect(errorOf(() => Part.fromCbor(fromHex(spec.nonShortestSequenceCborHex))).code).toBe(
    "InvalidPartCbor",
  );
});

test("k1 contract", () => {
  const spec = jsonVector<K1Spec>("k1.json");
  const payload = new TextEncoder().encode(spec.payloadUtf8);
  const urType = UrType.parse(spec.type);
  const encoder = Encoder.create(payload, 64, urType);
  expect(encoder.isSinglePart).toBe(true);
  const outbound = encoder.nextPart();
  expect(outbound.includes(spec.outboundMustNotContain)).toBe(false);
  expect(spec.outboundEqualsSinglePartEncode).toBe(true);
  expect(outbound).toBe(encode(payload, urType));
  expect(spec.inboundFountain11Accepted).toBe(true);
  const fountain = FountainEncoder.create(payload, 64);
  const part = fountain.nextPart();
  const body = bytewords.encode(part.toCbor(), "minimal");
  const uri = `ur:${urType.value}/1-1/${body}`;
  const decoder = new Decoder();
  decoder.receive(uri);
  expect(decoder.complete).toBe(true);
  expect(decoder.message()).toEqual(payload);
});

test("l4 test array contract", () => {
  const spec = jsonVector<L4Spec>("l4-test-array.json");
  const cborBytes = fromHex(spec.cborHex);
  const urType = UrType.parse(spec.type);
  expect(encode(cborBytes, urType)).toBe(spec.uri);
  expect(Ur.create(spec.type, [1, 2, 3]).string()).toBe(spec.uri);
  const decoded = decode(spec.uriUpper);
  expect(decoded.kind).toBe("single");
  expect(decoded.payload).toEqual(cborBytes);
});

test("decoder limits contract", () => {
  const spec = jsonVector<LimitsSpec>("decoder-limits.json");
  expect(DEFAULT_LIMITS.maxMessageLength).toBe(spec.maxMessageLength);
  expect(DEFAULT_LIMITS.maxFragmentCount).toBe(spec.maxFragmentCount);
  expect(DEFAULT_LIMITS.maxFragmentDataLength).toBe(spec.maxFragmentDataLength);
  expect(DEFAULT_LIMITS.maxBufferParts).toBe(spec.maxBufferParts);
  expect(DEFAULT_LIMITS.maxReceivedParts).toBe(spec.maxReceivedParts);
  expect(DEFAULT_LIMITS.maxUriLen).toBe(spec.maxUriLen);
});

test("poison maps via limit string", () => {
  const raw = readVector("poison.json");
  expect(raw.includes("DecoderState")).toBe(false);
  const spec = jsonVector<PoisonSpec>("poison.json");
  expect(spec.limits).toEqual([
    { limit: "uri_len", rust: "UriLen", sessionPoison: true },
    { limit: "fragment_count", rust: "FragmentCount", sessionPoison: true },
    { limit: "fragment_data", rust: "FragmentData", sessionPoison: true },
    { limit: "message_length", rust: "MessageLength", sessionPoison: true },
    { limit: "received_parts", rust: "ReceivedParts", sessionPoison: true },
    { limit: "buffer_parts", rust: "BufferParts", sessionPoison: true },
    { limit: "sequence", rust: "Sequence", sessionPoison: false },
  ]);
  const seq = spec.limits.find((row) => row.limit === "sequence");
  expect(seq?.sessionPoison).toBe(false);
  const err = errorOf(() => nextSequence(0xffffffff));
  expect(err.code).toBe("ResourceLimit");
  expect(err.limit).toBe("sequence");
});

test("poison receive and message same code", () => {
  const spec = jsonVector<PoisonSpec>("poison.json");
  expect(spec.receiveAndMessageSameCode).toEqual(["uri_len", "fragment_count"]);

  for (const name of spec.receiveAndMessageSameCode) {
    if (name === "uri_len") {
      const encoder = Encoder.bytes(new TextEncoder().encode("Ten chars!".repeat(8)), 5);
      const decoder = new Decoder({ limits: { maxUriLen: 16 } });
      assertSessionPoison(decoder, encoder.nextPart(), name);
    } else if (name === "fragment_count") {
      const encoder = Encoder.bytes(new TextEncoder().encode("Ten chars!".repeat(16)), 4);
      expect(encoder.fragmentCount).toBeGreaterThan(1);
      const decoder = new Decoder({ limits: { maxFragmentCount: 1 } });
      assertSessionPoison(decoder, encoder.nextPart(), name);
    } else {
      throw new Error(`unhandled receiveAndMessageSameCode: ${name}`);
    }
  }
});

test("poison not-poison errors", () => {
  const spec = jsonVector<PoisonSpec>("poison.json");
  expect(spec.notPoison).toEqual(["UnexpectedType", "CborDecode"]);

  const data = new TextEncoder().encode("Ten chars!".repeat(6));
  const a = Encoder.create(data, 5, UrType.parse("alpha"));
  const b = Encoder.create(data, 5, UrType.parse("beta"));
  const decoder = new Decoder();
  decoder.receive(a.nextPart());
  const mismatch = errorOf(() => decoder.receive(b.nextPart()));
  expect(mismatch.code).toBe("UnexpectedType");
  expect(decoder.isPoisoned).toBe(false);
  decoder.receive(a.nextPart());

  const typed = new MultipartDecoder();
  typed.receive("ur:bytes/iehsjyhspmwfwfia");
  expect(typed.complete).toBe(true);
  expect(errorOf(() => typed.message()).code).toBe("CborDecode");
  expect(typed.isPoisoned).toBe(false);
});

test("fountain mixed contract", () => {
  const mixed = readVector("fountain-mixed.txt");
  assertLineFile(mixed);
  const uris = dataLines(mixed);
  expect(uris.length).toBe(20);
  const decoder = new Decoder();
  for (const uri of uris) decoder.receive(uri);
  expect(decoder.complete).toBe(true);
  const payload = decoder.message();
  expect(payload).toBeDefined();
  if (payload === undefined) throw new Error("expected payload");
  const encoder = Encoder.bytes(payload, 30);
  expect(encoder.fragmentCount).toBe(9);
  expect(encoder.nextPart()).toBe(uris[0]);
});

test("published singles contract", () => {
  const raw = readVector("published-singles.txt");
  assertLineFile(raw);
  const uris = dataLines(raw);
  expect(uris.length).toBe(3);
  for (const uri of uris) {
    expect(decode(uri).kind).toBe("single");
  }
});
