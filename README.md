# Wishly — La nostra wishlist

Un'app privata per due persone, progettata per smartphone. React + TypeScript + Vite, Tailwind CSS, Lucide, Firebase Authentication e Firestore. Non contiene prodotti dimostrativi e non usa localStorage come database.

**Il codice è completo, ma per usarlo devi collegare il tuo progetto Firebase e pubblicarlo.** Non sono stati creati account o servizi esterni a tuo nome. Senza configurazione, Wishly mostra la schermata iniziale con le istruzioni; non finge di salvare dati.

## Prima di iniziare

Ti servono un account Google per amministrare Firebase, i due account Google che useranno Wishly e un account GitHub. Per la pubblicazione gratuita su GitHub Pages, il repository deve essere **pubblico**: il codice e la pagina di accesso sono visibili, ma le wishlist sono protette dalle regole Firestore. Il link da solo non concede l'accesso ai dati.

Mantieni Firebase sul piano **Spark**, GitHub sul piano Free e, se lo desideri, Cloudflare Workers sul piano Free. Non attivare Blaze, fatturazione, Storage o servizi a pagamento. Le quote gratuite non sono illimitate: se le esaurisci il servizio può rifiutare operazioni; Wishly mostra un errore invece di dichiarare il salvataggio riuscito. Non c'è un servizio che garantisca disponibilità illimitata a costo zero.

Per lavorare sul computer: installa Node.js 22.18 o successivo (LTS) e un editor di testo. GitHub Desktop è un'alternativa semplice alla riga di comando per caricare i file. Java 21 serve solo se vuoi eseguire i test delle regole in locale.

## 1. Crea Firebase gratuito

1. Apri https://console.firebase.google.com/ e scegli **Aggiungi progetto**.
2. Assegna un nome, per esempio `wishly-coppia`.
3. Google Analytics non serve: puoi disattivarlo.
4. Verifica che il piano indicato sia **Spark**. Non associare una carta o un account di fatturazione.
5. In Impostazioni progetto → Generali, aggiungi un'app **Web**, icona `</>`. Nome: Wishly. Non occorre attivare Firebase Hosting.
6. Copia i valori `apiKey`, `authDomain`, `projectId`, `appId` della configurazione Web: serviranno al punto 6.

## 2. Attiva l'accesso Google

1. In Firebase apri Authentication → Inizia → Metodo di accesso.
2. Abilita **Google**, scegli l'email di assistenza richiesta e salva.
3. Non attivare accesso anonimo o registrazioni via password: questa app usa solo Google.

Autenticazione e autorizzazione sono diverse: un terzo account potrebbe autenticarsi con Google, ma le regole gli negheranno qualunque accesso alle wishlist.

## 3. Crea Firestore

1. Apri Firestore Database → Crea database.
2. Scegli il database predefinito `(default)` e l'edizione Standard, disponibile sul piano Spark.
3. Scegli una regione europea appropriata. La posizione è una decisione iniziale del progetto.
4. Seleziona **modalità produzione**, mai modalità test con accesso pubblico.
5. Non è necessario creare manualmente collezioni o documenti: saranno creati al primo salvataggio autorizzato.

## 4. Applica subito le regole di sicurezza

1. Apri il file `firestore.rules` del progetto e copia tutto il contenuto.
2. Incollalo in Firebase → Firestore → Regole e premi **Pubblica**.
3. Lascia per ora `REPLACE_UID_ONE` e `REPLACE_UID_TWO`: non corrispondono ai vostri account e quindi nessuno di voi può ancora leggere o scrivere.
4. Non inserire mai `allow read, write: if true`.

L'elenco autorizzato sta nelle regole, non in un documento modificabile dagli utenti. Le regole verificano anche campi ammessi, tipi, priorità, valuta e revisione. Tutte le altre collezioni sono negate.

## 5. Autorizza esattamente i due account

Questo passo si completa dopo la prima pubblicazione descritta sotto.

1. Apri Wishly e premi **Continua con Google** con il primo account.
2. Vedrai “Un ultimo passo per entrare”: copia l'UID con il pulsante dedicato. L'UID è disponibile anche nella console Firebase → Authentication → Utenti.
3. Ripeti sul secondo telefono con il secondo account.
4. Sostituisci i due segnaposto in `firestore.rules` con gli UID esatti, mantenendo apici e virgola. Non usare indirizzi email.
5. Incolla nuovamente le regole aggiornate nella console e pubblicale. Aggiorna anche il file nel repository per mantenerlo coerente.
6. Esci e rientra in Wishly, oppure ricarica la pagina: i listener ripartono con le nuove autorizzazioni.
7. Se configuri il Worker, usa gli stessi due UID anche lì.

