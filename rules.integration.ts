import assert from "node:assert/strict";
import {
  before as beforeAll,
  after as afterAll,
  describe,
  it,
} from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
let env: RulesTestEnvironment;
const data = {
  owner: "one",
  name: "Libro",
  url: "https://example.com/book",
  image: "",
  store: "Libreria",
  price: null,
  currency: "EUR",
  priority: 9,
  notes: "",
  createdAt: 1000,
  updatedAt: 1000,
  priceCheckedAt: null,
  priceSource: null,
  revision: 1,
};
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-wishly",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
  await env.clearFirestore();
});
afterAll(async () => env?.cleanup());
describe("Privacy Firestore", () => {
  it("nega ogni lettura e scrittura senza accesso o con terzo UID", async () => {
    for (const db of [
      env.unauthenticatedContext().firestore(),
      env.authenticatedContext("intruso").firestore(),
    ]) {
      await assertFails(getDocs(collection(db, "gifts")));
      await assertFails(setDoc(doc(db, "gifts", "forbidden"), data));
      await assertFails(
        setDoc(doc(db, "settings", "profiles"), {
          one: { name: "x", color: "#ffffff", initial: "A" },
          two: { name: "y", color: "#000000", initial: "B" },
          revision: 1,
        }),
      );
      await assertFails(
        setDoc(doc(db, "admins", "intruso"), { allowed: true }),
      );
    }
  });
  it("consente ai due UID e blocca dati malformati e revisioni obsolete", async () => {
    const a = env.authenticatedContext("REPLACE_UID_ONE").firestore(),
      b = env.authenticatedContext("REPLACE_UID_TWO").firestore();
    await assertSucceeds(setDoc(doc(a, "gifts", "ok"), data));
    await assertSucceeds(getDoc(doc(b, "gifts", "ok")));
    await assertSucceeds(
      updateDoc(doc(b, "gifts", "ok"), { priority: 10, revision: 2 }),
    );
    await assertFails(
      updateDoc(doc(a, "gifts", "ok"), { priority: 3, revision: 2 }),
    );
    await assertFails(
      updateDoc(doc(a, "gifts", "ok"), { priority: 11, revision: 3 }),
    );
    await assertFails(
      setDoc(doc(a, "gifts", "extra"), { ...data, admin: true }),
    );
    await assertFails(
      setDoc(doc(a, "gifts", "url"), { ...data, url: "javascript:alert(1)" }),
    );
  });
  it("autorizza profili validi senza aprire altri documenti", async () => {
    const a = env.authenticatedContext("REPLACE_UID_ONE").firestore();
    await assertSucceeds(
      setDoc(doc(a, "settings", "profiles"), {
        one: { name: "Tommaso", color: "#173D35", initial: "T" },
        two: { name: "La sua wishlist", color: "#A83D51", initial: "S" },
        revision: 1,
      }),
    );
    await assertFails(
      setDoc(doc(a, "settings", "profiles"), {
        one: { name: "T", color: "#fff", initial: "T" },
        two: { name: "S", color: "#000000", initial: "S" },
        revision: 2,
      }),
    );
    await assertFails(setDoc(doc(a, "admins", "me"), { allowed: true }));
  });
});

it("sincronizza tra due client e rileva una revisione concorrente", async () => {
  const a = env.authenticatedContext("REPLACE_UID_ONE").firestore(),
    b = env.authenticatedContext("REPLACE_UID_TWO").firestore();
  const ra = doc(a, "gifts", "realtime"),
    rb = doc(b, "gifts", "realtime");
  await setDoc(ra, data);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(Error("Listener non aggiornato"));
    }, 5000);
    const stop = onSnapshot(
      rb,
      (s) => {
        if (s.data()?.priority === 8) {
          clearTimeout(timer);
          stop();
          resolve();
        }
      },
      reject,
    );
    void updateDoc(ra, { priority: 8, revision: 2 }).catch(reject);
  });
  await assert.rejects(
    runTransaction(a, async (tx) => {
      const snap = await tx.get(ra);
      if (snap.data()?.revision !== 1) throw Error("Conflitto rilevato");
      tx.update(ra, { priority: 2, revision: 2 });
    }),
  );
  await assertSucceeds(getDoc(rb));
});
