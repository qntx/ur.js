import {
  CborError,
  expectBoolean,
  expectInteger,
  expectMap,
  expectUnsigned,
  type Cbor,
  type CborMap,
} from "@blockchaincommons/dcbor";

export function expectClosedIntMap(cbor: Cbor, allowed: ReadonlySet<number>): CborMap {
  const map = expectMap(cbor);
  for (const [key] of map) {
    const n = expectUnsigned(key);
    if (typeof n !== "number" || !Number.isInteger(n) || !allowed.has(n)) {
      throw CborError.wrongType();
    }
  }
  return map;
}

export function expectUint(cbor: Cbor, max: number): number {
  const n = expectUnsigned(cbor);
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > max) {
    throw CborError.outOfRange();
  }
  return n;
}

export const expectUint8 = (c: Cbor): number => expectUint(c, 0xff);
export const expectUint31 = (c: Cbor): number => expectUint(c, 0x7fff_ffff);
export const expectUint32Ne0 = (c: Cbor): number => {
  const n = expectUint(c, 0xffff_ffff);
  if (n === 0) throw CborError.outOfRange();
  return n;
};

/** CDDL `int` that must fit in JS number as int32. Used only for coin-info `network`. */
export function expectInt32(cbor: Cbor): number {
  const n = expectInteger(cbor);
  if (typeof n !== "number" || !Number.isInteger(n) || n < -0x8000_0000 || n > 0x7fff_ffff) {
    throw CborError.outOfRange();
  }
  return n;
}

export function expectBool(cbor: Cbor): boolean {
  return expectBoolean(cbor);
}
