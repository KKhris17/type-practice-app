import { buildBurstHeatmap } from './burst-heatmap.ts';
import type { TypingEvent } from './types';

// Form text is immutable once used. A future revision must use new v2 IDs so
// historical benchmark results remain tied to the exact text that was typed.
export const BENCHMARK_FORMS = [
  {
    id: 'english-v1-a',
    title: 'A clear plan',
    text: 'Before the first meeting, Lena placed a small notebook beside the window. She read the plan once, then wrote a clear message for the team. The room was quiet, but the work still needed care. After a short break, she checked each page for missing details. A simple note helped everyone understand the next step. When the meeting ended, Lena put the notebook away and walked home at an easy pace. She felt ready to begin again the next day.',
  },
  {
    id: 'english-v1-b',
    title: 'The morning walk',
    text: 'Before the morning walk, Owen placed a small bottle beside the door. He checked his list, then wrote a clear note about the route. The street was quiet, but the long path still needed care. After a short rest, he looked at each sign for useful details. A simple map helped the group find the next turn. When the walk ended, Owen put the bottle away and sat down for a while. He felt ready to make another plan the next day.',
  },
  {
    id: 'english-v1-c',
    title: 'A shared table',
    text: 'Before the guests arrived, Mira placed a small bowl beside the plates. She read the recipe once, then wrote a clear list for the meal. The kitchen was quiet, but the final step still needed care. After a short break, she checked each dish for small details. A simple note helped everyone know where to sit. When the meal ended, Mira put the clean plates away and opened the window. She felt ready to plan another evening with her friends.',
  },
  {
    id: 'english-v1-d',
    title: 'The garden path',
    text: 'Before the work began, Eli placed a small basket beside the gate. He read the plan again, then wrote a clear note for his friend. The garden was quiet, but each narrow path still needed care. After a short break, he checked the beds for loose stones. A simple sketch helped them choose the next place to work. When the light faded, Eli put the basket away and closed the gate. He felt ready to return in the morning.',
  },
  {
    id: 'english-v1-e',
    title: 'A quiet workshop',
    text: 'Before the class started, Nora placed a small box beside the table. She read the guide once, then wrote a clear message on the board. The workshop was quiet, but each new task still needed care. After a short pause, she checked the tools for missing pieces. A simple drawing helped everyone see the next step. When the class ended, Nora put the box away and cleaned the table. She felt ready to teach the group again next week.',
  },
  {
    id: 'english-v1-f',
    title: 'The library note',
    text: 'Before the library closed, Sam placed a small book beside the desk. He read the last page, then wrote a clear note for the next reader. The hall was quiet, but the final search still needed care. After a short break, he checked each shelf for the missing title. A simple sign helped him find the right place. When the search ended, Sam put the book away and walked toward the door. He felt ready to visit again another day.',
  },
] as const;

export type BenchmarkForm = (typeof BENCHMARK_FORMS)[number];

export function getBenchmarkForm(id: string | null | undefined) {
  return BENCHMARK_FORMS.find((form) => form.id === id);
}

export function chooseBenchmarkForm(
  previousFormIds: Array<string | null | undefined>,
  excludedFormId?: string | null,
) {
  const counts = new Map(BENCHMARK_FORMS.map((form) => [form.id, 0]));
  for (const id of previousFormIds) {
    if (id && counts.has(id as BenchmarkForm['id'])) {
      counts.set(id as BenchmarkForm['id'], counts.get(id as BenchmarkForm['id'])! + 1);
    }
  }
  const lastFormId = previousFormIds[0];
  return [...BENCHMARK_FORMS]
    .filter((form) => form.id !== lastFormId && form.id !== excludedFormId)
    .sort((a, b) =>
      (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) ||
      a.id.localeCompare(b.id),
    )[0] ?? BENCHMARK_FORMS[0];
}

export type BenchmarkAttempt = {
  id: string;
  formId: string;
  baselineId: string | null;
  expectedText: string;
  finalText: string;
  events: TypingEvent[];
  wpm: number;
  accuracy: number;
};

export type SlowWordStat = {
  word: string;
  appearances: number;
  medianMsPerKey: number;
  relativePace: number;
  provisional: boolean;
};

