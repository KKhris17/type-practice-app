import type { Session } from '@/database/schema';
import type {
  Analytics,
  DailyStat,
  OneHandDrill,
  OneHandSide,
  ProgressMetrics,
  TypingLanguage,
  TypingEvent,
  WeaknessDrill,
  WeaknessStat,
} from '@/shared/types';
import {
  computeSessionLanguageMetrics,
  isCrossLanguageError,
} from '@/shared/typing-metrics';

type KeyAggregate = {
  exposures: number;
  errors: number;
  weightedExposures: number;
  weightedErrors: number;
  latencyTotal: number;
  confusion: Map<string, number>;
};

type LanguageMetricSample = {
  completedAt: Date;
  wpm: number;
  accuracy: number;
};

function languageSamplesForSession(session: Session, events: TypingEvent[]) {
  const metrics = computeSessionLanguageMetrics(events);

  return (['thai', 'english'] as const).flatMap((language) => {
    const metric = metrics[language];
    if (!metric) return [];
    return [
      {
        language,
        sample: {
          completedAt: session.completedAt,
          wpm: metric.wpm,
          accuracy: metric.accuracy,
        } satisfies LanguageMetricSample,
      },
    ];
  });
}

function buildProgressMetrics(
  samples: LanguageMetricSample[],
  now: Date,
  timeZone: string,
): ProgressMetrics {
  const byDay = new Map<string, LanguageMetricSample[]>();
  for (const sample of samples) {
    const key = dayKey(sample.completedAt, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), sample]);
  }

  return {
    totalSessions: samples.length,
    averageWpm: samples.length
      ? Math.round(
          samples.reduce((sum, sample) => sum + sample.wpm, 0) / samples.length,
        )
      : 0,
    averageAccuracy: samples.length
      ? Math.round(
          samples.reduce((sum, sample) => sum + sample.accuracy, 0) /
            samples.length,
        )
      : 0,
    bestWpm: samples.length
      ? Math.max(...samples.map((sample) => sample.wpm))
      : 0,
    daily: Array.from({ length: 14 }, (_, index) => {
      const key = dayKey(subtractDays(now, 13 - index), timeZone);
      const items = byDay.get(key) ?? [];
      return {
        date: key,
        label: dateLabel(key),
        wpm: items.length
          ? Math.round(
              items.reduce((sum, item) => sum + item.wpm, 0) / items.length,
            )
          : 0,
        accuracy: items.length
          ? Math.round(
              items.reduce((sum, item) => sum + item.accuracy, 0) /
                items.length,
            )
          : 0,
        sessions: items.length,
      };
    }),
  };
}

function dayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function dateLabel(key: string) {
  const [, month, day] = key.split('-');
  return `${day}/${month}`;
}

function subtractDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - amount);
  return next;
}

const KEY_CLUSTERS = [
  { id: 'left-pinky', label: 'Left pinky', keys: ['q', 'a', 'z', '`', '1'] },
  { id: 'left-ring', label: 'Left ring', keys: ['w', 's', 'x', '2'] },
  { id: 'left-middle', label: 'Left middle', keys: ['e', 'd', 'c', '3'] },
  {
    id: 'left-index',
    label: 'Left index',
    keys: ['r', 't', 'f', 'g', 'v', 'b', '4', '5'],
  },
  {
    id: 'right-index',
    label: 'Right index',
    keys: ['y', 'u', 'h', 'j', 'n', 'm', '6', '7'],
  },
  { id: 'right-middle', label: 'Right middle', keys: ['i', 'k', ',', '8'] },
  { id: 'right-ring', label: 'Right ring', keys: ['o', 'l', '.', '9'] },
  {
    id: 'right-pinky',
    label: 'Right pinky',
    keys: ['p', ';', '/', '[', ']', '\\', '-', '=', '0'],
  },
  { id: 'thumbs', label: 'Space and thumbs', keys: [' '] },
] as const;

const HAND_KEY_ROWS: Record<OneHandSide, string[][]> = {
  left: [
    ['q', 'w', 'e', 'r', 't'],
    ['a', 's', 'd', 'f', 'g'],
    ['z', 'x', 'c', 'v', 'b'],
    ['`', '1', '2', '3', '4', '5'],
  ],
  right: [
    ['y', 'u', 'i', 'o', 'p'],
    ['h', 'j', 'k', 'l', ';'],
    ['n', 'm', ',', '.', '/'],
    ['6', '7', '8', '9', '0', '-', '=', '[', ']', '\\'],
  ],
};

