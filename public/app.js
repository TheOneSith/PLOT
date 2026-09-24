const $ = (selector) => document.querySelector(selector);
const els = { text: $('#transcript'), count: $('#word-count'), generate: $('#generate'), cancel: $('#cancel'), error: $('#error'), empty: $('#empty'), loading: $('#loading'), output: $('#output'), content: $('#result-content'), tag: $('#result-tag'), detail: $('#detail'), toast: $('#toast') };
let mode = 'summary';
let controller;
let lastResult = '';
const labels = { summary: 'RIASSUNTO', notes: 'APPUNTI', mindmap: 'MAPPA MENTALE', flashcards: 'FLASHCARD', meeting: 'VERBALE' };
const buttonLabels = { summary: 'Crea il mio riassunto', notes: 'Organizza i miei appunti', mindmap: 'Crea la mappa mentale', flashcards: 'Crea le flashcard', meeting: 'Crea il verbale' };
const exampleText = `Oggi parliamo della fotosintesi clorofilliana, il processo con cui le piante trasformano l’energia luminosa in energia chimica. Avviene soprattutto nelle foglie, all’interno dei cloroplasti. La clorofilla assorbe la luce solare. La pianta usa acqua, assorbita dalle radici, e anidride carbonica, che entra attraverso gli stomi. Il processo produce glucosio, usato come fonte di energia, e libera ossigeno nell’atmosfera. Possiamo distinguere una fase luminosa, che richiede direttamente la luce, e il ciclo di Calvin, che usa l’energia accumulata per fissare il carbonio. La fotosintesi sostiene quasi tutte le catene alimentari e contribuisce all’equilibrio dell’ossigeno atmosferico.`;

function updateCount() { const words = els.text.value.trim() ? els.text.value.trim().split(/\s+/).length : 0; els.count.textContent = `${words.toLocaleString('it-IT')} parole · ${els.text.value.length.toLocaleString('it-IT')} / 60.000`; }
function toast(message) { els.toast.textContent = message; els.toast.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.hidden = true, 2200); }
function setState(state) { els.empty.hidden = state !== 'empty'; els.loading.hidden = state !== 'loading'; els.output.hidden = state !== 'output'; els.generate.disabled = state === 'loading'; els.cancel.hidden = state !== 'loading'; }
function escapeHtml(value) { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function inline(value) { return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>'); }
function renderMarkdown(md) {
  const lines = md.replace(/\r/g, '').split('\n'); let html = '', inList = false;
  for (const raw of lines) { const line = raw.trim();
    if (/^[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    const heading = line.match(/^(#{1,3})\s+(.+)/); if (heading) html += `<h${heading[1].length + 1}>${inline(heading[2])}</h${heading[1].length + 1}>`; else if (line) html += `<p>${inline(line)}</p>`;
  }
  return html + (inList ? '</ul>' : '');
}
document.querySelectorAll('.format').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.format').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); mode = button.dataset.mode; els.generate.firstChild.textContent = `${buttonLabels[mode]} `; }));
els.text.addEventListener('input', updateCount);
$('#example').addEventListener('click', () => { els.text.value = exampleText; updateCount(); els.text.focus(); });
$('#file').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; if (file.size > 60000) return toast('Il file supera 60.000 caratteri.'); els.text.value = (await file.text()).slice(0, 60000); updateCount(); });
els.generate.addEventListener('click', async () => {
  els.error.hidden = true; if (els.text.value.trim().length < 40) { els.error.textContent = 'Incolla un testo di almeno 40 caratteri.'; els.error.hidden = false; els.text.focus(); return; }
  controller = new AbortController(); setState('loading'); els.tag.textContent = 'STIAMO PENSANDO';
  try { const response = await fetch('/api/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text: els.text.value, mode, detail: els.detail.value }), signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Richiesta non riuscita.'); lastResult = data.content; els.content.innerHTML = renderMarkdown(lastResult); els.tag.textContent = labels[mode]; setState('output'); if (innerWidth < 900) els.output.scrollIntoView({behavior:'smooth', block:'start'}); }
  catch (error) { if (error.name !== 'AbortError') { els.error.textContent = error.message; els.error.hidden = false; } els.tag.textContent = 'TUTTO PARTE DA TE'; setState('empty'); }
});
els.cancel.addEventListener('click', () => controller?.abort());
$('#copy').addEventListener('click', async () => { await navigator.clipboard.writeText(lastResult); toast('Copiato negli appunti!'); });
$('#share').addEventListener('click', async () => { if (navigator.share) { try { await navigator.share({ title: `Appunto · ${labels[mode]}`, text: lastResult }); } catch {} } else { await navigator.clipboard.writeText(lastResult); toast('Condivisione non disponibile: testo copiato.'); } });
$('#download').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([lastResult], {type:'text/plain;charset=utf-8'})); const link = Object.assign(document.createElement('a'), { href:url, download:`appunto-${mode}.txt` }); link.click(); URL.revokeObjectURL(url); });
const dialog = $('#info'); function showInfo(title, body) { $('#info-title').textContent = title; $('#info-body').textContent = body; dialog.showModal(); }
$('#help').addEventListener('click', () => showInfo('Come funziona', 'Incolla una trascrizione o importa un file .txt, scegli la forma che preferisci e premi Crea. Appunto invia il testo al modello AI configurato su OpenRouter e mostra il risultato pronto da copiare o condividere.'));
$('#privacy').addEventListener('click', () => showInfo('Privacy e dati', 'Il testo viene elaborato solo quando premi Crea. Questa applicazione non usa account, cookie di profilazione o un database e non conserva le trascrizioni. Il contenuto viene però inviato a OpenRouter e al fornitore del modello scelto: evita dati personali o sensibili.'));
$('#close-info').addEventListener('click', () => dialog.close()); dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
updateCount(); setState('empty');

