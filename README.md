# Appunto

Appunto trasforma la trascrizione di una lezione o di un incontro in un riassunto, appunti ordinati, una mappa mentale, flashcard o un verbale. È una web app mobile-first installabile sul telefono e pronta per Vercel.

## Configurazione OpenRouter

In Vercel, apri **Project settings → Environment Variables** e aggiungi:

- `OPENROUTER_API_KEY`: la chiave privata di OpenRouter;
- `OPENROUTER_MODEL`: lo slug del modello scelto, per esempio `openai/gpt-4.1-mini`;
- `APP_URL`: l'indirizzo pubblico dell'app, facoltativo ma consigliato.

Puoi scegliere un modello diverso per ogni formato usando `OPENROUTER_MODEL_SUMMARY`, `OPENROUTER_MODEL_NOTES`, `OPENROUTER_MODEL_MINDMAP`, `OPENROUTER_MODEL_FLASHCARDS` e `OPENROUTER_MODEL_MEETING`. La chiave non deve mai essere inserita nel codice o in GitHub.

Per un'app pubblica configura anche un database Redis REST di Upstash tramite l'integrazione Vercel e aggiungi `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` e un valore casuale in `RATE_LIMIT_SALT`. Questo rende effettivo il limite di 15 generazioni l'ora per visitatore anche su più istanze Vercel.

## Avvio e verifica

Richiede Node.js 22 o successivo, senza dipendenze npm.

```sh
copy .env.example .env.local
npm run dev
npm test
npm run build
```

Apri `http://localhost:3000`. Senza le variabili OpenRouter l'interfaccia funziona, mentre la generazione mostra un messaggio di configurazione.

## Deploy su Vercel

Importa il repository GitHub in Vercel, scegli **Other** come Framework Preset e lascia vuoti Build Command e Output Directory. Vercel pubblica automaticamente la cartella `public` e distribuisce `api/generate.js` come funzione serverless. Aggiungi le variabili d'ambiente indicate sopra e avvia il deploy. Per installarla sul telefono, apri il sito nel browser e scegli **Aggiungi alla schermata Home**.

## Privacy

L'app non include account, analytics o database e non conserva le trascrizioni. Il testo inviato viene elaborato da OpenRouter e dal fornitore del modello configurato. Prima di pubblicare il servizio, verifica i criteri di conservazione del modello scelto e informa gli utenti di non inserire dati personali o sensibili.