Solo chi amministra il progetto Firebase deve poter cambiare le regole. Non distribuire credenziali amministrative. Gli UID e la configurazione Web non sono password: la protezione risiede nelle regole, non nella loro segretezza.

## 6. Configura e avvia l'app sul computer

Estrai lo ZIP. Apri il terminale nella cartella `wishly`, quella che contiene `package.json`.

```sh
npm ci
```

Copia `.env.example` in un nuovo file chiamato `.env` e compila:

```dotenv
VITE_FIREBASE_API_KEY=valore-apiKey
VITE_FIREBASE_AUTH_DOMAIN=il-tuo-progetto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=valore-projectId
VITE_FIREBASE_APP_ID=valore-appId
VITE_BASE_PATH=/wishly/
VITE_METADATA_WORKER_URL=
```

Questi sono i parametri **Web** Firebase, non una chiave privata di servizio. Non inserire password, token GitHub, JSON di service account o credenziali amministrative. Tutte le variabili `VITE_` vengono incluse nel JavaScript pubblico, anche se salvate come secret su GitHub.

```sh
npm run dev
```

Apri l'URL stampato nel terminale, includendo `/wishly/` se hai impostato quel percorso. Dopo ogni modifica a `.env`, riavvia il server. Per sviluppo locale aggiungi `localhost` tra i domini autorizzati Firebase. Se usi `127.0.0.1`, autorizza anche quello. Non aprire direttamente `index.html` con doppio clic.

## 7. Carica su GitHub

1. Crea su https://github.com/new un repository **pubblico**, per esempio `wishly`.
2. Carica il contenuto della cartella `wishly` nella radice del repository, non dentro un'ulteriore cartella `wishly`.
3. Includi `.github/workflows/deploy.yml`, `.gitignore` e `.env.example`; alcuni sistemi nascondono i file che iniziano con un punto.
4. Non caricare `.env`, `node_modules`, `worker/node_modules`, log o backup personali. `.gitignore` li esclude quando usi Git/GitHub Desktop.
5. Il branch previsto dal workflow è `main`.

