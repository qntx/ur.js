import { CborError, CborMap, bytesToHex, encodeCbor } from "@blockchaincommons/dcbor";
import { expect, test } from "vite-plus/test";
import {
  Ur,
  UrError,
  fromUr,
  fromUrString,
  keypathCodec,
  toUr,
  toUrString,
  type Keypath,
  type PathComponent,
} from "../../src/registry/index.ts";

function errorOf(fn: () => void): UrError {
  try {
    fn();
  } catch (e) {
    if (e instanceof UrError) return e;
    throw e;
  }
  throw new Error("expected UrError");
}

function cborHex(keypath: Keypath): string {
  return bytesToHex(encodeCbor(keypathCodec.untaggedCbor(keypath)));
}

test("keypath codec tag", () => {
  expect(keypathCodec.tags[0]?.name).toBe("keypath");
  expect(keypathCodec.tags[0]?.value).toBe(40_304);
});

test("index component encode hex", () => {
  const keypath: Keypath = {
    components: [{ kind: "index", index: 44, hardened: true }],
  };
  expect(cborHex(keypath)).toBe("a10182182cf5");
  const decoded = fromUrString(toUrString(keypath, keypathCodec), keypathCodec);
  expect(decoded.components).toEqual(keypath.components);
});

test("wildcard component encode hex", () => {
  const hardened: Keypath = { components: [{ kind: "wildcard", hardened: true }] };
  const unhardened: Keypath = { components: [{ kind: "wildcard", hardened: false }] };
  expect(cborHex(hardened)).toBe("a1018280f5");
  expect(cborHex(unhardened)).toBe("a1018280f4");
  expect(fromUrString(toUrString(hardened, keypathCodec), keypathCodec).components).toEqual(
    hardened.components,
  );
});

test("range component encode hex", () => {
  const keypath: Keypath = {
    components: [{ kind: "range", low: 0, high: 1, hardened: false }],
  };
  expect(cborHex(keypath)).toBe("a10182820001f4");
  expect(fromUrString(toUrString(keypath, keypathCodec), keypathCodec).components).toEqual(
    keypath.components,
  );
});

test("pair component encode hex", () => {
  const keypath: Keypath = {
    components: [
      {
        kind: "pair",
        external: { index: 0, hardened: false },
        internal: { index: 1, hardened: true },
      },
    ],
  };
  expect(cborHex(keypath)).toBe("a101818400f401f5");
  expect(fromUrString(toUrString(keypath, keypathCodec), keypathCodec).components).toEqual(
    keypath.components,
  );
});

test("mixed index wildcard range pair walker", () => {
  const components: readonly PathComponent[] = [
    { kind: "index", index: 44, hardened: true },
    { kind: "wildcard", hardened: false },
    { kind: "range", low: 0, high: 1, hardened: true },
    {
      kind: "pair",
      external: { index: 0, hardened: false },
      internal: { index: 1, hardened: false },
    },
  ];
  const keypath: Keypath = { components };
  expect(cborHex(keypath)).toBe("a10187182cf580f4820001f58400f401f4");
  expect(fromUrString(toUrString(keypath, keypathCodec), keypathCodec).components).toEqual(
    components,
  );
});

test("empty components with source fingerprint", () => {
  const keypath: Keypath = { components: [], sourceFingerprint: 0xe9181cf3, depth: 0 };
  expect(cborHex(keypath)).toBe("a30180021ae9181cf30300");
  const decoded = fromUrString(toUrString(keypath, keypathCodec), keypathCodec);
  expect(decoded.components).toEqual([]);
  expect(decoded.sourceFingerprint).toBe(0xe9181cf3);
  expect(decoded.depth).toBe(0);
});

test("empty components without fingerprint is CborType", () => {
  const encodeErr = errorOf(() => toUrString({ components: [] }, keypathCodec));
  expect(encodeErr.code).toBe("CborType");
  expect(CborError.isCborError(encodeErr.cause)).toBe(true);
  if (CborError.isCborError(encodeErr.cause)) expect(encodeErr.cause.code).toBe("WrongType");

  const map = new CborMap();
  map.set(1, []);
  const decodeErr = errorOf(() => fromUr(Ur.create("keypath", map), keypathCodec));
  expect(decodeErr.code).toBe("CborType");
});

test("missing components is CborType MissingMapKey", () => {
  const err = errorOf(() => fromUr(Ur.create("keypath", new CborMap()), keypathCodec));
  expect(err.code).toBe("CborType");
  expect(CborError.isCborError(err.cause)).toBe(true);
  if (CborError.isCborError(err.cause)) expect(err.cause.code).toBe("MissingMapKey");
});

test("extra map key is CborType", () => {
  const map = new CborMap();
  map.set(1, [0, false]);
  map.set(4, 0);
  const err = errorOf(() => fromUr(Ur.create("keypath", map), keypathCodec));
  expect(err.code).toBe("CborType");
  expect(CborError.isCborError(err.cause)).toBe(true);
  if (CborError.isCborError(err.cause)) expect(err.cause.code).toBe("WrongType");
});

test("range low >= high is CborType OutOfRange", () => {
  const err = errorOf(() =>
    toUrString({ components: [{ kind: "range", low: 1, high: 1, hardened: false }] }, keypathCodec),
  );
  expect(err.code).toBe("CborType");
  expect(CborError.isCborError(err.cause)).toBe(true);
  if (CborError.isCborError(err.cause)) expect(err.cause.code).toBe("OutOfRange");
});

test("index 0x80000000 is CborType OutOfRange", () => {
  const err = errorOf(() =>
    toUrString(
      { components: [{ kind: "index", index: 0x8000_0000, hardened: false }] },
      keypathCodec,
    ),
  );
  expect(err.code).toBe("CborType");
  expect(CborError.isCborError(err.cause)).toBe(true);
  if (CborError.isCborError(err.cause)) expect(err.cause.code).toBe("OutOfRange");
});

test("source fingerprint 0 is CborType OutOfRange", () => {
  const err = errorOf(() => toUrString({ components: [], sourceFingerprint: 0 }, keypathCodec));
  expect(err.code).toBe("CborType");
  expect(CborError.isCborError(err.cause)).toBe(true);
  if (CborError.isCborError(err.cause)) expect(err.cause.code).toBe("OutOfRange");
});

test("index missing trailing bool is CborType", () => {
  const map = new CborMap();
  map.set(1, [44]);
  const err = errorOf(() => fromUr(Ur.create("keypath", map), keypathCodec));
  expect(err.code).toBe("CborType");
});

test("pair does not consume a trailing bool", () => {
  const map = new CborMap();
  map.set(1, [[0, false, 1, false], true]);
  const err = errorOf(() => fromUr(Ur.create("keypath", map), keypathCodec));
  expect(err.code).toBe("CborType");
});

test("toUr copies caller path object by encoding immediately", () => {
  const components: PathComponent[] = [{ kind: "index", index: 44, hardened: true }];
  const ur = toUr({ components }, keypathCodec);
  components[0] = { kind: "index", index: 0, hardened: false };
  expect(ur.string()).toBe(
    toUrString({ components: [{ kind: "index", index: 44, hardened: true }] }, keypathCodec),
  );
});
