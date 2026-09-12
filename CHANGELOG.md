# Changelog

## Unreleased

### Breaking

- `Encoder.nextPart()` when `fragmentCount === 1` emits a single-part `ur:<type>/<body>` instead of fountain `1-1`.
- `Decoder.receive` accepts single-part URIs and completes the session.
- `NotMultiPart` removed.
- Type is pinned after successful ingest, not on parse.

### Added

- `Encoder.isSinglePart`, `Encoder.complete`
- `decodeMessage(uri)` — single-part payload or `NotSinglePart`
- `SinglePartExhausted` — fountain encoder `K == 1` second `nextPart`

### Changed

- Duplicate single-part of the same type is ignored (first payload wins; body is not compared).

## 0.1.0

### Changed

- Package name is `@qntx/ur` (npm name `ur` is already taken by an unrelated package).

### Added

- Bytes-first Uniform Resources transport aligned with bcur / ur-rs:
  - Bytewords (BCR-2020-012): standard, uri, minimal
  - Fountain codes (MUR): Xoshiro256**, Walker alias sampling, fixed-schema Part CBOR
  - UR encode/decode and multi-part `Encoder` / `Decoder`
- `DecoderLimits` with fail-closed poison on resource exceed
- UR type stickiness and full-URI case-fold for QR uppercase
- Structured `UrError` with stable `code` field
- Interop goldens from ur-rs (MIT) and adversarial decoder tests

### Notes

- Public API is transport-only (no application type registry).
- Default `DecoderLimits` numeric values are provisional until 1.0.
