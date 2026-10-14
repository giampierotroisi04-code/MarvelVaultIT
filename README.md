# MARVEL ITALIA STREAMING — Mini App Telegram su Netlify

Catalogo stile Netflix (tema Marvel). I video restano nel tuo **canale privato**: il bot li copia nella chat dell'utente quando preme **▶ Guarda** (player nativo di Telegram, anche per file da 1,5 GB).
Tutto gira su Netlify (frontend + Functions + Blobs): nessun server da gestire, nessun database da installare.

## 1. Crea il bot
1. Su Telegram apri **@BotFather** → `/newbot` → scegli nome e username.
2. Copia il **token** e lo **username** (senza @).
3. Apri **@userinfobot** → ti mostra il tuo **user ID** numerico (sarà `ADMIN_IDS`).

## 2. Collega il canale privato
1. Apri il canale → Amministratori → **Aggiungi amministratore** → scegli il tuo bot.
2. Lascia i permessi di base (basta poter leggere i messaggi).
3. Carica i video nel canale. Per ottenere il link: tieni premuto il messaggio → **Copia link** (es. `https://t.me/c/1234567890/45`).

## 3. Pubblica su Netlify
1. Crea un repository su **GitHub** e carica tutti i file di questa cartella.
2. Su **netlify.com** → *Add new site → Import from Git* → scegli il repo. (Build command e publish directory sono già in `netlify.toml`.)
3. Prima del deploy (o dopo, poi *Trigger deploy*): *Site configuration → Environment variables* e inserisci quelle di `.env.example`:
   `BOT_TOKEN`, `BOT_USERNAME`, `ADMIN_IDS`, `WEBHOOK_SECRET` (solo lettere/numeri/`_`/`-`), `SITE_URL` (l'indirizzo del sito Netlify), opzionali `TMDB_API_KEY`, `PROTECT_CONTENT`, `MAX_SENDS_PER_MIN`.
4. Fai il deploy e attendi che finisca.

## 4. Attiva il bot (una sola volta)
Apri nel browser:
```
https://TUOSITO.netlify.app/api/setup?key=IL_TUO_WEBHOOK_SECRET
```
Se vedi `"ok":true` due volte, il bot è collegato e il bottone **Marvel Italia Streaming** compare nella chat.

## 5. Usa l'app
- Scrivi `/start` al bot e apri l'app. Premi **START** serve a ogni utente per ricevere i video.
- Scrivi `/admin` al bot (funziona solo per i tuoi `ADMIN_IDS`) oppure usa la tab **⚙️ Admin**.
- **Categorie** → crea categorie e sottocategorie (nome, emoji, copertina, riga in Home).
- **Contenuti → ＋ Aggiungi**: incolla il link del messaggio, premi **🔎 Verifica** (il bot ti manda il video in chat), compila titolo/immagine/categorie e salva.
- Serie: aggiungi stagioni ed episodi (titolo, descrizione, immagine, link) oppure usa **＋ Intervallo** incollando il link del primo e dell'ultimo episodio.

## Note
- **Sicurezza**: ogni richiesta valida `initData` di Telegram; gli endpoint `/api/admin/*` rispondono 403 a chi non è in `ADMIN_IDS`. Il canale non viene mai esposto agli utenti.
- **Dati e immagini** sono salvati in **Netlify Blobs** (incluso gratis, persistente).
- Il limite di invii al minuto è "best effort" (in memoria): serve a frenare gli abusi, non è a prova di attacco.
- Se **Guarda** non invia nulla: controlla che il bot sia admin del canale e che l'utente abbia premuto START.
- Sviluppo locale (facoltativo): `npm install` e `npx netlify dev`. Telegram richiede HTTPS, quindi per provare l'app è più semplice fare deploy su Netlify.
