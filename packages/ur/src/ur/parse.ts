import { fail } from "../error.ts";
import { UrType } from "./type.ts";

export type Kind = "single" | "multi";

export interface ParsedUr {
  type: UrType;
  kind: Kind;
  indices?: { seq: number; count: number };
  body: string;
}

/** Lowercase a UR string for case-insensitive QR transport. */
export function normalizeUr(uri: string): string {
  return uri.toLowerCase();
}

/** Parse a UR (full-URI case fold). Does not decode bytewords. */
export function parse(uri: string): ParsedUr {
  return parseNormalized(normalizeUr(uri));
}

/** Parse an already-lowercased (or body-normalized) UR. */
export function parseNormalized(uri: string): ParsedUr {
  if (!uri.startsWith("ur:")) fail("InvalidScheme");
  const rest0 = uri.slice(3);
  const slash = rest0.indexOf("/");
  if (slash < 0) fail("TypeUnspecified");
  const typeStr = rest0.slice(0, slash);
  const rest = rest0.slice(slash + 1);
  const urType = UrType.parse(typeStr);

  const lastSlash = rest.lastIndexOf("/");
  if (lastSlash < 0) {
    return {
      type: urType,
      kind: "single",
      body: rest.toLowerCase(),
    };
  }
  const indicesStr = rest.slice(0, lastSlash);
  const body = rest.slice(lastSlash + 1).toLowerCase();
  const indices = decodeIndices(indicesStr);
  return {
    type: urType,
    kind: "multi",
    indices,
    body,
  };
}

function decodeIndices(indices: string): { seq: number; count: number } {
  const dash = indices.indexOf("-");
  if (dash < 0) fail("InvalidIndices");
  const a = indices.slice(0, dash);
  const b = indices.slice(dash + 1);
  if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) fail("InvalidIndices");
  const seq = Number(a);
  const count = Number(b);
  if (!Number.isSafeInteger(seq) || !Number.isSafeInteger(count)) fail("InvalidIndices");
  if (seq === 0 || count === 0) fail("InvalidIndices");
  if (seq > 0xffff_ffff || count > 0xffff_ffff) fail("InvalidIndices");
  return { seq, count };
}
