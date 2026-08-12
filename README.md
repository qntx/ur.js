# ur.js

Uniform Resources (UR) transport for JavaScript/TypeScript.

Bytes-first library for [BCR-2020-005](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md) UR strings: **Bytewords**, **fountain codes**, and **single-/multi-part UR** encode/decode. Wire-compatible with [bcur](https://github.com/qntx/bcur), ur-rs, and Blockchain Commons references.

## Install

```bash
bun add ur
# or: npm i ur
```

## Usage

```ts
import { encode, decode, Encoder, Decoder, UrType } from "ur";

// Single-part
const data = new TextEncoder().encode("hello");
const ur = encode(data, UrType.bytes());
const { payload } = decode(ur);

// Multi-part (QR animation)
const message = new Uint8Array(200).fill(7);
const encoder = Encoder.bytes(message, 30);
const decoder = new Decoder();
while (!decoder.complete) {
  decoder.receive(encoder.nextPart());
}
const recovered = decoder.message();
```

## Layers

| Layer | Module      | Spec             |
| ----- | ----------- | ---------------- |
| L1    | `bytewords` | BCR-2020-012     |
| L2    | `fountain`  | BCR-2024-001 MUR |
| L3    | `ur`        | BCR-2020-005     |

No application type registry in core. Typed/dCBOR helpers may arrive later as optional surface.

## Status

**0.1 candidate (transport).** Wire interop goldens vs bcur/ur-rs pass; `DecoderLimits` + poison are on by default. This is **not** a 1.0 enterprise freeze: public API is stabilizing, default limit numbers may change before 1.0, and fuzz/matrix hardening is still pending.

## Development

```bash
bun install
bun run test
bun run check
bun run build
```

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

A **[QuantX](https://qntx.fun)** open-source project.

<a href="https://qntx.fun"><img alt="QuantX" width="369" src="https://raw.githubusercontent.com/qntx/.github/main/profile/qntx.svg" /></a>

Code is law. We write both.

</div>
