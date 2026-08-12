/** Discriminated error codes for the UR transport stack. */
export type UrErrorCode =
  | "InvalidWord"
  | "InvalidBytewordsChecksum"
  | "InvalidBytewordsLength"
  | "NonAscii"
  | "EmptyMessage"
  | "EmptyPart"
  | "InvalidFragmentLen"
  | "InvalidSequence"
  | "InconsistentPart"
  | "InvalidPadding"
  | "InvalidMessageChecksum"
  | "InvalidPartCbor"
  | "DecoderState"
  | "ResourceLimit"
  | "InvalidScheme"
  | "TypeUnspecified"
  | "InvalidType"
  | "InvalidIndices"
  | "NotMultiPart"
  | "NotSinglePart"
  | "UnexpectedType";

const MESSAGES: Record<UrErrorCode, string> = {
  InvalidWord: "invalid bytewords word",
  InvalidBytewordsChecksum: "invalid bytewords checksum",
  InvalidBytewordsLength: "invalid bytewords length",
  NonAscii: "bytewords string is not ASCII",
  EmptyMessage: "empty message",
  EmptyPart: "empty fountain part",
  InvalidFragmentLen: "invalid maximum fragment length",
  InvalidSequence: "invalid sequence number",
  InconsistentPart: "fountain part inconsistent with previous parts",
  InvalidPadding: "invalid fountain part padding",
  InvalidMessageChecksum: "invalid fountain message checksum",
  InvalidPartCbor: "invalid fountain part CBOR",
  DecoderState: "fountain decoder internal state error",
  ResourceLimit: "decoder resource limit exceeded",
  InvalidScheme: "invalid UR scheme",
  TypeUnspecified: "UR type unspecified",
  InvalidType: "invalid UR type",
  InvalidIndices: "invalid multi-part indices",
  NotMultiPart: "expected multi-part UR",
  NotSinglePart: "expected single-part UR",
  UnexpectedType: "unexpected UR type",
};

/** Structured error thrown by the UR stack. */
export class UrError extends Error {
  readonly code: UrErrorCode;
  readonly expected?: string;
  readonly found?: string;
  readonly limit?: string;

  constructor(
    code: UrErrorCode,
    options?: { expected?: string; found?: string; limit?: string; cause?: unknown },
  ) {
    let message = MESSAGES[code];
    if (code === "ResourceLimit" && options?.limit) {
      message = `${message}: ${options.limit}`;
    } else if (code === "UnexpectedType" && options?.expected && options.found) {
      message = `${message}: expected ${options.expected}, found ${options.found}`;
    }
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "UrError";
    this.code = code;
    this.expected = options?.expected;
    this.found = options?.found;
    this.limit = options?.limit;
  }
}

/** Throws a {@link UrError} with the given code. */
export function fail(
  code: UrErrorCode,
  options?: { expected?: string; found?: string; limit?: string },
): never {
  throw new UrError(code, options);
}
