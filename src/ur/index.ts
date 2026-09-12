import * as bytewords from "../bytewords/index.ts";
import {
  type DecoderLimits,
  FountainDecoder,
  FountainEncoder,
  Part,
  mergeLimits,
} from "../fountain/index.ts";
import { UrError, fail, failPoison, type DecoderPoison } from "../error.ts";
import { type Kind, type ParsedUr, normalizeUr, parse, parseNormalized } from "./parse.ts";
import { UrType } from "./type.ts";

export type { DecoderLimits, Kind, ParsedUr };
export { UrType, normalizeUr, parse, parseNormalized };

/** Encode a single-part UR. Empty data is allowed. */
export function encode(data: Uint8Array, type: UrType): string {
  const body = bytewords.encode(data, "minimal");
  return `ur:${type.value}/${body}`;
}

/**
 * Decode payload from a single- or multi-part UR.
 * Multi-part returns the CBOR-encoded fountain part bytes, not the message.
 */
export function decode(uri: string): { kind: Kind; payload: Uint8Array } {
  const parsed = parse(uri);
  const payload = bytewords.decode(parsed.body, "minimal");
  return { kind: parsed.kind, payload };
}

/** Like {@link decode} but retains the normalized type. */
export function decodeWithType(uri: string): {
  type: UrType;
  kind: Kind;
  payload: Uint8Array;
} {
  const parsed = parse(uri);
  const payload = bytewords.decode(parsed.body, "minimal");
  return { type: parsed.type, kind: parsed.kind, payload };
}

/** Decode a single-part UR payload. Multi-part URIs throw `NotSinglePart`. */
export function decodeMessage(uri: string): Uint8Array {
  const { kind, payload } = decode(uri);
  if (kind !== "single") fail("NotSinglePart");
  return payload;
}

/** Uppercase UR string for denser QR alphanumeric mode. */
export function toQrString(uri: string): string {
  return uri.toUpperCase();
}

/** UR encoder. `K == 1` emits single-part; otherwise fountain. */
export class Encoder {
  private readonly fountain: FountainEncoder;
  private readonly urType: UrType;
  private readonly message: Uint8Array;
  private singleEmitted = false;

  private constructor(fountain: FountainEncoder, urType: UrType, message: Uint8Array) {
    this.fountain = fountain;
    this.urType = urType;
    this.message = message;
  }

  static create(message: Uint8Array, maxFragmentLength: number, type: UrType): Encoder {
    return new Encoder(
      FountainEncoder.create(message, maxFragmentLength),
      type,
      // copy: later mutation of the caller buffer must not change K==1 output
      message.slice(),
    );
  }

  static bytes(message: Uint8Array, maxFragmentLength: number): Encoder {
    return Encoder.create(message, maxFragmentLength, UrType.bytes());
  }

  get isSinglePart(): boolean {
    return this.fountain.fragmentCount === 1;
  }

  get fragmentCount(): number {
    return this.fountain.fragmentCount;
  }

  get currentIndex(): number {
    return this.isSinglePart ? (this.singleEmitted ? 1 : 0) : this.fountain.currentSequenceNum;
  }

  get complete(): boolean {
    return this.isSinglePart ? this.singleEmitted : this.fountain.complete;
  }

  nextPart(): string {
    if (this.isSinglePart) {
      this.singleEmitted = true;
      return encode(this.message, this.urType);
    }
    const part = this.fountain.nextPart();
    const body = bytewords.encode(part.toCbor(), "minimal");
    return `ur:${this.urType.value}/${part.sequenceId()}/${body}`;
  }
}

/** UR decoder with type stickiness and URI limits. */
export class Decoder {
  private readonly fountain: FountainDecoder;
  private readonly maxUriLen: number;
  private readonly maxMessageLength: number;
  private readonly expectedType: UrType | undefined;
  private seenType: UrType | undefined;
  private single: Uint8Array | undefined;
  private poisoned: DecoderPoison | undefined;

  constructor(options?: { limits?: Partial<DecoderLimits>; expectedType?: UrType }) {
    const limits = mergeLimits(options?.limits);
    this.fountain = new FountainDecoder(limits);
    this.maxUriLen = limits.maxUriLen;
    this.maxMessageLength = limits.maxMessageLength;
    this.expectedType = options?.expectedType;
  }

  private poison(limit: string): never {
    this.poisoned = { code: "ResourceLimit", limit };
    fail("ResourceLimit", { limit });
  }

  private escalate(e: unknown): never {
    if (e instanceof UrError) {
      if (e.code === "ResourceLimit") {
        this.poisoned ??= { code: "ResourceLimit", limit: e.limit ?? "unknown" };
      } else if (e.code === "DecoderState") {
        this.poisoned ??= { code: "DecoderState" };
      }
    }
    throw e;
  }

  get poisonState(): DecoderPoison | undefined {
    return this.poisoned ?? this.fountain.poisonState;
  }

  receive(uri: string): void {
    if (this.poisoned) failPoison(this.poisoned);
    if (this.fountain.isPoisoned) {
      this.poisoned ??= this.fountain.poisonState!;
      failPoison(this.poisoned);
    }
    if (uri.length > this.maxUriLen) this.poison("uri_len");

    const parsed = parse(uri);
    if (this.expectedType && !parsed.type.equals(this.expectedType)) {
      fail("UnexpectedType", {
        expected: this.expectedType.value,
        found: parsed.type.value,
      });
    }
    if (this.seenType && !this.seenType.equals(parsed.type)) {
      fail("UnexpectedType", {
        expected: this.seenType.value,
        found: parsed.type.value,
      });
    }

    try {
      if (parsed.kind === "single") this.receiveSingle(parsed);
      else this.receiveFountain(parsed);
    } catch (e) {
      this.escalate(e);
    }
  }

  private receiveSingle(parsed: ParsedUr): void {
    if (this.fountain.resolvedFragmentCount() !== undefined) fail("InconsistentPart");
    if (this.single !== undefined) return;
    const data = bytewords.decode(parsed.body, "minimal");
    if (data.length > this.maxMessageLength) this.poison("message_length");
    this.seenType = parsed.type;
    this.single = data;
  }

  private receiveFountain(parsed: ParsedUr): void {
    if (this.single !== undefined) fail("InconsistentPart");
    const decoded = bytewords.decode(parsed.body, "minimal");
    const part = Part.fromCbor(
      decoded,
      this.fountain.maxFragmentDataLength,
      this.fountain.maxFragmentCount,
    );
    const indices = parsed.indices;
    if (!indices) fail("InvalidIndices");
    if (part.sequence !== indices.seq || part.sequenceCount !== indices.count) {
      fail("InvalidIndices");
    }
    this.fountain.receive(part);
    this.seenType ??= parsed.type;
  }

  get complete(): boolean {
    return this.single !== undefined || this.fountain.complete;
  }

  message(): Uint8Array | undefined {
    if (this.poisoned) failPoison(this.poisoned);
    if (this.fountain.isPoisoned) failPoison(this.fountain.poisonState!);
    if (this.single) return this.single.slice();
    return this.fountain.message();
  }

  resolvedFragmentCount(): number | undefined {
    if (this.single) return 1;
    return this.fountain.resolvedFragmentCount();
  }

  get fragmentCount(): number {
    return this.single ? 1 : this.fountain.fragmentCount;
  }

  get type(): UrType | undefined {
    return this.seenType;
  }

  get isPoisoned(): boolean {
    return this.poisoned !== undefined || this.fountain.isPoisoned;
  }
}