const DRILL_KEYS = new Set<string>(
  KEY_CLUSTERS.flatMap((cluster) => [...cluster.keys]),
);

const BASELINE_DRILL = Array.from({ length: 8 }, (_, index) =>
  [
    'fff',
    'jjj',
    'fjf',
    'jfj',
    'ffj',
    'jjf',
    'fj',
    'jf',
    index % 2 === 0 ? 'fjjf' : 'jffj',
    index % 2 === 0 ? 'ffjj' : 'jjff',
  ].join(' '),
).join(' ');

function clusterForKey(key: string) {
  const normalized = key.toLowerCase();
  const cluster = KEY_CLUSTERS.find((item) =>
    (item.keys as readonly string[]).includes(normalized),
  );
  return (
    cluster ?? {
      id: `key-${normalized.codePointAt(0) ?? 0}`,
      label: normalized === ' ' ? 'Space' : `Key ${normalized}`,
      keys: [normalized],
    }
  );
}

function patternTokens(expected: string, confusedWith: string, offset: number) {
  const target = expected.toLowerCase();
  const partner = (confusedWith || expected).toLowerCase();

  if (target === ' ') {
    const anchor = partner === ' ' ? 'f' : partner;
    return [
      `${anchor} ${anchor}`,
      `${anchor}${anchor} ${anchor}`,
      `${anchor} ${anchor}${anchor}`,
      `${anchor}${anchor} ${anchor}${anchor}`,
      `${anchor} ${anchor} ${anchor}`,
      `${anchor}${anchor}${anchor} ${anchor}`,
    ];
  }

  if (partner === ' ') {
    return [
      `${target} ${target}`,
      `${target}${target} ${target}`,
      `${target} ${target}${target}`,
      `${target}${target} ${target}${target}`,
      `${target} ${target} ${target}`,
      `${target}${target}${target} ${target}`,
    ];
  }

  const patterns = [
    target.repeat(3),
    partner.repeat(3),
    `${target}${partner}${target}`,
    `${partner}${target}${partner}`,
    `${target}${target}${partner}`,
    `${partner}${partner}${target}`,
    `${target}${partner}`,
    `${partner}${target}`,
    `${target}${partner}${partner}${target}`,
    `${partner}${target}${target}${partner}`,
    `${target}${target}${partner}${partner}`,
    `${partner}${partner}${target}${target}`,
  ];
  const shift = offset % patterns.length;
  return [...patterns.slice(shift), ...patterns.slice(0, shift)];
}

function buildIndividualDrill(items: WeaknessStat[]) {
  const sequences = items.flatMap((item, index) =>
    patternTokens(item.expected, item.confusedWith, item.errors + index),
  );
  const desiredLength = Math.max(72, items.length * 36);
  return Array.from(
    { length: desiredLength },
    (_, index) =>
      sequences[(index * 5 + Math.floor(index / 9)) % sequences.length],
  ).join(' ');
}

export function buildOneHandDrill(
  side: OneHandSide,
  weaknesses: WeaknessStat[],
): OneHandDrill {
  const rows = HAND_KEY_ROWS[side];
  const keys = rows.flat();
  const keySet = new Set(keys);
  const relevant = weaknesses
    .filter((weakness) => keySet.has(weakness.expected.toLowerCase()))
    .sort((a, b) => b.errors - a.errors || b.score - a.score);
  const priorityKeys = [
    ...new Set(relevant.map((weakness) => weakness.expected.toLowerCase())),
  ].slice(0, 8);
  const weightedKeys = [...keys];

  for (const weakness of relevant) {
    const weight = Math.max(
      1,
      Math.min(8, Math.round(weakness.errorRate / 10 + weakness.errors / 3)),
    );
    weightedKeys.push(
      ...Array.from({ length: weight }, () => weakness.expected.toLowerCase()),
    );
  }

  const seed = relevant.reduce(
    (sum, weakness) =>
      sum + weakness.errors * 11 + weakness.expected.codePointAt(0)!,
    side === 'right' ? 29 : 17,
  );
  const patterns = Array.from({ length: 150 }, (_, patternIndex) => {
    const length = 3 + (patternIndex % 3);
    const focus =
      priorityKeys.length > 0
        ? priorityKeys[patternIndex % priorityKeys.length]
        : keys[(patternIndex * 5 + seed) % keys.length];
    const focusRow =
      rows.find((row) => row.includes(focus)) ??
      rows[patternIndex % rows.length];
    const characters = Array.from({ length }, (_, characterIndex) => {
      if (characterIndex === patternIndex % length) return focus;
      if (patternIndex % 3 !== 2) {
        return focusRow[
          (patternIndex + characterIndex * 2 + seed) % focusRow.length
        ];
      }
      return weightedKeys[
        (patternIndex * 7 + characterIndex * 11 + seed) % weightedKeys.length
      ];
    });
    return characters.join('');
  });

  return {
    side,
    keys,
    priorityKeys,
    text: patterns.join(' '),
  };
}