Con Git, da una cartella nuova (sostituisci l'URL del tuo repository):

```sh
git init
git add .
git commit -m "Crea Wishly"
git branch -M main
git remote add origin https://github.com/TUO-UTENTE/wishly.git
git push -u origin main
```

## 8. Imposta Actions e Pages

1. Nel repository apri Settings → Secrets and variables → Actions → **Variables**.
2. Crea le quattro variabili Firebase del punto 6 con gli stessi nomi e valori.
3. Crea `VITE_BASE_PATH` con `/wishly/` se il repository si chiama `wishly`. Usa `/altro-nome/` se ha un altro nome. Per un repository `utente.github.io` usa `/`.
4. Lascia assente `VITE_METADATA_WORKER_URL` finché non configuri il Worker.
5. Apri Settings → Pages → Build and deployment → Source: **GitHub Actions**.
6. Apri Actions → “Pubblica Wishly su GitHub Pages” → Run workflow. Il workflow esegue i test, compila, genera la PWA e pubblica `dist`.
7. Al completamento, Settings → Pages mostra l'indirizzo, normalmente `https://TUO-UTENTE.github.io/wishly/`.
8. Se la prima esecuzione è partita prima di configurare le variabili, ripetila. Le variabili vengono lette durante la build: non basta cambiarle senza ricompilare.

Le schermate sono gestite dentro l'app senza percorsi server: ricaricare non richiede regole di rewrite. Vite e la PWA usano il percorso di base, anche sotto `/nome-repository/`.

## 9. Autorizza il dominio di accesso

In Firebase → Authentication → Impostazioni → Domini autorizzati, aggiungi `TUO-UTENTE.github.io` **senza** `https://` e senza `/wishly/`. Mantieni il dominio Firebase originale `progetto.firebaseapp.com`.

Il login usa `signInWithPopup` avviato direttamente dal tocco sul pulsante, una delle alternative ufficiali Firebase al redirect che può fallire con le restrizioni di archiviazione di terze parti. Non cambiare `authDomain` in `github.io`: GitHub Pages non ospita il gestore Firebase `/__/auth/handler`.

Apri Wishly in Safari o Chrome, non nel browser interno di WhatsApp/Instagram. Se compare “popup bloccato”, consenti il popup per il login e riprova. In modalità Home iOS la sessione può essere separata da Safari: accedi anche da lì. L'app conserva la sessione quando il browser permette la persistenza; se il browser la cancella, sarà necessario riaccedere.

## 10. Apri dai due telefoni

Apri lo stesso indirizzo sui due smartphone, accedi con i due account e completa il punto 5. Entrambi possono gestire entrambe le liste. Personalizza nomi, iniziali e colori da Impostazioni; la scelta della wishlist non identifica automaticamente l'account.

Aggiungi un prodotto nella prima lista, verifica che appaia sull'altro telefono, poi modificalo. Le scritture usano transazioni e revisioni: in caso di modifica concorrente il secondo salvataggio si ferma con un messaggio, mantenendo il modulo aperto. Copia le note, chiudi e riapri il regalo per lavorare sulla versione aggiornata.

## 11. Installa sulla schermata Home

- **iPhone:** apri in Safari → Condividi → Aggiungi alla schermata Home → Aggiungi. Se presente, attiva “Apri come app web”.
- **Android:** apri in Chrome → menu ⋮ → Installa app oppure Aggiungi a schermata Home → conferma.

Manifest, icone Android, icona Apple, colori e modalità standalone sono inclusi. La schermata di avvio è generata dal sistema da nome, icona e colori; iOS decide quali elementi visualizzare. Gli aggiornamenti mostrano un avviso: salva prima eventuali modifiche, poi premi Aggiorna.

La shell dell'app viene conservata dal service worker. I dati Firestore restano **solo nella memoria della sessione**, per evitare copie persistenti di wishlist private su dispositivi condivisi. Puoi consultarli durante un'interruzione con app già aperta; non è garantita la riapertura offline dopo chiusura completa. Le scritture offline sono rifiutate esplicitamente e il modulo rimane aperto. Le immagini remote possono non essere disponibili offline.

## 12. Recupero automatico opzionale con Cloudflare

Non è necessario per usare Wishly. Senza Worker, “Trova prodotto” mantiene il link, propone il dominio e invita a completare manualmente i campi.

Per attivarlo:

1. Crea un account Cloudflare sul piano Free, senza attivare Workers Paid o fatturazione.
2. Apri `worker/wrangler.toml`.
3. Imposta `FIREBASE_PROJECT_ID`, `ALLOWED_UIDS` (i due UID separati da virgola), `APP_ORIGIN` (es. `https://TUO-UTENTE.github.io`, senza percorso).
4. In `ALLOWED_HOSTS` mantieni solo gli host esatti dei negozi desiderati. `www.negozio.it` e `negozio.it` sono host distinti. Per Shopify aggiungi il dominio reale del negozio. Non aggiungere host arbitrari controllati da sconosciuti, domini locali o servizi di proxy.
5. Il namespace del rate limiter `1001` deve essere distinto da altri rate limiter del tuo account se non vuoi condividere i contatori.
6. Nel terminale:

```sh
cd worker
npm ci
npx wrangler login
npm run check
npm run deploy
```

7. Copia l'URL HTTPS `workers.dev` restituito da Cloudflare in `VITE_METADATA_WORKER_URL` (variabile GitHub e, se usata, `.env`). Non aggiungere token statici nel frontend.
8. Rilancia il workflow GitHub Actions.

Il Worker verifica la firma e la scadenza del token Firebase tramite le chiavi pubbliche Google, issuer, audience e i due UID. Controlla l'origine, limita circa 10 richieste/minuto per UID e posizione Cloudflare, accetta solo HTTPS su host esatti autorizzati, ricontrolla ogni redirect e limita timeout e dimensione delle risposte. Non restituisce pagine HTML e non funziona come proxy pubblico generico. Il rate limit Cloudflare è approssimativo e locale, non un contatore globale rigoroso.

Estrae Open Graph, JSON-LD Product/Offer e metadati prezzo. Non esegue JavaScript delle pagine, non supera CAPTCHA e non aggira blocchi. Amazon, Zalando, Sephora e altri possono bloccare il recupero, cambiare markup o offrire prezzi diversi per paese/taglia. I link brevi funzionano solo se tutti gli host di redirect sono esplicitamente ammessi: preferisci il link completo al prodotto.

Non viene indovinato un prezzo da stringhe ambigue o da “prezzi a partire da”. Le valute supportate sono EUR, CHF, USD e GBP. Ogni dato recuperato è modificabile. Se la lettura fallisce, continua manualmente. “Aggiorna dati prodotto” richiede conferma prima di sostituire i campi esistenti; mantiene quelli non recuperati.

## Backup e condivisione

Impostazioni → Esporta crea un JSON privato dei regali, con data, identificativi e prezzi. Conservalo fuori dal repository pubblico. Importa accetta formato Wishly v1, massimo 4 MB e 400 regali; verifica i dati, chiede conferma e salta duplicati per ID o coppia wishlist+URL. Non sovrascrive regali esistenti. Le preferenze dei profili non sono incluse nel backup.

WhatsApp prepara un messaggio con il link del **negozio**: scegli tu il destinatario e conferma l'invio in WhatsApp. L'app non invia messaggi autonomamente e non condivide accesso al database. “Copia link” copia solo il prodotto.

I totali sono separati per valuta: non vengono convertiti o sommati euro e franchi. I prezzi assenti non valgono zero e restano in fondo a entrambi gli ordinamenti per prezzo.

## Sviluppo e verifiche

```sh
npm test                    # Logica URL, prezzi, ordinamenti, messaggi e backup
npm run build               # TypeScript e build di produzione con PWA
npm run preview             # Serve dist per controllo locale
npm run test:rules          # Richiede Java; usa soltanto demo-wishly in emulatore
```

Per i test del Worker, dopo `npm ci` nella sua cartella:

```sh
npm run test:worker
npm run check --prefix worker
```

I test delle regole usano i due UID segnaposto del file consegnato. Se personalizzi le regole con i vostri UID, aggiorna anche i corrispondenti UID di test; non usare dati reali nell'emulatore. I test non modificano il progetto Firebase in produzione. `TEST-REPORT.md` distingue quanto verificato da ciò che richiede account e dispositivi reali.

## Struttura

- `src/App.tsx`: accesso, wishlist, schede, dettaglio, form e impostazioni.
- `src/Confirm.tsx`: conferme accessibili mediante dialog nativo, con stile Wishly.
- `src/firebase.ts`: login, listener e operazioni transazionali.
- `src/model.ts`: modello, validazione, prezzi, ordinamenti e backup.
- `src/metadata.ts`: client del Worker opzionale.
- `src/style.css`: sistema visivo responsive, aree sicure e movimento ridotto.
- `src/sw.ts`: cache degli asset e aggiornamento esplicito PWA.
- `public/`: icone originali.
- `firestore.rules`: autorizzazione e validazione lato database.
- `worker/`: servizio metadati separato, senza server permanente.
- `.github/workflows/deploy.yml`: build e pubblicazione Pages.

## Risoluzione rapida dei problemi

| Sintomo                        | Cosa controllare                                                         |
| ------------------------------ | ------------------------------------------------------------------------ |
| Pulsante Google non attivo     | Le quattro variabili Firebase sono presenti? Hai ricompilato?            |
| `auth/unauthorized-domain`     | Aggiungi l'host di Pages in Firebase Authentication, senza percorso.     |
| UID visibile ma accesso negato | Inserisci l'UID esatto nelle regole, pubblica e riaccedi.                |
| Schermata vuota o asset 404    | `VITE_BASE_PATH` deve corrispondere al repository con entrambe le barre. |
| Recupero prodotto fallito      | Compila manualmente; verifica dominio autorizzato e quota Worker.        |
| Salvataggio non riuscito       | Non chiudere il modulo. Controlla connessione, regole e quote Firestore. |
| Conflitto di modifica          | Conserva le note, chiudi e riapri il regalo aggiornato.                  |
| Vecchia versione dell'app      | Accetta l'avviso di aggiornamento dopo aver salvato.                     |

## Riferimenti ufficiali

Documentazione consultata l'8 novembre 2026; nomi dei menu e quote possono cambiare.

- Firebase Spark e prezzi: https://firebase.google.com/pricing
- Login Google: https://firebase.google.com/docs/auth/web/google-signin
- Alternative al redirect, opzione 2 popup: https://firebase.google.com/docs/auth/web/redirect-best-practices
- GitHub Pages e disponibilità nel piano Free: https://docs.github.com/en/pages/getting-started-with-github-pages
- Cloudflare Workers Free: https://developers.cloudflare.com/workers/platform/pricing/
- Rate limiter: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
