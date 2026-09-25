import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BENCHMARK_FORMS,
  analyzeBenchmarkAttempts,
  buildSpeedDrillText,
  chooseBenchmarkForm,
} from '../shared/benchmark.ts';

function attempt(id, text, slowWord, slowInterval, baselineId = null) {
  let atMs = 0;
  const events = [...text].map((key, position) => {
    const wordStart = text.lastIndexOf(' ', position - 1) + 1;
    const wordEnd = text.indexOf(' ', position);
    const word = text.slice(wordStart, wordEnd < 0 ? text.length : wordEnd);
    atMs += word === slowWord && position > wordStart ? slowInterval : 100;
    return {
      action: 'insert', key, expected: key, position, correct: true,
      atMs, latencyMs: 100,
    };
  });
  return {
    id, formId: id, baselineId, expectedText: text, finalText: text,
    events, wpm: id === 'after' ? 31 : 27, accuracy: 99,
  };
}

test('bundles distinct benchmark forms of comparable length', () => {
  const counts = BENCHMARK_FORMS.map((form) => form.text.trim().split(/\s+/u).length);
  assert.equal(new Set(BENCHMARK_FORMS.map((form) => form.text)).size, BENCHMARK_FORMS.length);
  assert.ok(BENCHMARK_FORMS.length >= 4);
  assert.ok(counts.every((count) => count >= 50 && count <= 100));
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 5);
});

test('re-benchmark rotates away from the baseline form', () => {
  const first = chooseBenchmarkForm([]);
  const next = chooseBenchmarkForm([first.id], first.id);
  assert.notEqual(first.id, next.id);
});

test('ranks recurring clean slow words and compares baseline slow words only', () => {
  const before = attempt('before', 'before clear after', 'before', 400);
  const after = attempt('after', 'clear before after', 'before', 200, 'before');
  const analysis = analyzeBenchmarkAttempts([after, before]);
  const slow = analysis.slowWords.find((item) => item.word === 'before');

  assert.equal(slow?.appearances, 2);
  assert.equal(slow?.provisional, false);
  assert.equal(analysis.comparisons[0].wpmDelta, 4);
  assert.equal(analysis.comparisons[0].accuracyDelta, 0);
  assert.equal(analysis.comparisons[0].matchedWords, 1);
  assert.equal(analysis.comparisons[0].fasterWords, 1);
});

test('speed drill repeats actual selected words in varied order', () => {
  const text = buildSpeedDrillText(['before', 'clear']);
  assert.ok(text.split(/\s+/u).length >= 50);
  assert.ok(text.includes('before'));
  assert.ok(text.includes('clear'));
  assert.notEqual(buildSpeedDrillText(['before']), text);
});
