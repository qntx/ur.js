# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | Yes       |
| < 1.0   | No        |

## Reporting a vulnerability

Report security issues privately via GitHub Security Advisories on
[qntx/ur.js](https://github.com/qntx/ur.js/security/advisories/new), or email
`security@qntx.fun` if that channel is unavailable.

Please include:

- Affected version and runtime (Node/Bun/browser)
- Minimal reproduction (URI/part bytes preferred)
- Impact assessment (e.g. decoder resource exhaustion, CRC bypass)

Do not open public issues for unfixed vulnerabilities.

## Threat model (summary)

This library is a **UR transport codec**. It does not implement application
cryptography or trust policies.

| Threat                                         | Severity             | Mitigation                                                                                                               |
| ---------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| QR stream resource exhaustion                  | High                 | `DecoderLimits` + session poison including `uri_len`, UR-layer `fragment_data`/`fragment_count`, fountain `DecoderState` |
| Public `Part.fromCbor` huge `K` allocation     | High                 | `maxFragmentCount` on decode                                                                                             |
| `seqNum` wrap recycling simple parts           | Medium (theoretical) | Fail-closed at `0xffffffff`; `maxReceivedParts` 8_000                                                                    |
| Non-canonical Part CBOR                        | Medium               | Keep shortest-form decoder                                                                                               |
| Mixing single-part and fountain in one session | Medium               | `InconsistentPart`                                                                                                       |
| Duplicate single-part different body           | Low                  | First wins, same type; documented                                                                                        |
| Type confusion across parts                    | Medium               | Type stickiness after successful ingest; `expectedType`                                                                  |
| Invalid CRC                                    | Low                  | Bytewords CRC + message CRC on fountain join                                                                             |
| Application payload treated as trusted         | High (host)          | Recovered bytes untrusted; dCBOR/type checks are the host's job                                                          |

Hosts scanning untrusted QR streams must keep default limits (or tighter) and
treat recovered payloads as untrusted input. A poisoned `Decoder` is discarded;
construct a new instance.
