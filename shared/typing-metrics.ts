import type {
  SessionLanguageMetrics,
  TypingEvent,
  TypingLanguage,
} from './types';

function directTypingLanguage(value: string): TypingLanguage | undefined {
  if (/\p{Script=Thai}/u.test(value)) return 'thai';
  if (/\p{Script=Latin}/u.test(value)) return 'english';
  return undefined;
}

function classifyEventLanguages(events: TypingEvent[]) {
  const direct = events.map((event) => directTypingLanguage(event.expected));
  const previous: Array<TypingLanguage | undefined> = [];
  const next: Array<TypingLanguage | undefined> = [];
  let nearest: TypingLanguage | undefined;

  for (let index = 0; index < events.length; index += 1) {
    if (direct[index]) nearest = direct[index];
    previous[index] = nearest;
  }

  nearest = undefined;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (direct[index]) nearest = direct[index];
    next[index] = nearest;
  }

  return events.map(
    (_, index) => direct[index] ?? previous[index] ?? next[index],
  );
}

export function isCrossLanguageError(event: TypingEvent) {
  if (event.action !== 'insert' || event.correct) return false;
  const expectedLanguage = directTypingLanguage(event.expected);
  const enteredLanguage = directTypingLanguage(event.key);
  return Boolean(
    expectedLanguage && enteredLanguage && expectedLanguage !== enteredLanguage,
  );
}

export function computeSessionLanguageMetrics(
  events: TypingEvent[],
): SessionLanguageMetrics {
  const eventLanguages = classifyEventLanguages(events);
  const aggregates: Record<
    TypingLanguage,
    { insertions: number; correctInsertions: number; durationMs: number }
  > = {
    thai: { insertions: 0, correctInsertions: 0, durationMs: 0 },
    english: { insertions: 0, correctInsertions: 0, durationMs: 0 },
  };

  events.forEach((event, index) => {
    const language = eventLanguages[index];
    if (!language || isCrossLanguageError(event)) return;
    aggregates[language].durationMs += Math.max(0, event.latencyMs);
    if (event.action !== 'insert') return;
    aggregates[language].insertions += 1;
    if (event.correct) aggregates[language].correctInsertions += 1;
  });

  return Object.fromEntries(
    (['thai', 'english'] as const).map((language) => {
      const aggregate = aggregates[language];
      if (aggregate.insertions === 0) return [language, null];
      const durationMs = Math.max(1_000, aggregate.durationMs);
      return [
        language,
        {
          wpm: Math.max(
            0,
            Math.round(aggregate.correctInsertions / 5 / (durationMs / 60_000)),
          ),
          accuracy: Math.floor(
            (aggregate.correctInsertions / aggregate.insertions) * 100,
          ),
          typedCharacters: aggregate.insertions,
          correctCharacters: aggregate.correctInsertions,
          durationMs,
        },
      ];
    }),
  ) as SessionLanguageMetrics;
}
