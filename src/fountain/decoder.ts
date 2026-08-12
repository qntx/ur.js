import { checksum } from "../crc32.ts";
import { UrError, fail } from "../error.ts";
import { type DecoderLimits, mergeLimits } from "./limits.ts";
import { Part } from "./part.ts";

function keyOf(indexes: number[]): string {
  return indexes.join(",");
}

function xorInto(target: Uint8Array, src: Uint8Array): void {
  if (target.length !== src.length) fail("DecoderState");
  for (let i = 0; i < target.length; i++) {
    target[i]! ^= src[i]!;
  }
}

/** Fountain decoder with resource limits and fail-closed poison. */
export class FountainDecoder {
  private readonly decoded = new Map<number, Part>();
  private readonly received = new Set<string>();
  private readonly buffer = new Map<string, { indexes: number[]; part: Part }>();
  private readonly queue: { index: number; part: Part }[] = [];
  private sequenceCount = 0;
  private messageLength = 0;
  private messageChecksum = 0;
  private fragmentLength = 0;
  private readonly limits: DecoderLimits;
  private poisoned: string | undefined;

  constructor(limits?: Partial<DecoderLimits>) {
    this.limits = mergeLimits(limits);
  }

  get maxFragmentDataLength(): number {
    return this.limits.maxFragmentDataLength;
  }

  get isPoisoned(): boolean {
    return this.poisoned !== undefined;
  }

  private poison(reason: string): never {
    this.poisoned = reason;
    fail("ResourceLimit", { limit: reason });
  }

  /**
   * Receive a fountain part.
   * @returns whether the part was newly ingested.
   */
  receive(part: Part): boolean {
    if (this.poisoned !== undefined) {
      fail("ResourceLimit", { limit: this.poisoned });
    }
    if (this.complete) return false;

    if (part.sequenceCount === 0 || part.data.length === 0 || part.messageLength === 0) {
      fail("EmptyPart");
    }
    if (part.sequence === 0) fail("InvalidSequence");
    if (part.data.length > this.limits.maxFragmentDataLength) {
      this.poison("fragment_data");
    }

    if (this.received.size === 0) {
      const sc = part.sequenceCount;
      const ml = part.messageLength;
      if (sc > this.limits.maxFragmentCount) this.poison("fragment_count");
      if (ml > this.limits.maxMessageLength) this.poison("message_length");
      const fragLen = part.data.length;
      if (fragLen * sc < ml) fail("InconsistentPart");
      this.sequenceCount = sc;
      this.messageLength = ml;
      this.messageChecksum = part.checksum;
      this.fragmentLength = fragLen;
    } else if (!this.validate(part)) {
      fail("InconsistentPart");
    }

    const indexes = part.indexes();
    const key = keyOf(indexes);
    if (this.received.has(key)) return false;
    if (this.received.size >= this.limits.maxReceivedParts) this.poison("received_parts");
    this.received.add(key);

    if (part.isSimple()) this.enqueueSimple(part);
    else this.processComplex(part);
    this.processQueue();
    return true;
  }

  private enqueueSimple(part: Part): void {
    const index = part.indexes()[0]!;
    if (this.decoded.has(index)) return;
    this.decoded.set(index, part);
    this.queue.push({ index, part });
  }

  private processQueue(): void {
    while (this.queue.length > 0) {
      const { index, part: simple } = this.queue.pop()!;
      const toProcess: string[] = [];
      for (const [k, entry] of this.buffer) {
        if (entry.indexes.includes(index)) toProcess.push(k);
      }
      for (const k of toProcess) {
        this.reduceBufferedPart(k, index, simple);
      }
    }
  }

  private reduceBufferedPart(key: string, knownIndex: number, simple: Part): void {
    const entry = this.buffer.get(key);
    if (!entry) fail("DecoderState");
    this.buffer.delete(key);
    const newIndexes = entry.indexes.filter((x) => x !== knownIndex);
    if (newIndexes.length === entry.indexes.length) fail("DecoderState");
    const data = entry.part.data.slice();
    xorInto(data, simple.data);
    const reduced = Part.fromFields(
      entry.part.sequence,
      entry.part.sequenceCount,
      entry.part.messageLength,
      entry.part.checksum,
      data,
    );
    this.insertReduced(newIndexes, reduced);
  }

  private processComplex(part: Part): void {
    let indexes = part.indexes().slice();
    const known = indexes.filter((idx) => this.decoded.has(idx));
    if (indexes.length === known.length) return;
    let data = part.data.slice();
    for (const remove of known) {
      indexes = indexes.filter((x) => x !== remove);
      xorInto(data, this.decoded.get(remove)!.data);
    }
    const reduced = Part.fromFields(
      part.sequence,
      part.sequenceCount,
      part.messageLength,
      part.checksum,
      data,
    );
    this.insertReduced(indexes, reduced);
  }

  private insertReduced(indexes: number[], part: Part): void {
    if (indexes.length === 1) {
      const idx = indexes[0]!;
      if (this.decoded.has(idx)) return;
      this.decoded.set(idx, part);
      this.queue.push({ index: idx, part });
      return;
    }
    const key = keyOf(indexes);
    if (!this.buffer.has(key) && this.buffer.size >= this.limits.maxBufferParts) {
      this.poison("buffer_parts");
    }
    this.buffer.set(key, { indexes, part });
  }

  get complete(): boolean {
    return this.messageLength !== 0 && this.decoded.size === this.sequenceCount;
  }

  resolvedFragmentCount(): number | undefined {
    return this.messageLength === 0 ? undefined : this.decoded.size;
  }

  get fragmentCount(): number {
    return this.sequenceCount;
  }

  validate(part: Part): boolean {
    if (this.received.size === 0) return false;
    return (
      part.sequenceCount === this.sequenceCount &&
      part.messageLength === this.messageLength &&
      part.checksum === this.messageChecksum &&
      part.data.length === this.fragmentLength
    );
  }

  /** Decoded message if complete; otherwise `undefined`. */
  message(): Uint8Array | undefined {
    if (this.poisoned !== undefined) {
      throw new UrError("ResourceLimit", { limit: this.poisoned });
    }
    if (!this.complete) return undefined;
    const combined = new Uint8Array(this.fragmentLength * this.sequenceCount);
    for (let idx = 0; idx < this.sequenceCount; idx++) {
      const part = this.decoded.get(idx);
      if (!part) fail("DecoderState");
      combined.set(part.data, idx * this.fragmentLength);
    }
    for (let i = this.messageLength; i < combined.length; i++) {
      if (combined[i] !== 0) fail("InvalidPadding");
    }
    const message = combined.subarray(0, this.messageLength);
    if (checksum(message) !== this.messageChecksum) fail("InvalidMessageChecksum");
    return message.slice();
  }
}
