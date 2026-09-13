import { encode, UrType } from "../dist/index.mjs";

const s = encode(new Uint8Array([1, 2, 3]), UrType.parse("test"));
if (!s.startsWith("ur:test/")) throw new Error(s);
