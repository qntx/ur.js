<!-- markdownlint-disable MD033 MD041 -->

# `@qntx/ur`

Uniform Resources (UR) for TypeScript.

Bytewords, fountain codes, and single- or multi-part UR strings. Transport-only at the root; typed dCBOR is `@qntx/ur/typed`. Wire-compatible with [bcur](https://github.com/qntx/bcur).

`Encoder` K==1 outbound is single-part (an ur-rs `Decoder` will not consume it). This package still decodes ur-rs `1-1`.

See [docs/](../../docs/).

## License

Licensed under the MIT License ([LICENSE](LICENSE) or <https://opensource.org/licenses/MIT>).
