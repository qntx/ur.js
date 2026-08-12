import type { Xoshiro256 } from "./xoshiro.ts";

/**
 * Walker's alias method with reverse-index ordered partition (ur-rs / bcur).
 */
export class Weighted {
  private readonly aliases: number[];
  private readonly probs: number[];

  private constructor(aliases: number[], probs: number[]) {
    this.aliases = aliases;
    this.probs = probs;
  }

  static new(weightsIn: number[]): Weighted {
    const weights = weightsIn.slice();
    for (const w of weights) {
      if (w < 0) throw new Error("negative probability encountered");
    }
    const summed = weights.reduce((a, b) => a + b, 0);
    if (!(summed > 0)) throw new Error("probabilities don't sum to a positive value");
    const count = weights.length;
    for (let i = 0; i < count; i++) {
      weights[i]! *= count / summed;
    }

    // Ordered partition: indices count-1 .. 0, small then large.
    const s: number[] = [];
    const l: number[] = [];
    for (let j = count - 1; j >= 0; j--) {
      if (weights[j]! < 1) s.push(j);
      else l.push(j);
    }

    const probs = Array.from({ length: count }, () => 0);
    const aliases = Array.from({ length: count }, () => 0);

    while (s.length > 0 && l.length > 0) {
      const a = s.pop()!;
      const g = l.pop()!;
      probs[a] = weights[a]!;
      aliases[a] = g;
      weights[g]! += weights[a]! - 1;
      if (weights[g]! < 1) s.push(g);
      else l.push(g);
    }
    while (l.length > 0) {
      probs[l.pop()!] = 1;
    }
    while (s.length > 0) {
      probs[s.pop()!] = 1;
    }

    return new Weighted(aliases, probs);
  }

  next(xoshiro: Xoshiro256): number {
    const r1 = xoshiro.nextDouble();
    const r2 = xoshiro.nextDouble();
    const n = this.probs.length;
    const i = Math.trunc(n * r1);
    if (r2 < this.probs[i]!) return i;
    return this.aliases[i]!;
  }
}
