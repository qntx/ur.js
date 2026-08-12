import { expect, test } from "vite-plus/test";
import { checksum } from "../src/crc32.ts";

test("known CRC-32 ISO-HDLC vectors", () => {
  expect(checksum(new TextEncoder().encode("Hello, world!"))).toBe(0xebe6c6e6);
  expect(checksum(new TextEncoder().encode("Wolf"))).toBe(0x598c84dc);
});
