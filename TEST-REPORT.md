# Verifiche Wishly

Data: 8 novembre 2026. Nessun account Firebase, repository GitHub o Worker di produzione è stato creato o configurato per l'utente.

## Risultati eseguiti

- **Build produzione:** TypeScript e Vite completati, inclusa generazione service worker e precache. Percorso di prova `/wishly/`. Icone, manifest e riferimenti agli asset sono stati controllati nell'output compilato.
- **9 test di logica:** tutti superati. URL pericolosi/rappresentazioni locali, prezzi assenti, priorità, ordinamenti, testo WhatsApp, backup valido e non valido, separazione tra dati modificabili e identificativi.
- **4 test Firestore in emulatore:** tutti superati. Nega letture e scritture a utenti anonimi e terzo UID, blocca autoautorizzazione, consente i due UID, rifiuta campi/dati non ammessi e revisioni obsolete, convalida profili. Un listener di un secondo client riceve una modifica effettuata dal primo; viene rilevata una revisione concorrente.
- **3 test Worker:** tutti superati. Host esatti e HTTPS, rifiuto di destinazioni non autorizzate, estrazione di Product da strutture JSON-LD, rifiuto di richieste da origini estranee o senza token.
- **TypeScript Worker:** controllo completato senza errori. Packaging `wrangler deploy --dry-run` riuscito con rate limiter riconosciuto; nessun deploy reale effettuato.

Il test delle revisioni dimostra il rilevamento del conflitto e le regole impediscono aggiornamenti con revisioni obsolete; non sostituisce una prova manuale con due moduli aperti su telefoni reali.

## Criteri del brief

| Scenario              | Stato e limite                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| A — Aggiunta prodotto | Implementata con transazione; validazione testata. Flusso completo UI con account Google da provare.                                    |
| B — Sincronizzazione  | Listener tra due client verificato su emulatore; da verificare sui due smartphone reali.                                                |
| C — Privacy           | Regole testate su emulatore contro accessi anonimi e terzo UID. Occorre pubblicarle sul progetto reale senza modificarne le protezioni. |
| D — WhatsApp          | Testo e link prodotto verificati; apertura/invio in WhatsApp sul telefono da provare. Nessun messaggio è stato inviato.                 |
| E — Prezzo mancante   | Validazione e ordinamenti testati; form e fallback implementati. Estrazione live da negozi non testata.                                 |
| F — Ordinamento       | Test superati per priorità uguali e prezzi mancanti, crescenti e decrescenti.                                                           |
| G — Persistenza       | Archivio Firestore e persistenza sessione collegati nel codice. Chiusura/riapertura su progetto reale da verificare.                    |
| H — Pubblicazione     | Build sotto `/wishly/` riuscita; workflow incluso. Non è avvenuta una pubblicazione GitHub Pages.                                       |
| I — Mobile            | CSS responsive, safe area, tastiere e PWA implementati. Safari iPhone, Chrome Android e login standalone non testati.                   |

## Limiti dell'ambiente

Il server Vite locale si avvia, ma il browser remoto non raggiunge la porta locale (`ERR_CONNECTION_REFUSED`). Non è quindi stata completata una verifica visiva nel browser e non sono allegate schermate presentate come collaudo. Non sono stati usati dati fittizi nella wishlist reale.

Firebase non è configurato: la build consegnata presenta intenzionalmente la schermata iniziale di configurazione. L'intero sorgente delle funzionalità è incluso e viene attivato dalla configurazione Web Firebase.

Il bundle Firebase produce un avviso Vite per la dimensione del chunk (circa 671 KB non compressi, circa 168 KB gzip). Non è un errore di build. L'app e Firebase sono separati in chunk e gli asset statici vengono precaricati dalla PWA.

## Checklist dopo l'attivazione

1. Applicare le regole con i due UID, entrare dai due telefoni e verificare che un terzo account veda solo il proprio UID, non i dati.
2. Aggiungere un URL reale, senza prezzo, con priorità 9: salvare e controllare la lista corretta sull'altro telefono.
3. Aprire lo stesso regalo su entrambi i dispositivi, salvare da uno, poi dall'altro: il secondo deve ricevere il messaggio di conflitto.
4. Chiudere e riaprire l'app con rete attiva; i desideri devono restare.
5. Provare WhatsApp e Copia link: il destinatario deve ricevere soltanto il negozio.
6. Esportare, eliminare un regalo di prova con conferma e reimportare; un secondo import non deve duplicarlo.
7. Installare da Safari e Chrome, accedere dalla Home e verificare un aggiornamento dell'app.
8. Facoltativamente configurare il Worker e provare un negozio consentito, un host non consentito e un sito che blocca l'estrazione.

Non considerare superati questi controlli reali finché non sono stati eseguiti sui dispositivi e account di destinazione.
