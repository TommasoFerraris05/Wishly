import { describe, it } from "node:test";
import assert from "node:assert/strict";
const expect = (v: unknown) => ({
  toBe: (x: unknown) => assert.equal(v, x),
  toEqual: (x: unknown) => assert.deepEqual(v, x),
  toBeNull: () => assert.equal(v, null),
  toBeTruthy: () => assert.ok(v),
  toContain: (x: string) => assert.ok(String(v).includes(x)),
  toHaveLength: (n: number) => assert.equal((v as unknown[]).length, n),
  toThrow: () => assert.throws(v as () => void),
  not: { toContain: (x: string) => assert.ok(!String(v).includes(x)) },
});
import {
  blank,
  toDraft,
  safeUrl,
  validateDraft,
  sorted,
  shareText,
  parseBackup,
  type Gift,
} from "../src/model.ts";
const gift = (id: string, price: number | null, priority = 7): Gift => ({
  ...blank("one"),
  id,
  name: "Un libro",
  url: "https://shop.example.com/book",
  price,
  priceCheckedAt: price === null ? null : 1000,
  priceSource: price === null ? null : "manual",
  priority,
  createdAt: 1000,
  updatedAt: 1000,
  revision: 1,
});
describe("URL e dati", () => {
  it("rifiuta schemi pericolosi, credenziali e reti private", () => {
    for (const u of [
      "javascript:alert(1)",
      "data:text/html,x",
      "http://shop.example.com",
      "https://user:pass@shop.example.com",
      "https://127.0.0.1",
      "https://192.168.1.2",
      "https://[::1]",
      "https://shop.local",
      "https://host.internal",
    ])
      expect(safeUrl(u)).toBe(false);
    expect(safeUrl("https://www.ikea.com/it/it/p/test")).toBe(true);
  });
  it("accetta un regalo senza prezzo e priorità 9", () =>
    expect(validateDraft(gift("a", null, 9))).toBeNull());
  it("rifiuta prezzi e priorità non validi", () => {
    expect(validateDraft(gift("a", NaN))).toBeTruthy();
    expect(validateDraft(gift("a", 1, 11))).toBeTruthy();
    expect(validateDraft(gift("a", 1, 1.5))).toBeTruthy();
  });
});
describe("ordinamento", () => {
  it("mantiene i prezzi assenti in fondo in entrambe le direzioni", () => {
    const x = [gift("a", null), gift("b", 0), gift("c", 100)];
    expect(sorted(x, "priceAsc").map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(sorted(x, "priceDesc").map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
  it("ammette due desideri 10 senza alterarne il voto", () => {
    const x = [gift("a", null, 10), gift("b", 10, 10), gift("c", 5, 3)];
    expect(sorted(x, "priorityDesc").map((x) => x.priority)).toEqual([
      10, 10, 3,
    ]);
  });
});
describe("condivisione e backup", () => {
  it("condivide esclusivamente il link prodotto e omette prezzi mancanti", () => {
    const s = shareText(gift("a", null, 9));
    expect(s).toContain("https://shop.example.com/book");
    expect(s).toContain("9/10");
    expect(s).not.toContain("Prezzo");
    expect(s).not.toContain("github.io");
  });
  it("importa un backup valido", () => {
    expect(
      parseBackup(JSON.stringify({ version: 1, gifts: [gift("a", 20)] })),
    ).toHaveLength(1);
  });
  it("rifiuta duplicati e payload alterati", () => {
    expect(() =>
      parseBackup(
        JSON.stringify({ version: 1, gifts: [gift("a", 20), gift("a", null)] }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          version: 1,
          gifts: [{ ...gift("a", 20), url: "javascript:alert(1)" }],
        }),
      ),
    ).toThrow();
  });
});

it("la modifica non include identificativi o metadati riservati nel draft", () => {
  const d = toDraft(gift("a", 20));
  assert.ok(!("id" in d));
  assert.ok(!("revision" in d));
  assert.equal(validateDraft(d), null);
});
