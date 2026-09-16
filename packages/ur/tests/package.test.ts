import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vite-plus/test";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  exports: Record<string, unknown>;
  publishConfig?: { exports?: unknown };
};

function exportTarget(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "default" in value) {
    const next = (value as { default: unknown }).default;
    if (typeof next === "string") return next;
  }
  throw new Error(`unexpected export entry: ${JSON.stringify(value)}`);
}

const dist = (name: string) => pathToFileURL(resolve(root, "dist", name)).href;

test("package exports resolve to packed files, not source", () => {
  expect(exportTarget(pkg.exports["."])).toBe("./dist/index.mjs");
  expect(exportTarget(pkg.exports["./typed"])).toBe("./dist/typed.mjs");
  expect(pkg.publishConfig?.exports).toBeUndefined();
});

test("packed index.mjs does not mention dcbor", () => {
  const src = readFileSync(resolve(root, "dist/index.mjs"), "utf8");
  expect(src.includes("@blockchaincommons/dcbor")).toBe(false);
});

test("packed UrError is one class across entries", async () => {
  const index = (await import(dist("index.mjs"))) as { UrError: unknown };
  const typed = (await import(dist("typed.mjs"))) as { UrError: unknown };
  expect(index.UrError).toBe(typed.UrError);
});
