import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  runTransaction,
} from "firebase/firestore";
import type { Draft, Gift, Profiles } from "./model";
const e = import.meta.env;
export const configured = !!(
  e.VITE_FIREBASE_API_KEY &&
  e.VITE_FIREBASE_PROJECT_ID &&
  e.VITE_FIREBASE_AUTH_DOMAIN &&
  e.VITE_FIREBASE_APP_ID
);
const app = configured
  ? initializeApp({
      apiKey: e.VITE_FIREBASE_API_KEY,
      projectId: e.VITE_FIREBASE_PROJECT_ID,
      authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
      appId: e.VITE_FIREBASE_APP_ID,
    })
  : null;
export const auth = app ? getAuth(app) : null;
// Cache solo in memoria: evita di lasciare wishlist private su dispositivi condivisi dopo il logout.
export const db = app ? getFirestore(app) : null;
export const giftsRef = () => collection(db!, "gifts");
export async function login() {
  if (!auth) throw Error("Collega prima Firebase seguendo il README.");
  await signInWithPopup(auth, new GoogleAuthProvider());
}
if (auth) void setPersistence(auth, browserLocalPersistence).catch(() => {});
export async function saveGift(d: Draft, previous?: Gift) {
  if (!navigator.onLine)
    throw Error(
      "Sei offline. Mantieni aperto il modulo e riprova quando torna la connessione.",
    );
  const ref = previous ? doc(db!, "gifts", previous.id) : doc(giftsRef());
  await runTransaction(db!, async (tx) => {
    const snap = await tx.get(ref);
    if (
      previous &&
      (!snap.exists() || snap.data().revision !== previous.revision)
    )
      throw Error(
        "Questo desiderio è stato modificato dall’altra persona. Copia le tue note, chiudi e riapri il desiderio aggiornato.",
      );
    const now = Date.now();
    tx.set(ref, {
      ...d,
      name: d.name.trim(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      revision: (previous?.revision ?? 0) + 1,
    });
  });
}
export async function removeGift(g: Gift) {
  await runTransaction(db!, async (tx) => {
    const ref = doc(db!, "gifts", g.id),
      snap = await tx.get(ref);
    if (!snap.exists()) return;
    if (snap.data().revision !== g.revision)
      throw Error("Il desiderio è cambiato. Riaprilo prima di eliminarlo.");
    tx.delete(ref);
  });
}
export async function saveProfiles(profiles: Profiles, revision: number) {
  await runTransaction(db!, async (tx) => {
    const ref = doc(db!, "settings", "profiles"),
      snap = await tx.get(ref);
    if ((snap.data()?.revision ?? 0) !== revision)
      throw Error("I profili sono cambiati: riapri le impostazioni e riprova.");
    tx.set(ref, { ...profiles, revision: revision + 1 });
  });
}
export async function importGifts(gifts: Gift[]) {
  return runTransaction(db!, async (tx) => {
    const refs = gifts.map((g) => doc(db!, "gifts", g.id));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    let added = 0;
    gifts.forEach((g, i) => {
      if (!snaps[i].exists()) {
        const { id, ...data } = g;
        tx.set(refs[i], { ...data, revision: 1 });
        added++;
      }
    });
    return added;
  });
}
export function friendly(e: unknown) {
  const code = (e as { code?: string })?.code;
  if (code?.includes("permission-denied"))
    return "Account non autorizzato. Inserisci i due UID nelle regole Firestore.";
  if (code?.includes("popup-blocked"))
    return "Il browser ha bloccato il login. Consenti i popup e apri Wishly in Safari o Chrome.";
  if (code?.includes("popup-closed"))
    return "Accesso annullato. Puoi riprovare.";
  if (code?.includes("unauthorized-domain"))
    return "Dominio non autorizzato: aggiungilo in Firebase Authentication.";
  if (code?.includes("unavailable") || code?.includes("network"))
    return "Connessione non disponibile. Le modifiche non sono state salvate: riprova.";
  return e instanceof Error ? e.message : "Operazione non riuscita. Riprova.";
}