export type BenchmarkComparison = {
  sessionId: string;
  baselineId: string;
  wpmDelta: number;
  accuracyDelta: number;
  matchedWords: number;
  fasterWords: number;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function cleanWordTimings(attempt: BenchmarkAttempt) {
  const heatmap = buildBurstHeatmap([{
    text: attempt.expectedText,
    finalText: attempt.finalText,
    events: attempt.events,
  }]);
  return heatmap.words.filter(
    (word) =>
      word.script === 'latin' &&
      /^[a-z]{3,20}$/iu.test(word.text) &&
      word.msPerKey !== null &&
      word.errors === 0 &&
      word.corrections === 0,
  ) as Array<(typeof heatmap.words)[number] & { msPerKey: number }>;
}

export function analyzeBenchmarkAttempts(attempts: BenchmarkAttempt[]) {
  const timingByWord = new Map<string, { times: number[]; ratios: number[] }>();
  const timingByAttempt = new Map<string, Map<string, number>>();
  const slowWordsByAttempt = new Map<string, Set<string>>();

  for (const attempt of attempts) {
    const words = cleanWordTimings(attempt);
    const sessionMedian = median(words.map((word) => word.msPerKey));
    const ownWords = new Map<string, number[]>();
    for (const word of words) {
      const key = word.text.toLocaleLowerCase('en');
      const item = timingByWord.get(key) ?? { times: [], ratios: [] };
      item.times.push(word.msPerKey);
      if (sessionMedian > 0) item.ratios.push(word.msPerKey / sessionMedian);
      timingByWord.set(key, item);
      ownWords.set(key, [...(ownWords.get(key) ?? []), word.msPerKey]);
    }
    timingByAttempt.set(
      attempt.id,
      new Map([...ownWords].map(([word, times]) => [word, median(times)])),
    );
    slowWordsByAttempt.set(
      attempt.id,
      new Set(
        [...ownWords]
          .filter(([, times]) => sessionMedian > 0 && median(times) / sessionMedian >= 1.15)
          .map(([word]) => word),
      ),
    );
  }

  const slowWords: SlowWordStat[] = [...timingByWord]
    .map(([word, item]) => ({
      word,
      appearances: item.times.length,
      medianMsPerKey: Math.round(median(item.times)),
      relativePace: Number(median(item.ratios).toFixed(2)),
      provisional: item.times.length < 2,
    }))
    .filter((item) => item.relativePace >= 1.15)
    .sort(
      (a, b) =>
        Number(a.provisional) - Number(b.provisional) ||
        b.relativePace - a.relativePace ||
        b.appearances - a.appearances,
    )
    .slice(0, 15);

  const byId = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const comparisons: BenchmarkComparison[] = attempts.flatMap((attempt) => {
    const baseline = attempt.baselineId
      ? byId.get(attempt.baselineId)
      : undefined;
    if (!baseline) return [];
    const before = timingByAttempt.get(baseline.id) ?? new Map();
    const after = timingByAttempt.get(attempt.id) ?? new Map();
    const baselineSlowWords = slowWordsByAttempt.get(baseline.id) ?? new Set();
    const shared = [...before].filter(
      ([word]) => baselineSlowWords.has(word) && after.has(word),
    );
    return [{
      sessionId: attempt.id,
      baselineId: baseline.id,
      wpmDelta: attempt.wpm - baseline.wpm,
      accuracyDelta: attempt.accuracy - baseline.accuracy,
      matchedWords: shared.length,
      fasterWords: shared.filter(([word, time]) => after.get(word)! < time).length,
    }];
  });

  return { slowWords, comparisons };
}

export function buildSpeedDrillText(words: string[]) {
  const targets = [...new Set(words.map((word) => word.toLowerCase()))]
    .filter((word) => /^[a-z]{3,20}$/u.test(word))
    .slice(0, 5);
  if (!targets.length) return '';
  const bridges = ['and', 'then', 'before', 'after', 'again'];
  return Array.from({ length: 18 }, (_, round) => {
    const first = targets[round % targets.length];
    const second = targets[(round + 1 + Math.floor(round / targets.length)) % targets.length];
    return [first, bridges[round % bridges.length], second, first].join(' ');
  }).join(' ');
}
