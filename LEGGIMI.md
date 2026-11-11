# Brigata — configurazione del database (Supabase)

Brigata funziona anche senza database: in quel caso i dati restano solo sul telefono.
Per far lavorare tutta la brigata sugli stessi dati servono 10 minuti di configurazione, una volta sola.

## 1. Crea il progetto Supabase

1. Vai su supabase.com, accedi con GitHub e crea un nuovo progetto (piano gratuito, regione **Central EU (Frankfurt)**).
2. Scegli una password del database e salvala (all'app non serve, ma tienila).

## 2. Crea le tabelle

1. Nel progetto apri **SQL Editor** → **New query**.
2. Copia tutto il contenuto di `schema.sql`, incollalo e premi **Run**.
3. Deve comparire "Success". Il file si può rieseguire senza perdere dati (per esempio dopo un aggiornamento).

## 3. Imposta l'accesso con email

In **Authentication**:

- **Sign In / Providers → Email**: lascia attivo Email.
  - **Confirm email** attivo (consigliato): chi crea l'account riceve una mail e deve aprire il link prima di accedere.
  - Per fare prove veloci puoi disattivarlo e riattivarlo dopo.
- **URL Configuration → Site URL**: metti l'indirizzo dell'app, per esempio
  `https://marcocuccovillo-cpu.github.io/brigata/`. Il link della mail di conferma porta lì.

## 4. Collega l'app

1. In **Project Settings → API Keys** (oppure dal pulsante **Connect**) copia:
   - **Project URL** (tipo `https://abcd1234.supabase.co`)
   - la chiave **publishable** (`sb_publishable_…`) oppure la vecchia **anon**
2. Apri `config.js` e incolla i due valori:

```js
window.BRIGATA_CONFIG = {
  supabaseUrl: 'https://abcd1234.supabase.co',
  supabaseKey: 'sb_publishable_xxxxxxxx'
};
```

La chiave publishable/anon è fatta per stare nell'app: i dati sono protetti dalle regole del database.
**Non** usare mai la chiave secret / service_role.

## 5. Pubblica su GitHub Pages

Carica tutti i file nella repo, tutti nella stessa cartella (niente sottocartelle), e lascia attivo GitHub Pages. Il vecchio `index.html` va sostituito.
Quando aggiorni i file, cambia il numero di versione in cima a `sw.js` (`br32` → `br33`…) così i telefoni scaricano la versione nuova.

## Aggiornamenti

Quando una nuova versione cambia `schema.sql` (per esempio lo scanner dei codici a barre), rieseguilo nel SQL Editor: aggiorna le regole senza toccare i dati.

## 6. Primo utilizzo

1. Il titolare apre Brigata → **Staff** → **Crea account** → **Crea ristorante**.
   Con la spunta "Porta nel ristorante i dati già presenti" ricette, ingredienti, registri e magazzino vengono caricati online.
2. Da **Staff → Invita nella brigata** genera un codice e lo manda su WhatsApp.
3. Il cuoco apre Brigata → **Staff** → crea l'account → inserisce il codice.

## Ruoli

| | Titolare | Responsabile | Cuoco |
|---|---|---|---|
| Temperature, pulizie, lotti, scarti, magazzino, ordini, bacheca, prenotazioni | ✓ | ✓ | ✓ |
| Vedere ricette e allergeni | ✓ | ✓ | ✓ |
| Prezzi, food cost, margini | ✓ | ✓ | — |
| Modificare ricette, ingredienti, zone, unità, turni, dati del locale | ✓ | ✓ | — |
| Invitare cuochi | ✓ | ✓ | — |
| Invitare responsabili, cambiare ruoli, togliere persone | ✓ | — | — |

I permessi sono controllati dal database: anche manomettendo l'app un cuoco non può leggere i prezzi né modificare le temperature già registrate.

## Offline

Brigata salva tutto sul telefono e invia le modifiche appena c'è rete (il pallino in alto a destra mostra lo stato).
Se due persone modificano la stessa cosa, vale l'ultima modifica.

## Da sapere sul piano gratuito

- 500 MB di database: per un ristorante bastano per anni.
- Un progetto gratuito **va in pausa dopo 7 giorni senza attività**. Se il ristorante usa l'app ogni giorno non succede.
  Se succede (per esempio durante una chiusura lunga), riattivalo dalla dashboard di Supabase con **Resume project**: i dati restano.
  Nel frattempo l'app continua a funzionare offline e invia tutto alla riattivazione.
- Il piano Pro (25 $/mese) toglie la pausa e aggiunge i backup giornalieri.

## I file (tutti nella stessa cartella)

```
index.html      pagina dell'app
menu.html       menù pubblico con allergeni (si apre dal QR)
sw.js           funzionamento offline
manifest.json   installazione come app
app.css         grafica
config.js       indirizzo e chiave di Supabase
core.js         funzioni di base, permessi
cloud.js        account e sincronizzazione
cucina.js       ricette, ingredienti, menù/QR, scarti
haccp.js        temperature, lotti, pulizie
magazzino.js    frigoriferi, prodotti, ordini
bacheca.js      tavolate e note
turni.js        turni e chiusure
libro.js        prenotazioni
profilo.js      pagina iniziale
staff.js        account, brigata, inviti, registro attività
qr.js           generatore di QR
scanner.js      scanner dei codici a barre per il carico merce
app.js          navigazione e avvio
schema.sql      database (da eseguire in Supabase, non serve all'app)
icon-192.png, icon-512.png
```
