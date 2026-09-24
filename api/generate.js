import { createHash, randomUUID } from 'node:crypto';

const MODES = {
  summary: { label: 'Riassunto', instruction: 'Crea un riassunto chiaro e fedele. Apri con un titolo, poi una sintesi e infine i concetti chiave.' },
  notes: { label: 'Appunti', instruction: 'Trasforma il testo in appunti ordinati per argomenti, con titoli brevi, elenchi e definizioni essenziali.' },
  mindmap: { label: 'Mappa mentale', instruction: 'Crea una mappa mentale testuale gerarchica. Parti dal tema centrale e usa rami e sotto-rami con elenchi annidati.' },
  flashcards: { label: 'Flashcard', instruction: 'Crea flashcard per ripassare. Per ciascuna usa esattamente le etichette “Domanda:” e “Risposta:”.' },
  meeting: { label: 'Verbale meeting', instruction: 'Crea un verbale con contesto, punti discussi, decisioni, attività, responsabili e scadenze. Non inventare dati mancanti: indica “non specificato”.' }
};
const DETAILS = {
  short: 'Sii molto conciso: conserva solo ciò che è indispensabile.',
  balanced: 'Usa un livello di dettaglio equilibrato e leggibile.',
  deep: 'Approfondisci passaggi, collegamenti e definizioni presenti nel testo.'
};

export function validateInput(body) {
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const mode = body?.mode;
  const detail = body?.detail;
  if (text.length < 40) throw Object.assign(new Error('Inserisci almeno 40 caratteri.'), { status: 400 });
  if (text.length > 60000) throw Object.assign(new Error('Il testo supera il limite di 60.000 caratteri.'), { status: 413 });
  if (!MODES[mode] || !DETAILS[detail]) throw Object.assign(new Error('Formato o livello di dettaglio non valido.'), { status: 400 });
  return { text, mode, detail };
}

export function buildMessages({ text, mode, detail }) {
  return [
    { role: 'system', content: `Sei Appunto, un assistente didattico esperto. Lavori su trascrizioni che possono contenere ripetizioni o errori. Scrivi nella stessa lingua del testo. Rimani fedele alla fonte, non aggiungere fatti e segnala con chiarezza ciò che è ambiguo. Produci Markdown semplice, senza blocchi di codice. ${MODES[mode].instruction} ${DETAILS[detail]}` },
    { role: 'user', content: `Elabora questa trascrizione:\n\n${text}` }
  ];
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100000) throw Object.assign(new Error('Richiesta troppo grande.'), { status: 413 });
  }
  try { return JSON.parse(raw || '{}'); }
  catch { throw Object.assign(new Error('Richiesta non valida.'), { status: 400 }); }
}

const localLimits = new Map();
async function isRateLimited(req) {
  const rawIp = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const id = createHash('sha256').update(`${process.env.RATE_LIMIT_SALT || 'local'}:${rawIp}`).digest('hex').slice(0, 24);
  const windowId = Math.floor(Date.now() / 3600000);
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    const key = `appunto:${windowId}:${id}`;
    const response = await fetch(`${redisUrl}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify([['INCR', key], ['EXPIRE', key, 3700]]) });
    if (response.ok) return Number((await response.json())?.[0]?.result || 0) > 15;
  }
  const key = `${windowId}:${id}`;
  const count = (localLimits.get(key) || 0) + 1;
  localLimits.set(key, count);
  if (localLimits.size > 1000) localLimits.clear();
  return count > 15;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status?.(405).json?.({ error: 'Metodo non consentito.' }) || (res.statusCode = 405, res.end(JSON.stringify({ error: 'Metodo non consentito.' })));
  try {
    if (await isRateLimited(req)) throw Object.assign(new Error('Hai raggiunto il limite temporaneo. Riprova tra poco.'), { status: 429 });
    const input = validateInput(await readJson(req));
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env[`OPENROUTER_MODEL_${input.mode.toUpperCase()}`] || process.env.OPENROUTER_MODEL;
    if (!apiKey || !model) throw Object.assign(new Error('Il servizio AI non è ancora configurato.'), { status: 503, public: true });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    let upstream;
    try {
      upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'https://appunto.vercel.app', 'X-OpenRouter-Title': 'Appunto' },
        body: JSON.stringify({ model, messages: buildMessages(input), temperature: 0.25, max_tokens: input.detail === 'deep' ? 2400 : 1400 })
      });
    } finally { clearTimeout(timeout); }
    if (!upstream.ok) {
      const providerId = upstream.headers.get('x-request-id');
      console.error('OpenRouter error', upstream.status, providerId || 'no-id');
      throw Object.assign(new Error(upstream.status === 429 ? 'Il servizio AI è molto richiesto. Riprova tra poco.' : 'Il servizio AI non è disponibile in questo momento.'), { status: upstream.status === 429 ? 429 : 502, public: true });
    }
    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw Object.assign(new Error('La risposta AI era vuota. Riprova.'), { status: 502, public: true });
    const payload = { content: content.trim(), format: MODES[input.mode].label, requestId: randomUUID() };
    if (res.status) return res.status(200).json(payload);
    res.statusCode = 200; res.end(JSON.stringify(payload));
  } catch (error) {
    const status = error?.name === 'AbortError' ? 504 : Number(error?.status) || 500;
    const message = status >= 500 && !error?.public ? 'Qualcosa non ha funzionato. Riprova tra poco.' : error.message;
    if (status >= 500) console.error('Generate error', error?.name || 'Error');
    if (res.status) return res.status(status).json({ error: message });
    res.statusCode = status; res.end(JSON.stringify({ error: message }));
  }
}

