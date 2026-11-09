import { useConfirm } from "./Confirm";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type ReactNode,
} from "react";
import {
  Gift as GiftIcon,
  Heart,
  Plus,
  Settings,
  ArrowUpRight,
  Search,
  SlidersHorizontal,
  X,
  ArrowLeft,
  Check,
  Copy,
  Share2,
  Trash2,
  Pencil,
  LogOut,
  Download,
  Upload,
  LockKeyhole,
  Sparkles,
  Link,
  RefreshCw,
  WifiOff,
  ChevronRight,
  ImagePlus,
  ClipboardPaste,
} from "lucide-react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  auth,
  db,
  configured,
  login,
  giftsRef,
  saveGift,
  removeGift,
  saveProfiles,
  importGifts,
  friendly,
} from "./firebase";
import {
  blank,
  toDraft,
  defaults,
  money,
  desire,
  sorted,
  shareText,
  validateDraft,
  parseBackup,
  safeUrl,
  isEmbeddedPhoto,
  validPhoto,
  type Gift,
  type Draft,
  type ProfileId,
  type Profiles,
} from "./model";
import { metadata } from "./metadata";
import { preparePhoto } from "./photo";
const ids: ProfileId[] = ["one", "two"];
function ProductImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="image-placeholder">
      <GiftIcon size={48} strokeWidth={1} />
      <span>Un desiderio speciale</span>
    </div>
  );
}
function Avatar({ profile }: { profile: Profiles["one"] }) {
  return (
    <span className="avatar" style={{ background: profile.color }}>
      {profile.initial}
    </span>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon" onClick={onClose} aria-label="Chiudi">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function GiftForm({
  owner,
  profiles,
  previous,
  onClose,
  onSaved,
  toast,
}: {
  owner: ProfileId;
  profiles: Profiles;
  previous?: Gift;
  onClose: () => void;
  onSaved: () => void;
  toast: (s: string) => void;
}) {
  const confirm = useConfirm();
  const initial = previous ? toDraft(previous) : blank(owner);
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  async function close() {
    if (
      !busy && !photoBusy &&
      (!dirty || (await confirm("Uscire senza salvare le modifiche?")))
    )
      onClose();
  }
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", handler);
    return () => removeEventListener("beforeunload", handler);
  }, [dirty]);
  function field<K extends keyof Draft>(k: K, v: Draft[K]) {
    setD((old) => ({ ...old, [k]: v }));
  }
  async function addPhoto(file?: File | null) {
    if (!file) return;
    setError("");
    setPhotoBusy(true);
    try {
      const compact = await preparePhoto(file);
      field("image", compact);
      setHint("Fotografia pronta: è stata ridotta per salvare spazio e si sincronizzerà tra i due telefoni.");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setPhotoBusy(false);
    }
  }
  function pastePhoto(e: ReactClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const file = Array.from(e.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))?.getAsFile();
    if (file) void addPhoto(file);
    else setHint("Negli appunti non c'è una foto. Puoi selezionarla dalla galleria oppure incollare il suo link qui sotto.");
  }
  async function find() {
    if (!safeUrl(d.url)) {
      setError("Inserisci un link HTTPS valido.");
      return;
    }
    if (
      (d.name || d.image || d.price !== null) &&
      !(await confirm(
        "Sostituire i dettagli compilati con quelli recuperabili dal negozio? I campi non recuperati saranno mantenuti.",
      ))
    )
      return;
    setError("");
    setFetching(true);
    setHint("");
    try {
      const m = await metadata(d.url);
      setD((old) => ({
        ...old,
        ...(m.name ? { name: m.name } : {}),
        ...(safeUrl(m.image || "") ? { image: m.image! } : {}),
        store: m.store || old.store || new URL(old.url).hostname,
        ...(typeof m.price === "number" &&
        Number.isFinite(m.price) &&
        m.price >= 0 &&
        m.currency &&
        ["EUR", "CHF", "USD", "GBP"].includes(m.currency)
          ? {
              price: m.price,
              currency: m.currency,
              priceCheckedAt: Date.now(),
              priceSource: "automatic" as const,
            }
          : {}),
      }));
      setHint(
        "Dettagli recuperati. Controllali prima di salvare. Il prezzo è indicativo.",
      );
    } catch (e) {
      setD((old) => ({
        ...old,
        store: old.store || new URL(old.url).hostname,
      }));
      setHint(friendly(e));
    } finally {
      setFetching(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const error = validateDraft(d);
    if (error) {
      setError(error);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await saveGift(d, previous);
      toast(
        previous
          ? "Desiderio aggiornato"
          : "Un desiderio in più, tutto per voi.",
      );
      onSaved();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={previous ? "Il tuo desiderio" : "Un nuovo desiderio"}
      onClose={close}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy || fetching || photoBusy}>
          <p className="muted">
            Le cose belle iniziano con un piccolo desiderio.
          </p>
          <label>
            Per chi è?
            <select
              value={d.owner}
              onChange={(e) => field("owner", e.target.value as ProfileId)}
            >
              {ids.map((id) => (
                <option key={id} value={id}>
                  {profiles[id].name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Link del prodotto
            <div className="url-field">
              <Link size={19} />
              <input
                required
                type="url"
                inputMode="url"
                placeholder="Incolla qui il link del tuo desiderio"
                value={d.url}
                maxLength={2048}
                onChange={(e) => field("url", e.target.value)}
              />
            </div>
          </label>
          <button
            disabled={fetching || busy}
            type="button"
            className="secondary wide"
            onClick={find}
          >
            {fetching ? (
              <RefreshCw className="spin" size={18} />
            ) : (
              <Sparkles size={18} />
            )}{" "}
            {fetching
              ? "Cerco i dettagli…"
              : previous
                ? "Aggiorna dati prodotto"
                : "Trova prodotto"}
          </button>
          {hint && (
            <p role="status" className="notice">
              {hint}
            </p>
          )}
          {fetching ? (
            <div className="skeleton" aria-label="Recupero del prodotto" />
          ) : (
            <div className="divider">
              <span>Oppure completa i dettagli</span>
            </div>
          )}
          <label>
            Nome del prodotto
            <input
              required
              maxLength={200}
              value={d.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="Come si chiama il tuo desiderio?"
            />
          </label>
          <div className="form-row">
            <label>
              Prezzo indicativo
              <input
                inputMode="decimal"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                placeholder="Facoltativo"
                value={d.price ?? ""}
                onChange={(e) =>
                  setD({
                    ...d,
                    price:
                      e.target.value === "" ? null : Number(e.target.value),
                    priceSource: e.target.value === "" ? null : "manual",
                    priceCheckedAt: e.target.value === "" ? null : Date.now(),
                  })
                }
              />
            </label>
            <label>
              Valuta
              <select
                value={d.currency}
                onChange={(e) =>
                  setD({
                    ...d,
                    currency: e.target.value,
                    priceSource: d.price === null ? null : "manual",
                    priceCheckedAt: d.price === null ? null : Date.now(),
                  })
                }
              >
                {["EUR", "CHF", "USD", "GBP"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Negozio
            <input
              maxLength={100}
              value={d.store}
              onChange={(e) => field("store", e.target.value)}
              placeholder="Nome del negozio"
            />
          </label>
          <section className="photo-editor" aria-label="Fotografia del regalo">
            <div className="photo-editor-title">
              <div>
                <strong>Fotografia del regalo</strong>
                <span className="muted"> · facoltativa</span>
              </div>
              {isEmbeddedPhoto(d.image) && (
                <span className="photo-status"><Check size={14} /> Foto salvabile</span>
              )}
            </div>
            <div className="photo-choices">
              <label className="secondary photo-file">
                <ImagePlus size={18} />
                Scegli dalla galleria
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  aria-label="Scegli una fotografia dalla galleria del telefono"
                  onChange={(e) => {
                    void addPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <label className="photo-paste-label" htmlFor="photo-paste">
              <ClipboardPaste size={17} />
              Oppure incolla qui una fotografia
            </label>
            <textarea
              id="photo-paste"
              className="photo-paste-input"
              rows={1}
              placeholder="Tocca qui e scegli Incolla, oppure usa Ctrl+V"
              aria-label="Incolla una fotografia dagli appunti"
              onPaste={pastePhoto}
              onChange={(e) => { e.target.value = ""; }}
            />
            <label className="photo-url-label">
              Oppure incolla un link immagine
              <input
                type="url"
                inputMode="url"
                value={isEmbeddedPhoto(d.image) ? "" : d.image}
                maxLength={2048}
                placeholder="https://…"
                onChange={(e) => field("image", e.target.value)}
              />
            </label>
            {d.image && validPhoto(d.image) && (
              <div className="photo-preview">
                <div className="small-preview">
                  <ProductImage src={d.image} name={d.name || "Anteprima del regalo"} />
                </div>
                <button
                  type="button"
                  className="photo-remove"
                  onClick={() => field("image", "")}
                >
                  <X size={15} /> Rimuovi foto
                </button>
              </div>
            )}
            <p className="photo-help">
              Le foto dalla galleria vengono ridotte automaticamente e salvate
              nella vostra wishlist privata, senza servizi a pagamento.
            </p>
          </section>
          <div className="priority-box">
            <div>
              <label htmlFor="priority">Quanto lo desideri?</label>
              <strong>
                <Heart size={18} />
                {d.priority}
                <small>/10</small>
              </strong>
            </div>
            <input
              id="priority"
              type="range"
              min="1"
              max="10"
              step="1"
              value={d.priority}
              onChange={(e) => field("priority", Number(e.target.value))}
            />
            <p>{desire(d.priority)}</p>
          </div>
          <label>
            Un pensiero in più <span className="muted">· facoltativo</span>
            <textarea
              maxLength={4000}
              rows={3}
              placeholder="Taglia, colore, o un piccolo indizio…"
              value={d.notes}
              onChange={(e) => field("notes", e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              Annulla
            </button>
            <button className="primary" disabled={busy || fetching || photoBusy}>
              {busy ? (
                <RefreshCw className="spin" size={18} />
              ) : (
                <Check size={18} />
              )}{" "}
              {photoBusy ? "Preparo la foto…" : busy ? "Salvataggio…" : "Salva desiderio"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
export default function App() {
  const confirm = useConfirm();
  const [settingsDirty, setSettingsDirty] = useState(false);
  async function navigate(next: "wishlist" | "settings") {
    if (next === page) return;
    if (
      settingsDirty &&
      !(await confirm("Uscire dalle impostazioni senza salvare le modifiche?"))
    )
      return;
    setPage(next);
  }
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(configured),
    [authorized, setAuthorized] = useState(false),
    [loading, setLoading] = useState(false),
    [gifts, setGifts] = useState<Gift[]>([]),
    [profiles, setProfiles] = useState<Profiles>(defaults),
    [profileRevision, setProfileRevision] = useState(0),
    [owner, setOwner] = useState<ProfileId>("one"),
    [page, setPage] = useState<"wishlist" | "settings">("wishlist"),
    [editor, setEditor] = useState<Gift | "new" | null>(null),
    [detail, setDetail] = useState<Gift | null>(null),
    [q, setQ] = useState(""),
    [sort, setSort] = useState("priorityDesc"),
    [store, setStore] = useState(""),
    [filters, setFilters] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [cached, setCached] = useState(false),
    [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    const a = () => setOnline(true),
      b = () => setOnline(false);
    addEventListener("online", a);
    addEventListener("offline", b);
    return () => {
      removeEventListener("online", a);
      removeEventListener("offline", b);
    };
  }, []);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthorized(false);
      setGifts([]);
      setProfiles(defaults);
      setProfileRevision(0);
      setError("");
      setAuthLoading(false);
      setEditor(null);
      setDetail(null);
    });
  }, []);
  useEffect(() => {
    if (!user || !db) return;
    setLoading(true);
    const fail = (e: unknown) => {
      setError(friendly(e));
      setLoading(false);
      setAuthorized(false);
      setGifts([]);
      setDetail(null);
      setEditor(null);
    };
    const stop = onSnapshot(
      giftsRef(),
      { includeMetadataChanges: true },
      (s) => {
        setGifts(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Gift));
        setCached(s.metadata.fromCache);
        setPending(s.metadata.hasPendingWrites);
        if (!s.metadata.fromCache) {
          setAuthorized(true);
          setLoading(false);
          setError("");
        }
      },
      fail,
    );
    const stopProfiles = onSnapshot(
      doc(db, "settings", "profiles"),
      (s) => {
        if (s.exists()) {
          const data = s.data();
          setProfiles({ one: data.one, two: data.two });
          setProfileRevision(data.revision);
        }
      },
      fail,
    );
    return () => {
      stop();
      stopProfiles();
    };
  }, [user]);
  useEffect(() => {
    setDetail((current) =>
      current ? gifts.find((g) => g.id === current.id) || null : null,
    );
  }, [gifts]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      await login();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (
      settingsDirty &&
      !(await confirm("Uscire senza salvare le modifiche ai profili?"))
    )
      return;
    try {
      await signOut(auth!);
      setPage("wishlist");
    } catch (e) {
      setError(friendly(e));
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Copiato negli appunti");
    } catch {
      setError(
        "Copia non disponibile: seleziona e copia il link dal dettaglio.",
      );
    }
  }
  function share(g: Gift) {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText(g))}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  async function erase(g: Gift) {
    if (
      !(await confirm(
        `Eliminare “${g.name}”? Questa azione non si può annullare.`,
      ))
    )
      return;
    setBusy(true);
    try {
      await removeGift(g);
      setDetail(null);
      setToast("Desiderio eliminato");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const owned = gifts.filter((g) => g.owner === owner),
    visible = sorted(
      owned.filter(
        (g) =>
          g.name.toLocaleLowerCase("it").includes(q.toLocaleLowerCase("it")) &&
          (!store || g.store === store),
      ),
      sort,
    ),
    totals = owned.reduce<Record<string, number>>((a, g) => {
      if (g.price !== null) a[g.currency] = (a[g.currency] || 0) + g.price;
      return a;
    }, {});
  return (
    <>
      <header className="header">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            void navigate("wishlist");
          }}
        >
          <span className="brand-symbol">
            <GiftIcon size={24} strokeWidth={1.5} />
          </span>
          wishly<span className="brand-dot">.</span>
        </a>
        <span className="header-note">I piccoli desideri, insieme.</span>
        <div className="private">
          <LockKeyhole size={14} />
          <span>Solo per voi due</span>
        </div>
      </header>
      {!authorized ? (
        <main className="welcome">
          <div className="welcome-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="art-star">✧</span>
            <div className="gift-illustration">
              <div className="ribbon-loop loop-left" />
              <div className="ribbon-loop loop-right" />
              <div className="gift-lid" />
              <div className="gift-body" />
              <div className="gift-ribbon" />
              <Heart className="gift-heart" size={35} strokeWidth={1.5} />
            </div>
            <span className="art-caption">
              FATTO DI PICCOLE COSE, E DI VOI.
            </span>
          </div>
          <section className="welcome-copy">
            <p className="eyebrow">LA NOSTRA WISHLIST</p>
            <h1>
              Le cose che ami.
              <br />
              <em>Le persone che sai.</em>
            </h1>
            <p>
              Un posto tutto vostro per custodire i desideri.
              <br />
              Per fare un regalo, o lasciare un piccolo indizio.
            </p>
            {authLoading || loading ? (
              <p role="status" className="notice">
                {online
                  ? "Sto aprendo il vostro spazio…"
                  : "Sei offline. Riconnettiti per aprire il vostro spazio."}
              </p>
            ) : user ? (
              <div className="access-card">
                <h3>Un ultimo passo per entrare</h3>
                <p>
                  Il tuo account deve essere autorizzato nelle regole Firestore.
                  Copia l’UID e segui il README del progetto.
                </p>
                <code className="uid">{user.uid}</code>
                <button className="secondary" onClick={() => copy(user.uid)}>
                  <Copy size={16} /> Copia UID
                </button>
                <button className="text-button" onClick={logout}>
                  Esci dall’account
                </button>
              </div>
            ) : (
              <button
                disabled={!configured || busy}
                className="primary login"
                onClick={connect}
              >
                <span className="google-g">G</span>
                {busy ? "Accesso in corso…" : "Continua con Google"}
                <ArrowUpRight size={18} />
              </button>
            )}
            {!configured && (
              <p className="notice">
                Il vostro spazio è pronto da configurare. Collega il progetto
                Firebase seguendo il README per attivare accesso e
                sincronizzazione.
              </p>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="welcome-foot">
              <Heart size={15} /> Due wishlist. Mille buone idee.
            </div>
          </section>
        </main>
      ) : (
        <main className="app-main">
          {!online || cached ? (
            <div className="notice connection">
              <WifiOff size={17} />
              {!online
                ? "Sei offline. Puoi consultare i dati già caricati; salva quando torni online."
                : "Connessione al server in corso: i dati potrebbero non essere aggiornati."}
            </div>
          ) : (
            <div className="sync-status">
              <span />{" "}
              {pending ? "Sincronizzazione in corso…" : "Tutto sincronizzato"}
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button className="text-button" onClick={() => setError("")}>
                Chiudi
              </button>
            </div>
          )}
          {page === "wishlist" ? (
            <>
              <section className="page-title">
                <div>
                  <p className="eyebrow">UN PICCOLO SPAZIO, TUTTO NOSTRO</p>
                  <h1>
                    I nostri <em>desideri.</em>
                  </h1>
                  <p className="muted">
                    Ciao {user?.displayName?.split(" ")[0] || "a te"}, cosa ti
                    farebbe sorridere?
                  </p>
                </div>
                <button
                  className="primary desktop-add"
                  onClick={() => setEditor("new")}
                >
                  <Plus size={19} /> Aggiungi un desiderio
                </button>
              </section>
              <div
                className="profile-tabs"
                role="group"
                aria-label="Scegli wishlist"
              >
                {ids.map((id) => (
                  <button
                    key={id}
                    className={owner === id ? "selected" : ""}
                    onClick={() => {
                      setOwner(id);
                      setStore("");
                      setQ("");
                    }}
                  >
                    <Avatar profile={profiles[id]} />
                    <span>
                      {profiles[id].name}
                      <small>
                        {gifts.filter((g) => g.owner === id).length} desideri
                      </small>
                    </span>
                    {owner === id && <Heart size={17} />}
                  </button>
                ))}
              </div>
              <section className="collection-header">
                <div>
                  <h2>
                    Piccoli e grandi desideri <span>{owned.length}</span>
                  </h2>
                  <p className="muted">
                    {Object.entries(totals).length
                      ? `${Object.entries(totals)
                          .map(([c, n]) => money(n, c))
                          .join(" · ")} di desideri conosciuti`
                      : "Ogni bella sorpresa comincia qui."}
                    {owned.some((g) => g.price === null) &&
                      ` · ${owned.filter((g) => g.price === null).length} senza prezzo`}
                  </p>
                </div>
                <div className="collection-tools">
                  <div className="search">
                    <Search size={18} />
                    <input
                      aria-label="Cerca un desiderio"
                      placeholder="Cerca un desiderio…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <button
                    className="icon filter-button"
                    aria-label="Ordinamento e negozio"
                    aria-expanded={filters}
                    onClick={() => setFilters(!filters)}
                  >
                    <SlidersHorizontal size={20} />
                  </button>
                </div>
              </section>
              {filters && (
                <div className="filters">
                  <label>
                    Ordina per
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="priorityDesc">
                        Desiderio: dal più alto
                      </option>
                      <option value="priorityAsc">
                        Desiderio: dal più basso
                      </option>
                      <option value="priceAsc">Prezzo crescente</option>
                      <option value="priceDesc">Prezzo decrescente</option>
                      <option value="newest">Più recenti</option>
                      <option value="oldest">Meno recenti</option>
                    </select>
                  </label>
                  <label>
                    Negozio
                    <select
                      value={store}
                      onChange={(e) => setStore(e.target.value)}
                    >
                      <option value="">Tutti i negozi</option>
                      {[...new Set(owned.map((g) => g.store))]
                        .filter(Boolean)
                        .map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                    </select>
                  </label>
                </div>
              )}
              {!owned.length ? (
                <section className="empty">
                  <span className="empty-icon">
                    <GiftIcon size={44} strokeWidth={1.1} />
                    <Heart size={17} />
                  </span>
                  <p className="eyebrow">C’È SPAZIO PER UN SOGNO</p>
                  <h2>
                    Il primo desiderio
                    <br />
                    non si scorda mai.
                  </h2>
                  <p>
                    Quel libro, quel profumo, quella cosa che ami.
                    <br />
                    Tienila qui: chi ti conosce saprà dove cercare.
                  </p>
                  <button className="primary" onClick={() => setEditor("new")}>
                    <Plus size={18} /> Aggiungi il primo desiderio
                  </button>
                </section>
              ) : !visible.length ? (
                <section className="empty">
                  <Search size={32} />
                  <h2>Nessun desiderio trovato</h2>
                  <button
                    className="secondary"
                    onClick={() => {
                      setQ("");
                      setStore("");
                    }}
                  >
                    Azzera la ricerca
                  </button>
                </section>
              ) : (
                <div className="product-grid">
                  {visible.map((g) => (
                    <article className="product-card" key={g.id}>
                      <button
                        className="product-photo"
                        onClick={() => setDetail(g)}
                        aria-label={`Apri ${g.name}`}
                      >
                        <ProductImage src={g.image} name={g.name} />
                        <span className="desire-badge">
                          <Heart size={14} fill="currentColor" /> {g.priority}
                          <small>/10</small>
                        </span>
                      </button>
                      <div className="product-body">
                        <p className="store-label">
                          {g.store || "Un piccolo desiderio"}
                        </p>
                        <button
                          className="product-title"
                          onClick={() => setDetail(g)}
                        >
                          {g.name}
                        </button>
                        <p className={g.price === null ? "no-price" : "price"}>
                          {money(g.price, g.currency)}
                        </p>
                        <div className="card-actions">
                          <a
                            href={g.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Nel negozio <ArrowUpRight size={16} />
                          </a>
                          <button
                            className="icon"
                            aria-label={`Condividi ${g.name} su WhatsApp`}
                            onClick={() => share(g)}
                          >
                            <Share2 size={17} />
                          </button>
                          <button
                            className="icon"
                            aria-label={`Modifica ${g.name}`}
                            onClick={() => setEditor(g)}
                          >
                            <Pencil size={17} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <footer className="collection-footer">
                <Heart size={13} /> Il regalo più bello è conoscersi.
              </footer>
            </>
          ) : (
            <Preferences
              user={user!}
              gifts={gifts}
              profiles={profiles}
              revision={profileRevision}
              onLogout={logout}
              toast={setToast}
              onError={setError}
              onDirty={setSettingsDirty}
            />
          )}
        </main>
      )}
      {authorized && (
        <nav className="bottom-nav" aria-label="Navigazione principale">
          <button
            className={page === "wishlist" ? "active" : ""}
            onClick={() => void navigate("wishlist")}
          >
            <Heart size={21} /> Wishlist
          </button>
          <button className="add-nav" onClick={() => setEditor("new")}>
            <span>
              <Plus size={23} />
            </span>
            Aggiungi
          </button>
          <button
            className={page === "settings" ? "active" : ""}
            onClick={() => void navigate("settings")}
          >
            <Settings size={21} /> Impostazioni
          </button>
        </nav>
      )}
      {editor && (
        <GiftForm
          owner={owner}
          profiles={profiles}
          previous={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setDetail(null);
          }}
          toast={setToast}
        />
      )}
      {detail && !editor && (
        <Modal title="Un desiderio speciale" onClose={() => setDetail(null)}>
          <div className="detail-photo">
            <ProductImage src={detail.image} name={detail.name} />
          </div>
          <p className="eyebrow">
            {profiles[detail.owner].name} · {detail.store}
          </p>
          <h2 className="detail-title">{detail.name}</h2>
          <p className="price">{money(detail.price, detail.currency)}</p>
          {detail.price !== null && (
            <p className="muted tiny">
              Prezzo indicativo{" "}
              {detail.priceSource === "automatic" ? "rilevato" : "inserito"} il{" "}
              {new Date(detail.priceCheckedAt!).toLocaleDateString("it-IT")}.
              Verifica nel negozio.
            </p>
          )}
          <div className="detail-priority">
            <Heart size={21} /> Desiderio {detail.priority}/10{" "}
            <small>{desire(detail.priority)}</small>
          </div>
          {detail.notes && <p className="notes">{detail.notes}</p>}
          <a
            className="primary wide"
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Vai al prodotto <ArrowUpRight size={18} />
          </a>
          <div className="detail-actions">
            <button className="secondary" onClick={() => share(detail)}>
              <Share2 size={17} /> WhatsApp
            </button>
            <button className="secondary" onClick={() => copy(detail.url)}>
              <Copy size={17} /> Copia link
            </button>
            <button
              className="secondary"
              onClick={() =>
                setEditor(gifts.find((g) => g.id === detail.id) || detail)
              }
            >
              <Pencil size={17} /> Modifica
            </button>
            <button
              className="danger"
              disabled={busy || !online}
              onClick={() => erase(detail)}
            >
              <Trash2 size={17} /> Elimina
            </button>
          </div>
          <a
            className="product-url"
            href={detail.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {detail.url}
          </a>
        </Modal>
      )}
      {needRefresh && (
        <div className="update-banner">
          <p>Una nuova versione di Wishly è pronta.</p>
          <button
            onClick={async () => {
              if (
                !editor ||
                (await confirm(
                  "L’aggiornamento chiude il modulo. Hai salvato le modifiche?",
                ))
              )
                void updateServiceWorker(true);
            }}
          >
            Aggiorna
          </button>
          <button onClick={() => setNeedRefresh(false)}>Più tardi</button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
function Preferences({
  user,
  gifts,
  profiles,
  revision,
  onLogout,
  toast,
  onError,
  onDirty,
}: {
  user: User;
  gifts: Gift[];
  profiles: Profiles;
  revision: number;
  onLogout: () => void;
  toast: (s: string) => void;
  onError: (s: string) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const confirm = useConfirm();
  const [p, setP] = useState(profiles),
    [busy, setBusy] = useState(false);
  const initialRevision = useRef(revision);
  const [saved, setSaved] = useState(profiles);
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  useEffect(() => {
    onDirty(dirty);
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", warn);
    return () => {
      onDirty(false);
      removeEventListener("beforeunload", warn);
    };
  }, [dirty, onDirty]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveProfiles(p, initialRevision.current);
      initialRevision.current++;
      setSaved(p);
      toast("I vostri profili sono aggiornati");
    } catch (e) {
      onError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  function exportBackup() {
    const blob = new Blob(
        [
          JSON.stringify(
            { version: 1, exportedAt: new Date().toISOString(), gifts },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `wishly-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup esportato. Conservalo in un posto privato.");
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024)
        throw Error("Il file è troppo grande (massimo 4 MB).");
      const parsed = parseBackup(await file.text()),
        known = new Set(gifts.map((g) => g.id)),
        urls = new Set(gifts.map((g) => g.owner + "|" + g.url)),
        fresh = parsed.filter((g) => {
          const key = g.owner + "|" + g.url;
          if (known.has(g.id) || urls.has(key)) return false;
          urls.add(key);
          return true;
        });
      if (!fresh.length) {
        toast("Nessun nuovo desiderio: il backup è già presente.");
        return;
      }
      if (
        !(await confirm(
          `Importare ${fresh.length} desideri? I duplicati saranno ignorati e i dati esistenti non verranno sovrascritti.`,
        ))
      )
        return;
      setBusy(true);
      const n = await importGifts(fresh);
      toast(`${n} desideri importati`);
    } catch (e) {
      onError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="page-title">
        <div>
          <p className="eyebrow">IL VOSTRO PICCOLO MONDO</p>
          <h1>
            Su misura <em>per voi.</em>
          </h1>
          <p className="muted">
            Due nomi, due personalità. Un posto da condividere.
          </p>
        </div>
      </section>
      <div className="settings-grid">
        <form className="settings-card" onSubmit={save}>
          <fieldset disabled={busy}>
            <h2>Le nostre wishlist</h2>
            {ids.map((id) => (
              <div className="profile-editor" key={id}>
                <Avatar profile={p[id]} />
                <label>
                  Nome della wishlist
                  <input
                    required
                    maxLength={40}
                    value={p[id].name}
                    onChange={(e) =>
                      setP({ ...p, [id]: { ...p[id], name: e.target.value } })
                    }
                  />
                </label>
                <div className="form-row">
                  <label>
                    Iniziale
                    <input
                      required
                      maxLength={2}
                      value={p[id].initial}
                      onChange={(e) =>
                        setP({
                          ...p,
                          [id]: {
                            ...p[id],
                            initial: e.target.value.toUpperCase(),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    Colore
                    <input
                      type="color"
                      value={p[id].color}
                      onChange={(e) =>
                        setP({
                          ...p,
                          [id]: { ...p[id], color: e.target.value },
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
            <button className="primary" disabled={busy}>
              <Check size={17} /> {busy ? "Salvataggio…" : "Salva profili"}
            </button>
          </fieldset>
        </form>
        <div>
          <section className="settings-card">
            <h2>Il tuo account</h2>
            <p>{user.displayName}</p>
            <p className="muted break">{user.email}</p>
            <p className="tiny muted">
              Le wishlist sono accessibili soltanto ai due account autorizzati.
            </p>
            <button className="secondary" onClick={onLogout}>
              <LogOut size={17} /> Esci
            </button>
          </section>
          <section className="settings-card">
            <h2>I vostri desideri, al sicuro</h2>
            <p className="muted">
              Esporta una copia in JSON. L’importazione aggiunge solo desideri
              nuovi, senza sostituire quelli presenti.
            </p>
            <div className="detail-actions">
              <button
                disabled={busy}
                className="secondary"
                onClick={exportBackup}
              >
                <Download size={17} /> Esporta
              </button>
              <label className="secondary file-label">
                <Upload size={17} /> Importa
                <input
                  disabled={busy}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    void importBackup(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>
          <section className="settings-card">
            <h2>Wishly, sempre con te</h2>
            <details>
              <summary>
                Installa su iPhone <ChevronRight size={17} />
              </summary>
              <p>
                Apri Wishly in Safari. Tocca Condividi, poi “Aggiungi alla
                schermata Home” e “Aggiungi”. Se richiesto attiva “Apri come app
                web”. Accedi nuovamente dalla schermata Home, se necessario.
              </p>
            </details>
            <details>
              <summary>
                Installa su Android <ChevronRight size={17} />
              </summary>
              <p>
                Apri Wishly in Chrome. Nel menu ⋮ scegli “Aggiungi a schermata
                Home” o “Installa app”, quindi conferma.
              </p>
            </details>
            <details>
              <summary>
                Come funziona <ChevronRight size={17} />
              </summary>
              <p>
                Scegli una wishlist, tocca Aggiungi, incolla il link HTTPS del
                negozio e completa i dettagli. Dai un voto da 1 a 10 e salva.
                Con WhatsApp condividi solo il prodotto: la vostra wishlist
                resta privata.
              </p>
              <p>
                Il prezzo è indicativo. Se il recupero automatico non è
                disponibile, compila i campi manualmente. Le modifiche
                richiedono una connessione; i dati già aperti restano
                consultabili durante brevi interruzioni.
              </p>
            </details>
            <p className="tiny muted">Wishly 1.0 · Fatto per voi due.</p>
          </section>
        </div>
      </div>
    </>
  );
}
