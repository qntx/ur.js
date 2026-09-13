import { readdirSync, readFileSync } from "node:fs";
import { Ur } from "../dist/typed.mjs";
import { encode, UrError, UrType } from "../dist/index.mjs";

const ur = Ur.create("test", [1, 2, 3]);
if (ur.string() !== "ur:test/lsadaoaxjygonesw") throw new Error(ur.string());
const hello = encode(new TextEncoder().encode("hello"), UrType.bytes());
try {
  Ur.fromUrString(hello);
  throw new Error("expected throw");
} catch (e) {
  if (!(e instanceof UrError) || e.code !== "CborDecode") throw e;
}

const typed = readFileSync("./dist/typed.mjs", "utf8");
if (!typed.includes("@blockchaincommons/dcbor")) {
  throw new Error("typed.mjs must import @blockchaincommons/dcbor");
}
if (!/\bfrom\s*["']@blockchaincommons\/dcbor["']/.test(typed)) {
  throw new Error("typed.mjs must keep dcbor as an external from-import");
}
if (typed.includes("function decodeCbor") || typed.includes("CborError.underrun")) {
  throw new Error("typed.mjs inlined dcbor source");
}
for (const name of readdirSync("./dist").filter((n) => n.endsWith(".mjs"))) {
  if (name === "typed.mjs") continue;
  const body = readFileSync(`./dist/${name}`, "utf8");
  if (body.includes("@blockchaincommons/dcbor")) {
    throw new Error(`${name} must not import @blockchaincommons/dcbor`);
  }
}
const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
for (const key of [".", "./typed"]) {
  const exp = pkg.exports[key];
  if (typeof exp !== "object" || exp === null) {
    throw new Error(`${key} export must be an object map, got ${JSON.stringify(exp)}`);
  }
  if (!exp.types || !exp.import || !exp.default) {
    throw new Error(`${key} export missing types/import/default`);
  }
}
