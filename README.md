# ur.js

Uniform Resources (UR) transport for JavaScript/TypeScript.

Bytes-first library for [BCR-2020-005](https://github.com/BlockchainCommons/Research/blob/master/papers/bcr-2020-005-ur.md) UR strings: **Bytewords**, **fountain codes**, and **single-/multi-part UR** encode/decode. Wire-compatible with [bcur](https://github.com/qntx/bcur), ur-rs, and Blockchain Commons references.

## Install

```bash
bun add @qntx/ur
# or: npm i @qntx/ur
```

## Usage

```ts
import { encode, decode, Encoder, Decoder, UrType } from "@qntx/ur";

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

**0.1.0 transport release candidate.** Wire interop goldens vs bcur/ur-rs pass; `DecoderLimits` + poison are on by default.

This is **not** a 1.0 enterprise freeze: default limit numbers may change before 1.0; fuzz and multi-runtime CI matrices are still hardening work.

## Default decoder limits

| Limit                   | Default   |
| ----------------------- | --------- |
| `maxMessageLength`      | 1 048 576 |
| `maxFragmentCount`      | 2 000     |
| `maxFragmentDataLength` | 8 192     |
| `maxBufferParts`        | 4 000     |
| `maxReceivedParts`      | 8 000     |
| `maxUriLen`             | 8 192     |

Override via `new Decoder({ limits: { … } })` or `new FountainDecoder({ … })`. Exceeding a limit **poisons** the decoder (subsequent receives fail).

## Errors

Failures throw `UrError` with a stable `code` (e.g. `InvalidBytewordsChecksum`, `ResourceLimit`, `UnexpectedType`). Prefer switching on `error.code` rather than message text.

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
