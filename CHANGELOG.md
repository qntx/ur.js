# Changelog

## Unreleased

- L4 `Ur` value and `CborDecode`/`CborType` error codes. `@blockchaincommons/dcbor` is a devDependency only.

## 1.0.0 - 2026-09-12

### Breaking

- `Encoder.nextPart()` when `fragmentCount === 1` emits a single-part `ur:<type>/<body>` instead of fountain `1-1`.
- `Decoder.receive` accepts single-part URIs and completes the session.
- `NotMultiPart` removed.
- Type is pinned after successful ingest, not on parse.
- Exceeding `maxUriLen`, UR-layer `Part.fromCbor` `ResourceLimit`, and fountain `DecoderState` poison the session; later `receive` / `message` throw the same code.
- `Part.fromCbor` caps `sequenceCount` at `maxFragmentCount`.
- First-part padding wider than one fragment (`product - ml >= fragLen`) is `InconsistentPart`.

### Added

- `Encoder.isSinglePart`, `Encoder.complete`
- `decodeMessage(uri)` — single-part payload or `NotSinglePart`
- `SinglePartExhausted` — fountain encoder `K == 1` second `nextPart`

### Changed

- Duplicate single-part of the same type is ignored (first payload wins; body is not compared).
- `DEFAULT_LIMITS` integers frozen (same as bcur 1.0 Default). Override with `new Decoder({ limits })`.

### Notes

- Public API is transport-only: opaque payload bytes plus a type token. No dCBOR parse, no type registry.
- ur-rs `Decoder` will not consume K==1 outbound single-part URIs. This `Decoder` still accepts ur-rs fountain `1-1`.

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
