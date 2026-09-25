import type { TypingEvent } from './types';

export type BurstInputSegment = {
  text: string;
  finalText: string;
  events: TypingEvent[];
};

export type BurstWord = {
  text: string;
  script: 'thai' | 'latin' | 'other';
  durationMs: number | null;
  msPerKey: number | null;
  errors: number;
  corrections: number;
  tone: 'slow' | 'lagging' | 'typical' | 'fast' | 'unmeasured';
};

export type BurstHeatmap = {
  segments: Array<Array<{ text: string; wordIndex: number | null }>>;
  words: BurstWord[];
};

function median(values: number[]): number | null {
  if (values.length < 2) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

// A burst starts with the first key of a word. The gap before that key is
// deliberately excluded so a pause between words does not make a word red.
export function buildBurstHeatmap(inputs: BurstInputSegment[]): BurstHeatmap {
  const words: BurstWord[] = [];
  const segments = inputs.map(({ text, finalText, events }) => {
    const locale = /[\u0e00-\u0e7f]/u.test(text) ? 'th' : 'en';
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    return Array.from(segmenter.segment(text), (part) => {
      if (!part.isWordLike) return { text: part.segment, wordIndex: null };

      const start = part.index;
      const end = start + part.segment.length;
      const wordEvents = events.filter(
        (event) => event.position >= start && event.position < end,
      );
      const inserts = wordEvents.filter((event) => event.action === 'insert');
      const completed = finalText.slice(start, end) === part.segment;
      const firstAt = wordEvents[0]?.atMs;
      const lastAt = wordEvents[wordEvents.length - 1]?.atMs;
      const durationMs =
        completed && inserts.length >= 2 && lastAt > firstAt
          ? lastAt - firstAt
          : null;
      const keyIntervals = Math.max(1, Array.from(part.segment).length - 1);
      const script = /[\u0e00-\u0e7f]/u.test(part.segment)
        ? 'thai'
        : /[a-z]/iu.test(part.segment)
          ? 'latin'
          : 'other';
      const wordIndex = words.length;
      words.push({
        text: part.segment,
        script,
        durationMs,
        msPerKey: durationMs === null ? null : durationMs / keyIntervals,
        errors: inserts.filter((event) => !event.correct).length,
        corrections: wordEvents.filter((event) => event.action !== 'insert')
          .length,
        tone: 'unmeasured',
      });
      return { text: part.segment, wordIndex };
    });
  });

  const medians = Object.fromEntries(
    (['thai', 'latin', 'other'] as const).map((script) => [
      script,
      median(
        words.flatMap((word) =>
          word.script === script && word.msPerKey !== null
            ? [word.msPerKey]
            : [],
        ),
      ),
    ]),
  ) as Record<BurstWord['script'], number | null>;
  for (const word of words) {
    const baseline = medians[word.script];
    if (word.msPerKey === null || baseline === null) continue;
    const ratio = word.msPerKey / baseline;
    word.tone =
      ratio >= 1.6
        ? 'slow'
        : ratio >= 1.2
          ? 'lagging'
          : ratio <= 0.8
            ? 'fast'
            : 'typical';
  }

  return { segments, words };
}
