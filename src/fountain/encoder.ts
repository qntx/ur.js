import { checksum } from "../crc32.ts";
import { fail } from "../error.ts";
import { chooseFragments, fragmentLength, partition } from "./choose.ts";
import { Part } from "./part.ts";

function xorInto(target: Uint8Array, src: Uint8Array): void {
  if (target.length !== src.length) fail("DecoderState");
  for (let i = 0; i < target.length; i++) {
    target[i]! ^= src[i]!;
  }
}

/** Fountain encoder. */
export class FountainEncoder {
  private readonly parts: Uint8Array[];
  private readonly sequenceCount: number;
  private readonly messageLength: number;
  private readonly messageChecksum: number;
  private currentSequence = 0;

  private constructor(
    parts: Uint8Array[],
    sequenceCount: number,
    messageLength: number,
    messageChecksum: number,
  ) {
    this.parts = parts;
    this.sequenceCount = sequenceCount;
    this.messageLength = messageLength;
    this.messageChecksum = messageChecksum;
  }

  static create(message: Uint8Array, maxFragmentLength: number): FountainEncoder {
    if (message.length === 0) fail("EmptyMessage");
    if (maxFragmentLength === 0) fail("InvalidFragmentLen");
    if (message.length > 0xffff_ffff) fail("ResourceLimit", { limit: "message_length" });
    const fragLen = fragmentLength(message.length, maxFragmentLength);
    const fragments = partition(message, fragLen);
    if (fragments.length > 0xffff_ffff) fail("ResourceLimit", { limit: "fragment_count" });
    return new FountainEncoder(fragments, fragments.length, message.length, checksum(message));
  }

  get currentSequenceNum(): number {
    return this.currentSequence;
  }

  get fragmentCount(): number {
    return this.sequenceCount;
  }

  get complete(): boolean {
    return this.currentSequence >= this.sequenceCount;
  }

  nextPart(): Part {
    if (this.currentSequence === 0xffff_ffff) fail("ResourceLimit", { limit: "sequence" });
    this.currentSequence += 1;
    const indexes = chooseFragments(this.currentSequence, this.parts.length, this.messageChecksum);
    const first = this.parts[0]!;
    const mixed = new Uint8Array(first.length);
    for (const idx of indexes) {
      xorInto(mixed, this.parts[idx]!);
    }
    return Part.fromFields(
      this.currentSequence,
      this.sequenceCount,
      this.messageLength,
      this.messageChecksum,
      mixed,
    );
  }
}
