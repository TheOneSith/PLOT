import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, buildMessages } from '../api/generate.js';

test('accetta un input valido e crea istruzioni coerenti', () => {
  const input = validateInput({ text: 'Una trascrizione sufficientemente lunga per essere elaborata correttamente.', mode: 'mindmap', detail: 'balanced' });
  const messages = buildMessages(input);
  assert.equal(input.mode, 'mindmap');
  assert.match(messages[0].content, /mappa mentale/i);
  assert.match(messages[1].content, /trascrizione/i);
});

test('rifiuta testo troppo corto e modalità sconosciute', () => {
  assert.throws(() => validateInput({ text: 'breve', mode: 'summary', detail: 'short' }), /40 caratteri/);
  assert.throws(() => validateInput({ text: 'x'.repeat(50), mode: 'inventata', detail: 'short' }), /non valido/);
});

