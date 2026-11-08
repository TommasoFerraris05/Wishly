export type ProfileId = "one" | "two";
export interface Profile {
  name: string;
  color: string;
  initial: string;
}
export type Profiles = Record<ProfileId, Profile>;
export interface Gift {
  id: string;
  owner: ProfileId;
  name: string;
  url: string;
  image: string;
  store: string;
  price: number | null;
  currency: string;
  priority: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
  priceCheckedAt: number | null;
  priceSource: "manual" | "automatic" | null;
  revision: number;
}
export type Draft = Omit<Gift, "id" | "createdAt" | "updatedAt" | "revision">;
export const defaults: Profiles = {
  one: { name: "La mia wishlist", color: "#173D35", initial: "M" },
  two: { name: "La sua wishlist", color: "#A83D51", initial: "S" },
};
export const blank = (owner: ProfileId): Draft => ({
  owner,
  name: "",
  url: "",
  image: "",
  store: "",
  price: null,
  currency: "EUR",
  priority: 7,
  notes: "",
  priceCheckedAt: null,
  priceSource: null,
});
export function safeUrl(value: string, optional = false): boolean {
  if (!value) return optional;
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      u.hostname.includes(".") &&
      !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
        u.hostname,
      ) &&
      !u.hostname.endsWith(".local") &&
      !u.hostname.endsWith(".internal") &&
      !u.hostname.includes(":")
    );
  } catch {
    return false;
  }
}
export function validateDraft(d: Draft): string | null {
  if (!safeUrl(d.url) || d.url.length > 2048)
    return "Inserisci un link HTTPS valido a un negozio.";
  if (!d.name.trim() || d.name.length > 200)
    return "Inserisci un nome (massimo 200 caratteri).";
  if (!safeUrl(d.image, true) || d.image.length > 2048)
    return "La fotografia deve avere un URL HTTPS valido.";
  if (!["one", "two"].includes(d.owner)) return "Wishlist non valida.";
  if (!Number.isInteger(d.priority) || d.priority < 1 || d.priority > 10)
    return "Scegli un desiderio da 1 a 10.";
  if (
    d.price !== null &&
    (!Number.isFinite(d.price) || d.price < 0 || d.price > 1000000)
  )
    return "Inserisci un prezzo valido.";
  if (!["EUR", "CHF", "USD", "GBP"].includes(d.currency))
    return "Valuta non supportata.";
  if (d.notes.length > 4000 || d.store.length > 100)
    return "Note o nome negozio troppo lunghi.";
  if (![null, "manual", "automatic"].includes(d.priceSource))
    return "Origine prezzo non valida.";
  if (d.price === null && (d.priceSource !== null || d.priceCheckedAt !== null))
    return "Prezzo e provenienza non coerenti.";
  if (
    d.price !== null &&
    (!d.priceSource ||
      !Number.isFinite(d.priceCheckedAt) ||
      d.priceCheckedAt! <= 0)
  )
    return "Data del prezzo non valida.";
  return null;
}
export function money(price: number | null, currency = "EUR") {
  return price === null
    ? "Prezzo non disponibile"
    : new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(
        price,
      );
}
export const desire = (n: number) =>
  n <= 3
    ? "Un pensierino carino"
    : n <= 6
      ? "Mi piacerebbe molto"
      : n <= 8
        ? "Lo desidero davvero"
        : "Tra i miei desideri più grandi";
export function sorted(items: Gift[], sort: string) {
  return [...items].sort((a, b) => {
    if (sort.startsWith("price")) {
      if (a.price === null) return b.price === null ? 0 : 1;
      if (b.price === null) return -1;
      return (sort === "priceAsc" ? 1 : -1) * (a.price - b.price);
    }
    return sort === "priorityAsc"
      ? a.priority - b.priority
      : sort === "newest"
        ? b.createdAt - a.createdAt
        : sort === "oldest"
          ? a.createdAt - b.createdAt
          : b.priority - a.priority || b.createdAt - a.createdAt;
  });
}
export function shareText(g: Gift) {
  return `🎁 Ho trovato un regalo che mi piacerebbe ricevere!\n\n${g.name}\n\n${g.price === null ? "" : `Prezzo indicativo: ${money(g.price, g.currency)}\n\n`}Quanto lo desidero: ${g.priority}/10 ❤️\n\nEcco il link:\n${g.url}`;
}
export function parseBackup(text: string): Gift[] {
  const x = JSON.parse(text);
  if (x.version !== 1 || !Array.isArray(x.gifts) || x.gifts.length > 400)
    throw Error("Backup non valido: massimo 400 desideri, formato Wishly v1.");
  const ids = new Set();
  return x.gifts.map((g: Gift) => {
    if (
      typeof g !== "object" ||
      g === null ||
      typeof g.id !== "string" ||
      !/^[\w-]{1,128}$/.test(g.id) ||
      ids.has(g.id) ||
      !["name", "url", "image", "store", "notes", "currency"].every(
        (k) => typeof (g as unknown as Record<string, unknown>)[k] === "string",
      ) ||
      validateDraft(g) ||
      ![g.createdAt, g.updatedAt].every((n) => Number.isFinite(n) && n > 0) ||
      !Number.isInteger(g.revision) ||
      g.revision < 1
    )
      throw Error(
        "Il backup contiene dati non validi o identificativi duplicati.",
      );
    ids.add(g.id);
    return {
      id: g.id,
      owner: g.owner,
      name: g.name,
      url: g.url,
      image: g.image,
      store: g.store,
      price: g.price,
      currency: g.currency,
      priority: g.priority,
      notes: g.notes,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      priceCheckedAt: g.priceCheckedAt,
      priceSource: g.priceSource,
      revision: g.revision,
    };
  });
}

export function toDraft(g: Gift): Draft {
  return {
    owner: g.owner,
    name: g.name,
    url: g.url,
    image: g.image,
    store: g.store,
    price: g.price,
    currency: g.currency,
    priority: g.priority,
    notes: g.notes,
    priceCheckedAt: g.priceCheckedAt,
    priceSource: g.priceSource,
  };
}
