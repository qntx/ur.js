import { expect, test } from "vite-plus/test";
import { checksum } from "../src/crc32.ts";
import { UrError } from "../src/error.ts";
import {
  FountainDecoder,
  FountainEncoder,
  Part,
  chooseFragments,
  fragmentLength,
  partition,
} from "../src/fountain/index.ts";
import { makeMessage } from "../src/rng/index.ts";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

test("fragment_length", () => {
  expect(fragmentLength(12345, 1955)).toBe(1764);
  expect(fragmentLength(10, 4)).toBe(4);
  expect(fragmentLength(10, 6)).toBe(5);
});

test("fountain roundtrip", () => {
  const message = makeMessage("Wolf", 256);
  const encoder = FountainEncoder.create(message, 30);
  const decoder = new FountainDecoder();
  while (!decoder.complete) {
    decoder.receive(encoder.nextPart());
  }
  expect(decoder.message()).toEqual(message);
});

test("fountain encoder first part", () => {
  const message = makeMessage("Wolf", 256);
  const encoder = FountainEncoder.create(message, 30);
  const part = encoder.nextPart();
  expect(hex(part.data)).toBe("916ec65cf77cadf55cd7f9cda1a1030026ddd42e905b77adc36e4f2d3c");
  expect(part.sequence).toBe(1);
  expect(part.sequenceCount).toBe(9);
  expect(part.messageLength).toBe(256);
});

test("cbor golden", () => {
  const message = makeMessage("Wolf", 256);
  const encoder = FountainEncoder.create(message, 30);
  const part = encoder.nextPart();
  expect(hex(part.toCbor())).toBe(
    "8501091901001a0167aa07581d916ec65cf77cadf55cd7f9cda1a1030026ddd42e905b77adc36e4f2d3c",
  );
  const decoded = Part.fromCbor(part.toCbor());
  expect(decoded.sequence).toBe(part.sequence);
  expect(decoded.sequenceCount).toBe(part.sequenceCount);
  expect(decoded.messageLength).toBe(part.messageLength);
  expect(decoded.checksum).toBe(part.checksum);
  expect(hex(decoded.data)).toBe(hex(part.data));
});

test("empty encoder", () => {
  expect(() => FountainEncoder.create(new Uint8Array(), 1)).toThrowError(UrError);
});

test("skip fragments", () => {
  const message = makeMessage("Wolf", 32767);
  const encoder = FountainEncoder.create(message, 1000);
  const decoder = new FountainDecoder();
  let skip = false;
  while (!decoder.complete) {
    const part = encoder.nextPart();
    if (!skip) decoder.receive(part);
    skip = !skip;
  }
  expect(decoder.message()).toEqual(message);
});

test("choose_fragments", () => {
  const message = makeMessage("Wolf", 1024);
  const cs = checksum(message);
  const fl = fragmentLength(message.length, 100);
  const fragments = partition(message, fl);
  const expected = [
    [0],
    [1],
    [2],
    [3],
    [4],
    [5],
    [6],
    [7],
    [8],
    [9],
    [10],
    [9],
    [2, 5, 6, 8, 9, 10],
    [8],
    [1, 5],
  ];
  for (let i = 0; i < expected.length; i++) {
    const indexes = chooseFragments(i + 1, fragments.length, cs)
      .slice()
      .sort((a, b) => a - b);
    expect(indexes).toEqual(expected[i]);
  }
});

test("inconsistent part rejected", () => {
  const message = makeMessage("Wolf", 64);
  const encoderA = FountainEncoder.create(message, 16);
  const encoderB = FountainEncoder.create(makeMessage("Other", 64), 16);
  const decoder = new FountainDecoder();
  decoder.receive(encoderA.nextPart());
  expect(() => decoder.receive(encoderB.nextPart())).toThrowError(UrError);
});

test("duplicate part ignored", () => {
  const message = makeMessage("Wolf", 64);
  const encoder = FountainEncoder.create(message, 16);
  const part = encoder.nextPart();
  const decoder = new FountainDecoder();
  expect(decoder.receive(part)).toBe(true);
  expect(decoder.receive(part)).toBe(false);
});

test("resource limit fragment_count poisons", () => {
  const decoder = new FountainDecoder({ maxFragmentCount: 1 });
  const message = makeMessage("Wolf", 64);
  const encoder = FountainEncoder.create(message, 8);
  expect(encoder.fragmentCount).toBeGreaterThan(1);
  expect(() => decoder.receive(encoder.nextPart())).toThrowError(UrError);
  expect(decoder.isPoisoned).toBe(true);
  expect(() => decoder.receive(encoder.nextPart())).toThrowError(UrError);
});