export function buildWeaknessDrills(
  weaknesses: WeaknessStat[],
): WeaknessDrill[] {
  const groups = new Map<string, { label: string; items: WeaknessStat[] }>();

  for (const weakness of weaknesses) {
    const cluster = clusterForKey(weakness.expected);
    const group = groups.get(cluster.id) ?? {
      label: cluster.label,
      items: [],
    };
    group.items.push(weakness);
    groups.set(cluster.id, group);
  }

  return [...groups.entries()]
    .map(([id, group]): WeaknessDrill => {
      const items = [...group.items].sort((a, b) => b.score - a.score);
      const errors = items.reduce((sum, item) => sum + item.errors, 0);
      const exposures = items.reduce((sum, item) => sum + item.exposures, 0);
      return {
        id,
        label: group.label,
        targets: [...new Set(items.map((item) => item.expected))],
        confusions: [
          ...new Set(items.map((item) => item.confusedWith).filter(Boolean)),
        ],
        exposures,
        errors,
        errorRate: Math.round((errors / Math.max(exposures, 1)) * 100),
        text: buildIndividualDrill(items),
      };
    })
    .sort(
      (a, b) =>
        b.errors - a.errors || b.errors / b.exposures - a.errors / a.exposures,
    )
    .slice(0, 6);
}

export function buildDrill(weaknesses: WeaknessStat[]) {
  const drills = buildWeaknessDrills(weaknesses);
  if (drills.length === 0) return BASELINE_DRILL;

  const weightedDrills = drills.flatMap((drill) => {
    const weight = Math.max(
      1,
      Math.min(10, Math.round(drill.errorRate / 10 + drill.errors / 4)),
    );
    return Array.from({ length: weight }, () => drill);
  });
  const tokens = new Map(
    drills.map((drill) => [drill.id, drill.text.split(' ')]),
  );
  const desiredLength = Math.min(180, Math.max(120, drills.length * 42));
  return Array.from({ length: desiredLength }, (_, index) => {
    const drill =
      weightedDrills[(index + Math.floor(index / 11)) % weightedDrills.length];
    const drillTokens = tokens.get(drill.id) ?? drill.targets;
    const tokenIndex =
      (Math.floor(index / weightedDrills.length) * 7 + index + drill.errors) %
      drillTokens.length;
    return drillTokens[tokenIndex];
  }).join(' ');
}

