import { createRemoteJWKSet, jwtVerify } from "jose";
interface Env {
  FIREBASE_PROJECT_ID: string;
  ALLOWED_UIDS: string;
  APP_ORIGIN: string;
  ALLOWED_HOSTS: string;
  RATE_LIMITER: RateLimit;
}
const keys = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);
export function allowedUrl(input: string, hosts: string[]): URL {
  const u = new URL(input);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !hosts.includes(u.hostname) ||
    !u.hostname.includes(".") ||
    /^(\d|localhost)/.test(u.hostname) ||
    u.hostname.endsWith(".local") ||
    u.hostname.endsWith(".internal")
  )
    throw Error("Dominio non abilitato");
  return u;
}
export function extractProduct(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const x of value) {
      const found = extractProduct(x);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>,
      t = o["@type"];
    if (t === "Product" || (Array.isArray(t) && t.includes("Product")))
      return o;
    if (o["@graph"]) return extractProduct(o["@graph"]);
  }
  return null;
}
const clean = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": env.APP_ORIGIN,
      Vary: "Origin",
      "Cache-Control": "no-store",
    };
    const reply = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (req.headers.get("Origin") !== env.APP_ORIGIN)
      return reply({ error: "Origine non autorizzata" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Authorization,Content-Type",
          "Access-Control-Max-Age": "600",
        },
      });
    if (req.method !== "POST")
      return reply({ error: "Metodo non consentito" }, 405);
    try {
      const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
      if (!token) return reply({ error: "Accesso richiesto" }, 401);
      const { payload } = await jwtVerify(token, keys, {
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        audience: env.FIREBASE_PROJECT_ID,
        algorithms: ["RS256"],
      });
      if (
        !payload.sub ||
        !env.ALLOWED_UIDS.split(",")
          .map((x) => x.trim())
          .includes(payload.sub)
      )
        return reply({ error: "Account non autorizzato" }, 403);
      if (!(await env.RATE_LIMITER.limit({ key: payload.sub })).success)
        return reply({ error: "Riprova tra un minuto" }, 429);
      const body = await req.text();
      if (body.length > 4096)
        return reply({ error: "Richiesta troppo grande" }, 413);
      const parsed = JSON.parse(body);
      if (typeof parsed.url !== "string" || parsed.url.length > 2048)
        return reply({ error: "URL non valido" }, 400);
      const hosts = env.ALLOWED_HOSTS.split(",").map((x) => x.trim());
      let url = allowedUrl(parsed.url, hosts),
        response: Response | undefined;
      const signal = AbortSignal.timeout(9000);
      for (let i = 0; i < 4; i++) {
        response = await fetch(url.href, {
          redirect: "manual",
          signal,
          headers: { Accept: "text/html", "User-Agent": "WishlyMetadata/1.0" },
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("Location");
          await response.body?.cancel();
          if (!location) throw Error("Redirect non valido");
          url = allowedUrl(new URL(location, url).href, hosts);
          response = undefined;
          continue;
        }
        break;
      }
      if (
        !response?.ok ||
        !response.headers.get("Content-Type")?.includes("text/html")
      )
        return reply({ error: "Dettagli non disponibili" }, 422);
      const reader = response.body!.getReader();
      let total = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 1500000) {
          await reader.cancel();
          return reply({ error: "Pagina troppo grande" }, 422);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      const html = new TextDecoder().decode(bytes);
      const meta: Record<string, string> = {},
        scripts: string[] = [];
      let scriptIndex = -1;
      let title = "";
      await new HTMLRewriter()
        .on("meta", {
          element(el) {
            const key = el.getAttribute("property") || el.getAttribute("name");
            if (key) meta[key] = el.getAttribute("content") || "";
          },
        })
        .on("title", {
          text(t) {
            title += t.text;
          },
        })
        .on('script[type="application/ld+json"]', {
          element() {
            scriptIndex++;
            scripts[scriptIndex] = "";
          },
          text(t) {
            scripts[scriptIndex] += t.text;
          },
        })
        .transform(new Response(html))
        .text();
      let product: Record<string, unknown> | null = null;
      for (const s of scripts) {
        try {
          product = extractProduct(JSON.parse(s));
          if (product) break;
        } catch {}
      }
      const p = product || {},
        offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      const o =
        offer && typeof offer === "object"
          ? (offer as Record<string, unknown>)
          : {};
      const rawPrice =
        o.price ?? meta["product:price:amount"] ?? meta["og:price:amount"];
      const amount =
        typeof rawPrice === "number"
          ? rawPrice
          : typeof rawPrice === "string" &&
              /^\d+(\.\d{1,4})?$/.test(rawPrice.trim())
            ? Number(rawPrice)
            : NaN;
      const currency = clean(
        o.priceCurrency ||
          meta["product:price:currency"] ||
          meta["og:price:currency"],
        3,
      ).toUpperCase();
      let image = Array.isArray(p.image) ? p.image[0] : p.image;
      if (image && typeof image === "object")
        image = (image as Record<string, unknown>).url;
      image = image || meta["og:image"];
      let imageUrl = "";
      try {
        const resolved = new URL(String(image), url);
        if (
          image &&
          resolved.protocol === "https:" &&
          !resolved.username &&
          !resolved.password
        )
          imageUrl = resolved.href;
      } catch {}
      return reply({
        name: clean(p.name || meta["og:title"] || title),
        image: clean(imageUrl, 2048),
        store: clean(meta["og:site_name"] || url.hostname, 100),
        ...(Number.isFinite(amount) &&
        amount >= 0 &&
        amount <= 1000000 &&
        ["EUR", "CHF", "USD", "GBP"].includes(currency)
          ? { price: amount, currency }
          : {}),
      });
    } catch {
      return reply(
        {
          error:
            "Non siamo riusciti a recuperare tutti i dettagli. Puoi completarli tu.",
        },
        422,
      );
    }
  },
};
