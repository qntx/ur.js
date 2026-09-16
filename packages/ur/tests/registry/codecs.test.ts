import { bytesToHex, decodeCbor, expectBytes, hexToBytes } from "@blockchaincommons/dcbor";
import { expect, test } from "vite-plus/test";
import {
  Ur,
  UrError,
  codecMap,
  fromUrStringWith,
  psbtCodec,
  seedCodec,
  type Psbt,
  type Seed,
} from "../../src/registry/index.ts";
import { psbt167, seedC709 } from "./goldens.ts";

function errorOf(fn: () => void): UrError {
  try {
    fn();
  } catch (e) {
    if (e instanceof UrError) return e;
    throw e;
  }
  throw new Error("expected UrError");
}

test("duplicate tags[0].name is TypeError not InvalidType", () => {
  try {
    codecMap([seedCodec, seedCodec]);
  } catch (e) {
    expect(e instanceof TypeError).toBe(true);
    expect(e instanceof UrError).toBe(false);
    if (e instanceof TypeError) expect(e.message).toBe("duplicate codec for UR type seed");
    return;
  }
  throw new Error("expected TypeError");
});

test("fromUrStringWith unknown type is UnexpectedType", () => {
  const uri = Ur.create("bytes", new Uint8Array([1, 2, 3])).string();
  const err = errorOf(() => fromUrStringWith(uri, codecMap([seedCodec])));
  expect(err.code).toBe("UnexpectedType");
  expect(err.expected).toBe("seed");
  expect(err.found).toBe("bytes");
});

test("codecMap seed+psbt dispatch", () => {
  const map = codecMap([seedCodec, psbtCodec]);
  expect([...map.keys()]).toEqual(["seed", "psbt"]);

  const seed = fromUrStringWith(seedC709.ur, map);
  expect(seed.type).toBe("seed");
  expect(bytesToHex((seed.value as Seed).payload)).toBe(seedC709.payloadHex);

  const psbt = fromUrStringWith(psbt167.ur, map);
  expect(psbt.type).toBe("psbt");
  expect(bytesToHex((psbt.value as Psbt).bytes)).toBe(
    bytesToHex(new Uint8Array(expectBytes(decodeCbor(hexToBytes(psbt167.cborHex))))),
  );
});