export function computeAnalytics(
  sessions: Session[],
  timeZone: string,
): Analytics {
  const now = new Date();
  // Benchmark and speed-drill scores have their own comparison surface. Do
  // not let a deliberately focused test change the general Progress trend.
  const regularSessions = sessions.filter(
    (session) => session.mode !== 'benchmark' && session.mode !== 'speed-drill',
  );
  const byDay = new Map<string, Session[]>();
  const keyStats = new Map<string, KeyAggregate>();
  const languageSamples: Record<TypingLanguage, LanguageMetricSample[]> = {
    thai: [],
    english: [],
  };

  for (const session of regularSessions) {
    const key = dayKey(session.completedAt, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), session]);

    let events: TypingEvent[] = [];
    try {
      events = JSON.parse(session.eventsJson) as TypingEvent[];
    } catch {
      events = [];
    }

    for (const metric of languageSamplesForSession(session, events)) {
      languageSamples[metric.language].push(metric.sample);
    }

    // Training-drill results remain visible in progress, but they must never
    // train the weakness model or change its percentages.
    if (session.mode !== 'study') continue;

    const ageDays = Math.max(
      0,
      (now.getTime() - session.completedAt.getTime()) / 86_400_000,
    );
    const recencyWeight = Math.pow(0.5, ageDays / 30);

    for (const event of events) {
      if (event.action !== 'insert' || !event.expected) continue;
      if (isCrossLanguageError(event)) continue;
      const expected = event.expected.toLowerCase();
      // Weakness drills coach the physical US QWERTY layout. Thai Practice
      // remains part of session statistics without generating unusable drills.
      if (!DRILL_KEYS.has(expected)) continue;
      const aggregate = keyStats.get(expected) ?? {
        exposures: 0,
        errors: 0,
        weightedExposures: 0,
        weightedErrors: 0,
        latencyTotal: 0,
        confusion: new Map<string, number>(),
      };
      aggregate.exposures += 1;
      aggregate.weightedExposures += recencyWeight;
      aggregate.latencyTotal += event.latencyMs;
      if (!event.correct) {
        aggregate.errors += 1;
        aggregate.weightedErrors += recencyWeight;
        aggregate.confusion.set(
          event.key,
          (aggregate.confusion.get(event.key) ?? 0) + 1,
        );
      }
      keyStats.set(expected, aggregate);
    }
  }

  const allWeaknesses = [...keyStats.entries()]
    .map(([expected, stats]): WeaknessStat => {
      const confusedWith =
        [...stats.confusion.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
        '';
      const errorRate = stats.errors / Math.max(stats.exposures, 1);
      const weightedErrorRate =
        stats.weightedErrors / Math.max(stats.weightedExposures, 0.001);
      const averageLatencyMs = Math.round(
        stats.latencyTotal / Math.max(stats.exposures, 1),
      );
      const score = Math.round(
        weightedErrorRate * 75 + Math.min(averageLatencyMs / 900, 1) * 20,
      );
      return {
        expected,
        confusedWith,
        exposures: stats.exposures,
        errors: stats.errors,
        errorRate: Math.round(errorRate * 100),
        averageLatencyMs,
        score,
      };
    })
    .filter((item) => item.errors > 0)
    .sort((a, b) => b.score - a.score);
  const weaknesses = allWeaknesses.slice(0, 10);
  const drills = buildWeaknessDrills(weaknesses);
  const oneHandDrills = {
    left: buildOneHandDrill('left', allWeaknesses),
    right: buildOneHandDrill('right', allWeaknesses),
  };

  const daily: DailyStat[] = Array.from({ length: 14 }, (_, index) => {
    const key = dayKey(subtractDays(now, 13 - index), timeZone);
    const items = byDay.get(key) ?? [];
    return {
      date: key,
      label: dateLabel(key),
      wpm: items.length
        ? Math.round(
            items.reduce((sum, item) => sum + item.wpm, 0) / items.length,
          )
        : 0,
      accuracy: items.length
        ? Math.round(
            items.reduce((sum, item) => sum + item.accuracy, 0) / items.length,
          )
        : 0,
      sessions: items.length,
    };
  });

  const today = dayKey(now, timeZone);
  const yesterday = dayKey(subtractDays(now, 1), timeZone);
  const latestDay = [...byDay.keys()].sort().at(-1);
  let streak = 0;
  if (latestDay === today || latestDay === yesterday) {
    let cursor = latestDay === today ? now : subtractDays(now, 1);
    while (byDay.has(dayKey(cursor, timeZone))) {
      streak += 1;
      cursor = subtractDays(cursor, 1);
    }
  }

  return {
    totalSessions: regularSessions.length,
    averageWpm: regularSessions.length
      ? Math.round(
          regularSessions.reduce((sum, item) => sum + item.wpm, 0) / regularSessions.length,
        )
      : 0,
    averageAccuracy: regularSessions.length
      ? Math.round(
          regularSessions.reduce((sum, item) => sum + item.accuracy, 0) /
            regularSessions.length,
        )
      : 0,
    bestWpm: regularSessions.length
      ? Math.max(...regularSessions.map((item) => item.wpm))
      : 0,
    streak,
    daily,
    language: {
      thai: buildProgressMetrics(languageSamples.thai, now, timeZone),
      english: buildProgressMetrics(languageSamples.english, now, timeZone),
    },
    weaknesses,
    drills,
    drillText: buildDrill(weaknesses),
    oneHandDrills,
  };
}
