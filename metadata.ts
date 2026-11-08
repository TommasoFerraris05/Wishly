import { auth } from "./firebase";
import { safeUrl } from "./model";
export type Metadata = {
  name?: string;
  image?: string;
  store?: string;
  price?: number;
  currency?: string;
};
export async function metadata(url: string): Promise<Metadata> {
  if (!safeUrl(url)) throw Error("Inserisci un link HTTPS valido.");
  const endpoint = import.meta.env.VITE_METADATA_WORKER_URL;
  if (!endpoint)
    throw Error(
      "Non siamo riusciti a recuperare tutti i dettagli. Puoi completarli tu.",
    );
  const token = await auth!.currentUser!.getIdToken();
  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw Error(
      "Non siamo riusciti a recuperare tutti i dettagli. Puoi completarli tu.",
    );
  return r.json();
}
