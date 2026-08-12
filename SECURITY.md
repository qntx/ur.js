# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

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

| Threat                        | Mitigation                           |
| ----------------------------- | ------------------------------------ |
| Invalid CRC accepted          | Bytewords + message CRC verification |
| QR stream resource exhaustion | `DecoderLimits` + poison             |
| Inconsistent multiparts       | Metadata equality + type stickiness  |
| Non-canonical Part CBOR       | Shortest-form fixed-schema codec     |

Hosts scanning untrusted QR streams must keep default limits (or tighter) and
treat recovered payloads as untrusted input.
