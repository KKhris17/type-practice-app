import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBurstHeatmap } from '../shared/burst-heatmap.ts';

function insert(text, position, atMs, correct = true) {
  return {
    action: 'insert',
    key: text[position],
    expected: text[position],
    position,
    correct,
    atMs,
    latencyMs: 0,
  };
}

test('marks a slower repeated word by occurrence', () => {
  const text = 'cat dog cat';
  const positions = [0, 1, 2, 4, 5, 6, 8, 9, 10];
  const times = [0, 100, 200, 400, 500, 600, 900, 1000, 1400];
  const events = positions.map((position, index) =>
    insert(text, position, times[index]),
  );
  const result = buildBurstHeatmap([{ text, finalText: text, events }]);

  assert.equal(result.words.length, 3);
  assert.equal(result.words[0].text, result.words[2].text);
  assert.equal(result.words[0].tone, 'typical');
  assert.equal(result.words[2].tone, 'slow');
});

test('excludes the pause before the first key of a word', () => {
  const text = 'cat dog';
  const events = [
    insert(text, 0, 0),
    insert(text, 1, 100),
    insert(text, 2, 200),
    insert(text, 4, 10_000),
    insert(text, 5, 10_100),
    insert(text, 6, 10_200),
  ];
  const result = buildBurstHeatmap([{ text, finalText: text, events }]);

  assert.equal(result.words[0].durationMs, 200);
  assert.equal(result.words[1].durationMs, 200);
  assert.equal(result.words[1].msPerKey, 100);
});

test('includes correction time and excludes unfinished words', () => {
  const text = 'cat dog';
  const events = [
    insert(text, 0, 0, false),
    {
      action: 'backspace', key: 'x', expected: 'c', position: 0,
      correct: false, atMs: 200, latencyMs: 200,
    },
    insert(text, 0, 300),
    insert(text, 1, 400),
    insert(text, 2, 600),
    insert(text, 4, 700),
  ];
  const result = buildBurstHeatmap([{ text, finalText: 'cat d', events }]);

  assert.equal(result.words[0].durationMs, 600);
  assert.equal(result.words[0].errors, 1);
  assert.equal(result.words[0].corrections, 1);
  assert.equal(result.words[1].durationMs, null);
});

test('keeps lesson rounds separate when positions restart from zero', () => {
  const first = 'cat';
  const second = 'dog';
  const result = buildBurstHeatmap([
    { text: first, finalText: first, events: [0, 1, 2].map((position) => insert(first, position, position * 100)) },
    { text: second, finalText: second, events: [0, 1, 2].map((position) => insert(second, position, 500 + position * 200)) },
  ]);

  assert.deepEqual(result.words.map((word) => word.durationMs), [200, 400]);
  assert.equal(result.segments.length, 2);
});

test('compares Thai and Latin words against separate baselines', () => {
  const text = 'แมว หมา code';
  const positions = [0, 1, 2, 4, 5, 6, 8, 9, 10, 11];
  const times = [0, 100, 200, 400, 800, 1200, 1300, 1400, 1500, 1600];
  const events = positions.map((position, index) =>
    insert(text, position, times[index]),
  );
  const result = buildBurstHeatmap([{ text, finalText: text, events }]);

  assert.deepEqual(result.words.map((word) => word.script), [
    'thai', 'thai', 'latin',
  ]);
  assert.equal(result.words[0].tone, 'fast');
  assert.equal(result.words[1].tone, 'slow');
  assert.equal(result.words[2].tone, 'unmeasured');
});
