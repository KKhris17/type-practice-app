import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseTypePracticeMarkdown } from '../backend/markdown.ts';

test('bundled sample imports with evidence from this project', () => {
  const markdown = readFileSync(
    new URL('../public/type-practice.sample.md', import.meta.url),
    'utf8',
  );
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const source = parseTypePracticeMarkdown(markdown);

  assert.equal(source.sourceTitle, 'Type Practice README');
  assert.equal(source.passages.length, 1);
  assert.ok(source.passages[0].wordCount >= 50);
  assert.ok(source.passages[0].wordCount <= 100);
  assert.ok(source.passages[0].evidence.length > 0);
  for (const evidence of source.passages[0].evidence) {
    assert.ok(readme.includes(evidence.excerpt));
  }
});
