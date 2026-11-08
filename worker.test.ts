import { describe, it } from "node:test";
import assert from "node:assert/strict";
import worker, { allowedUrl, extractProduct } from "../worker/src/index.ts";
describe("Worker metadati", () => {
  it("accetta solo host HTTPS esatti e blocca redirect fuori lista", () => {
    const hosts = ["www.ikea.com", "www.amazon.it"];
    assert.equal(
      allowedUrl("https://www.ikea.com/it/it/", hosts).hostname,
      "www.ikea.com",
    );
    for (const url of [
      "https://www.ikea.com.evil.org",
      "https://evil.org",
      "http://www.ikea.com",
      "https://u:p@www.ikea.com",
      "https://www.ikea.com:8443",
      "https://127.0.0.1",
    ])
      assert.throws(() => allowedUrl(url, hosts));
  });
  it("estrae Product da JSON-LD diretto, array e graph", () => {
    const p = { "@type": "Product", name: "Libro" };
    assert.deepEqual(extractProduct(p), p);
    assert.deepEqual(extractProduct([{ "@type": "Website" }, p]), p);
    assert.deepEqual(extractProduct({ "@graph": [p] }), p);
    assert.equal(extractProduct({ "@type": "Website" }), null);
  });
  it("rifiuta origini estranee e richieste prive di token", async () => {
    const env = {
      APP_ORIGIN: "https://wishly.example.com",
      FIREBASE_PROJECT_ID: "demo",
      ALLOWED_UIDS: "one,two",
      ALLOWED_HOSTS: "www.ikea.com",
      RATE_LIMITER: { limit: async () => ({ success: true }) },
    };
    assert.equal(
      (
        await worker.fetch(
          new Request("https://metadata.example.com", {
            method: "POST",
            headers: { Origin: "https://foreign.example.com" },
          }),
          env as never,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await worker.fetch(
          new Request("https://metadata.example.com", {
            method: "POST",
            headers: { Origin: env.APP_ORIGIN },
          }),
          env as never,
        )
      ).status,
      401,
    );
  });
});
