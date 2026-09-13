import {
  cbor,
  decodeCbor,
  encodeCbor,
  CborError,
  type Cbor,
  type CborInput,
} from "@blockchaincommons/dcbor";
import { fail } from "../error.ts";
import { UrType, decodeWithType, encode, toQrString } from "../ur/index.ts";

export function mapCborDecode<T>(run: () => T): T {
  try {
    return run();
  } catch (e) {
    if (CborError.isCborError(e)) fail("CborDecode", { cause: e });
    throw e;
  }
}

export function mapCborType<T>(run: () => T): T {
  try {
    return run();
  } catch (e) {
    if (CborError.isCborError(e)) fail("CborType", { cause: e });
    throw e;
  }
}

function parseType(type: UrType | string): UrType {
  return typeof type === "string" ? UrType.parse(type) : type;
}

/** Uniform Resource whose payload is deterministic CBOR. */
export class Ur {
  readonly type: UrType;
  readonly cbor: Cbor;

  private constructor(type: UrType, cborValue: Cbor) {
    this.type = type;
    this.cbor = cborValue;
  }

  static create(type: UrType | string, input: CborInput): Ur {
    // top-level bstr: cbor(Uint8Array) aliases the buffer (dcbor src/cbor.ts)
    const prepared = input instanceof Uint8Array ? input.slice() : input;
    return new Ur(
      parseType(type),
      mapCborType(() => cbor(prepared)),
    );
  }

  /** Wrap already-encoded dCBOR bytes. Used by fromUrString and MultipartDecoder. */
  static fromCborData(type: UrType | string, data: Uint8Array): Ur {
    // slice: decodeCbor bstrs alias the input buffer
    const bytes = data.slice();
    const value = mapCborDecode(() => decodeCbor(bytes));
    return new Ur(parseType(type), value);
  }

  static fromUrString(uri: string): Ur {
    const { type, kind, payload } = decodeWithType(uri);
    if (kind !== "single") fail("NotSinglePart");
    return Ur.fromCborData(type, payload);
  }

  string(): string {
    const bytes = mapCborType(() => encodeCbor(this.cbor));
    return encode(bytes, this.type);
  }

  qrString(): string {
    return toQrString(this.string());
  }

  checkType(expected: UrType | string): void {
    const want = parseType(expected);
    if (!this.type.equals(want)) {
      fail("UnexpectedType", { expected: want.value, found: this.type.value });
    }
  }
}
