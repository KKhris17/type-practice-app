'use client';

import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Braces,
  Bug,
  Check,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  Flame,
  Fullscreen,
  Gauge,
  House,
  ListChecks,
  Lock,
  LogOut,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Target,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent as ReactSyntheticEvent,
} from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/frontend/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/frontend/ui/dialog';
import { Switch } from '@/frontend/ui/switch';
import type {
  Analytics,
  BenchmarkSessionSummary,
  BootstrapData,
  Evidence,
  OneHandSide,
  SessionLanguageMetric,
  SessionLanguageMetrics,
  SourceRecord,
  TypingLanguage,
  TypingEvent,
} from '@/shared/types';
import { SOURCE_TO_MARKDOWN_PROMPT } from '@/frontend/source-prompt';
import {
  buildBurstHeatmap,
  type BurstHeatmap,
  type BurstInputSegment,
} from '@/shared/burst-heatmap';
import { computeSessionLanguageMetrics } from '@/shared/typing-metrics';
import {
  BENCHMARK_FORMS,
  buildSpeedDrillText,
  chooseBenchmarkForm,
  getBenchmarkForm,
} from '@/shared/benchmark';
import {
  countStudyLessonCharacters,
  getStudyCourse,
  getStudyLesson,
  STUDY_PASS_ACCURACY,
  type FlatStudyLesson,
  type StudyLanguage,
} from '@/shared/study-curriculum';

type View = 'study' | 'practice' | 'benchmark' | 'sources' | 'progress' | 'weaknesses';
// `study` is the persisted compatibility key; the product label is “Practice”.
// `lesson` is the new guided Study curriculum.
type Mode = 'study' | 'lesson' | 'drill' | 'one-hand' | 'benchmark' | 'speed-drill';
type CompletionKind = 'sets' | 'time';
type PracticeLanguage = 'thai-english' | 'thai' | 'english';
type KeyboardLayout = 'qwerty' | 'kedmanee';

type PracticePassageSegment = {
  passageId: string;
  title: string;
  setNumber: number;
  endOffset: number;
};

type PracticePhase = {
  passageId: string | null;
  title: string;
  setNumber: number;
  language: 'Thai' | 'English';
  content: string;
  partNumber: number;
  partCount: number;
};

type PracticeTarget = {
  title: string;
  subtitle: string;
  content: string;
  passageId?: string | null;
  passageSegments?: PracticePassageSegment[];
  practicePhases?: PracticePhase[];
  nextPassageTitle?: string | null;
  studyLessonId?: string | null;
  studyRounds?: string[];
  studyCheckpoint?: boolean;
  benchmarkFormId?: string;
  benchmarkBaselineId?: string | null;
  speedDrillWords?: string[];
  thaiExplanations: Array<{ title: string; text: string }>;
  evidence: Evidence[];
};

type SessionResult = {
  id?: string;
  wpm: number;
  accuracy: number;
  language: SessionLanguageMetrics;
  rawErrors: number;
  corrections: number;
  durationMs: number;
  topErrors: SessionErrorSummary[];
  burstHeatmap: BurstHeatmap;
  saved: boolean;
  studyPassed?: boolean;
};

type SessionErrorSummary = {
  expected: string;
  entered: string;
  count: number;
  firstSeenAt: number;
};

function SessionLanguageCard({
  label,
  metric,
  wpm,
  accuracy,
  detail,
  tone,
}: {
  label: string;
  metric?: SessionLanguageMetric | null;
  wpm?: number;
  accuracy?: number;
  detail?: string;
  tone: 'amber' | 'cyan' | 'violet';
}) {
  const displayWpm = metric?.wpm ?? wpm;
  const displayAccuracy = metric?.accuracy ?? accuracy;
  const toneClasses = {
    amber: {
      card: 'border-amber-300/12 bg-amber-300/[0.035]',
      label: 'text-amber-200/65',
      value: 'text-amber-100',
    },
    cyan: {
      card: 'border-cyan-300/12 bg-cyan-300/[0.035]',
      label: 'text-cyan-200/65',
      value: 'text-cyan-200',
    },
    violet: {
      card: 'border-violet-300/12 bg-violet-300/[0.035]',
      label: 'text-violet-200/65',
      value: 'text-violet-200',
    },
  }[tone];

  return (
    <article className={`rounded-xl border p-5 ${toneClasses.card}`}>
      <p
        className={`font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${toneClasses.label}`}
      >
        {label}
      </p>
      {displayWpm === undefined || displayAccuracy === undefined ? (
        <>
          <p
            className={`mt-2 font-mono text-3xl font-semibold ${toneClasses.value}`}
          >
            —
          </p>
          <p className="mt-1 text-xs text-slate-600">No characters typed</p>
        </>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <p
              className={`font-mono text-3xl font-semibold ${toneClasses.value}`}
            >
              {displayWpm}
              <span className="ml-1.5 text-xs font-medium text-slate-500">
                WPM
              </span>
            </p>
            <p className="font-mono text-xl font-semibold text-slate-300">
              {displayAccuracy}%
              <span className="ml-1.5 text-xs font-medium text-slate-500">
                ACC
              </span>
            </p>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {detail ?? `${metric!.typedCharacters} typed characters`}
          </p>
        </>
      )}
    </article>
  );
}

type ImportResultItem = {
  filename: string;
  status: 'imported' | 'skipped' | 'error';
  message: string;
  importedSets: number;
  duplicateSets: number;
};

type DeleteTarget = {
  kind: 'collection' | 'part';
  id: string;
  title: string;
  partCount: number;
  setCount: number;
};

const DEMO_CONTENT =
  'Type Practice calculates WPM from the correct characters left in the final text and the time spent typing. Five characters count as one word. Accuracy uses correct key insertions divided by all key insertions, so correcting an error does not remove it from the score. After a session, the result screen highlights typing pace for each completed word. Focused drills group nearby US QWERTY keys by finger and emphasize common Practice errors.';

const DEMO_TARGET: PracticeTarget = {
  title: 'How practice metrics work',
  subtitle: 'Demo set · 72 words · import a source to build your library',
  content: DEMO_CONTENT,
  thaiExplanations: [
    {
      title: 'How practice metrics work',
      text: 'บทฝึกนี้อธิบายวิธีอ่านผลใน Type Practice ค่า WPM คำนวณจากจำนวนตัวอักษรที่ถูกต้องในข้อความสุดท้ายและเวลาที่ใช้ โดยคิดห้าตัวอักษรเป็นหนึ่งคำ ส่วน accuracy เทียบจำนวนครั้งที่กดแป้นถูกกับจำนวนครั้งที่กดทั้งหมด ดังนั้นแม้จะแก้คำผิดแล้ว ความผิดพลาดนั้นก็ยังอยู่ในคะแนน หลังจบการฝึก หน้าผลลัพธ์จะแสดงความเร็วของแต่ละคำ และแบบฝึกเฉพาะจุดจะนำข้อผิดพลาดจาก Practice มาจัดกลุ่มแป้น US QWERTY ที่อยู่ใกล้กันตามนิ้ว',
    },
  ],
  evidence: [
    {
      label: 'Type Practice README',
      locator: 'README.md — Metrics',
      excerpt:
        '- WPM uses correct final characters divided by five and by elapsed minutes.\n- Accuracy uses correct key insertions divided by all key insertions, so corrected errors still count.',
    },
  ],
};

const EMPTY_ANALYTICS: Analytics = {
  totalSessions: 0,
  averageWpm: 0,
  averageAccuracy: 0,
  bestWpm: 0,
  streak: 0,
  daily: [],
  language: {
    thai: {
      totalSessions: 0,
      averageWpm: 0,
      averageAccuracy: 0,
      bestWpm: 0,
      daily: [],
    },
    english: {
      totalSessions: 0,
      averageWpm: 0,
      averageAccuracy: 0,
      bestWpm: 0,
      daily: [],
    },
  },
  weaknesses: [],
  drills: [],
  drillText: 'fff jjj fff jjj fjf jfj ff jj fj jf fff jjj fjf jfj',
  oneHandDrills: {
    left: { side: 'left', keys: [], priorityKeys: [], text: '' },
    right: { side: 'right', keys: [], priorityKeys: [], text: '' },
  },
};

const EMPTY_DATA: BootstrapData = {
  sources: [],
  passages: [],
  sessions: [],
  benchmark: { sessions: [], slowWords: [], comparisons: [] },
  studyProgress: [],
  practiceProgress: [],
  analytics: EMPTY_ANALYTICS,
};

type KeyDefinition = {
  base: string;
  shifted?: string;
  label?: string;
  finger: string;
  width?: string;
};

type PracticeScale = 'compact' | 'expanded';
type ProgressScope = 'overall' | TypingLanguage;

type DebugPhase = 'raw' | 'handler' | 'state' | 'lifecycle';

type TypingDebugRecord = {
  sequence: number;
  eventId?: number;
  atMs: number;
  phase: DebugPhase;
  event: string;
  key?: string;
  code?: string;
  inputType?: string;
  data?: string | null;
  decision?: string;
  repeat?: boolean;
  composing?: boolean;
  modifiers?: string[];
  activeElement: string;
  documentFocused: boolean;
  cursor: number;
  typedLength: number;
  domLength: number;
  expected: string;
};

type DebugPanelState = {
  count: number;
  latestRaw?: TypingDebugRecord;
  latestHandler?: TypingDebugRecord;
  latestState?: TypingDebugRecord;
};

type TypingDisplayUnit = {
  start: number;
  end: number;
  entered: string;
  pending: string;
  state: 'pending' | 'partial' | 'correct' | 'wrong';
};

const DEBUG_RECORD_LIMIT = 600;

function segmentGraphemes(text: string) {
  if (typeof Intl.Segmenter === 'function') {
    return [
      ...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text),
    ].map((item) => ({
      start: item.index,
      end: item.index + item.segment.length,
      text: item.segment,
    }));
  }

  const segments: Array<{ start: number; end: number; text: string }> = [];
  let offset = 0;
  for (const character of text) {
    const previous = segments.at(-1);
    if (previous && /^\p{Mark}$/u.test(character)) {
      previous.end += character.length;
      previous.text += character;
    } else {
      segments.push({
        start: offset,
        end: offset + character.length,
        text: character,
      });
    }
    offset += character.length;
  }
  return segments;
}

function buildTypingDisplayUnits(expected: string, entered: string) {
  const expectedUnits: TypingDisplayUnit[] = segmentGraphemes(expected).map(
    (segment) => {
      const enteredSlice = entered.slice(
        segment.start,
        Math.min(segment.end, entered.length),
      );
      const hasInput = entered.length > segment.start;
      const isComplete = entered.length >= segment.end;
      const prefixIsCorrect = segment.text.startsWith(enteredSlice);
      const pending = isComplete ? '' : segment.text.slice(enteredSlice.length);
      const state = !hasInput
        ? 'pending'
        : !prefixIsCorrect
          ? 'wrong'
          : isComplete
            ? enteredSlice === segment.text
              ? 'correct'
              : 'wrong'
            : 'partial';
      return {
        start: segment.start,
        end: segment.end,
        entered: enteredSlice,
        pending,
        state,
      };
    },
  );

  if (entered.length <= expected.length) return expectedUnits;
  return [
    ...expectedUnits,
    ...segmentGraphemes(entered.slice(expected.length)).map((segment) => ({
      start: expected.length + segment.start,
      end: expected.length + segment.end,
      entered: segment.text,
      pending: '',
      state: 'wrong' as const,
    })),
  ];
}

function findLatestDebugRecord(
  records: TypingDebugRecord[],
  phase: DebugPhase,
) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index].phase === phase) return records[index];
  }
  return undefined;
}

const KEY_ROWS: KeyDefinition[][] = [
  [
    { base: '`', shifted: '~', finger: 'L5' },
    { base: '1', shifted: '!', finger: 'L5' },
    { base: '2', shifted: '@', finger: 'L4' },
    { base: '3', shifted: '#', finger: 'L3' },
    { base: '4', shifted: '$', finger: 'L2' },
    { base: '5', shifted: '%', finger: 'L2' },
    { base: '6', shifted: '^', finger: 'R2' },
    { base: '7', shifted: '&', finger: 'R2' },
    { base: '8', shifted: '*', finger: 'R3' },
    { base: '9', shifted: '(', finger: 'R4' },
    { base: '0', shifted: ')', finger: 'R5' },
    { base: '-', shifted: '_', finger: 'R5' },
    { base: '=', shifted: '+', finger: 'R5' },
  ],
  [
    { base: 'q', finger: 'L5' },
    { base: 'w', finger: 'L4' },
    { base: 'e', finger: 'L3' },
    { base: 'r', finger: 'L2' },
    { base: 't', finger: 'L2' },
    { base: 'y', finger: 'R2' },
    { base: 'u', finger: 'R2' },
    { base: 'i', finger: 'R3' },
    { base: 'o', finger: 'R4' },
    { base: 'p', finger: 'R5' },
    { base: '[', shifted: '{', finger: 'R5' },
    { base: ']', shifted: '}', finger: 'R5' },
    { base: '\\', shifted: '|', finger: 'R5' },
  ],
  [
    { base: 'a', finger: 'L5' },
    { base: 's', finger: 'L4' },
    { base: 'd', finger: 'L3' },
    { base: 'f', finger: 'L2' },
    { base: 'g', finger: 'L2' },
    { base: 'h', finger: 'R2' },
    { base: 'j', finger: 'R2' },
    { base: 'k', finger: 'R3' },
    { base: 'l', finger: 'R4' },
    { base: ';', shifted: ':', finger: 'R5' },
    { base: "'", shifted: '"', finger: 'R5' },
  ],
  [
    { base: 'z', finger: 'L5' },
    { base: 'x', finger: 'L4' },
    { base: 'c', finger: 'L3' },
    { base: 'v', finger: 'L2' },
    { base: 'b', finger: 'L2' },
    { base: 'n', finger: 'R2' },
    { base: 'm', finger: 'R2' },
    { base: ',', shifted: '<', finger: 'R3' },
    { base: '.', shifted: '>', finger: 'R4' },
    { base: '/', shifted: '?', finger: 'R5' },
  ],
];

const THAI_KEDMANEE_BY_PHYSICAL_KEY: Record<
  string,
  { base: string; shifted?: string }
> = {
  '`': { base: '_', shifted: '%' },
  '1': { base: 'ๅ', shifted: '+' },
  '2': { base: '/', shifted: '๑' },
  '3': { base: '-', shifted: '๒' },
  '4': { base: 'ภ', shifted: '๓' },
  '5': { base: 'ถ', shifted: '๔' },
  '6': { base: 'ุ', shifted: 'ู' },
  '7': { base: 'ึ', shifted: '฿' },
  '8': { base: 'ค', shifted: '๕' },
  '9': { base: 'ต', shifted: '๖' },
  '0': { base: 'จ', shifted: '๗' },
  '-': { base: 'ข', shifted: '๘' },
  '=': { base: 'ช', shifted: '๙' },
  q: { base: 'ๆ', shifted: '๐' },
  w: { base: 'ไ', shifted: '"' },
  e: { base: 'ำ', shifted: 'ฎ' },
  r: { base: 'พ', shifted: 'ฑ' },
  t: { base: 'ะ', shifted: 'ธ' },
  y: { base: 'ั', shifted: 'ํ' },
  u: { base: 'ี', shifted: '๊' },
  i: { base: 'ร', shifted: 'ณ' },
  o: { base: 'น', shifted: 'ฯ' },
  p: { base: 'ย', shifted: 'ญ' },
  '[': { base: 'บ', shifted: 'ฐ' },
  ']': { base: 'ล', shifted: ',' },
  '\\': { base: 'ฃ', shifted: 'ฅ' },
  a: { base: 'ฟ', shifted: 'ฤ' },
  s: { base: 'ห', shifted: 'ฆ' },
  d: { base: 'ก', shifted: 'ฏ' },
  f: { base: 'ด', shifted: 'โ' },
  g: { base: 'เ', shifted: 'ฌ' },
  h: { base: '้', shifted: '็' },
  j: { base: '่', shifted: '๋' },
  k: { base: 'า', shifted: 'ษ' },
  l: { base: 'ส', shifted: 'ศ' },
  ';': { base: 'ว', shifted: 'ซ' },
  "'": { base: 'ง', shifted: '.' },
  z: { base: 'ผ', shifted: '(' },
  x: { base: 'ป', shifted: ')' },
  c: { base: 'แ', shifted: 'ฉ' },
  v: { base: 'อ', shifted: 'ฮ' },
  b: { base: 'ิ', shifted: 'ฺ' },
  n: { base: 'ื', shifted: '์' },
  m: { base: 'ท', shifted: '?' },
  ',': { base: 'ม', shifted: 'ฒ' },
  '.': { base: 'ใ', shifted: 'ฬ' },
  '/': { base: 'ฝ', shifted: 'ฦ' },
};

const FINGER_LABELS: Record<string, string> = {
  L5: 'Left pinky',
  L4: 'Left ring',
  L3: 'Left middle',
  L2: 'Left index',
  R2: 'Right index',
  R3: 'Right middle',
  R4: 'Right ring',
  R5: 'Right pinky',
};

function buildStudyTarget(lesson: FlatStudyLesson): PracticeTarget {
  return {
    title: lesson.title,
    subtitle: `${lesson.language === 'thai' ? 'Thai Kedmanee' : 'English US QWERTY'} · Level ${lesson.levelNumber} · Lesson ${lesson.lessonNumber} · ${lesson.focus}`,
    content: lesson.rounds[0],
    passageId: null,
    studyLessonId: lesson.id,
    studyRounds: lesson.rounds,
    studyCheckpoint: lesson.checkpoint,
    thaiExplanations: [],
    evidence: [],
  };
}

function getCurrentStudyIndex(
  data: BootstrapData,
  language: StudyLanguage = 'english',
) {
  const lessons = getStudyCourse(language).lessons;
  const passed = new Set(
    data.studyProgress
      .filter((progress) => progress.passedAt !== null)
      .map((progress) => progress.lessonId),
  );
  const currentIndex = lessons.findIndex((lesson) => !passed.has(lesson.id));
  return currentIndex === -1 ? lessons.length : currentIndex;
}

type SourceGroup = {
  key: string;
  selectionId: string;
  title: string;
  collectionId?: string;
  passageCount: number;
  importedAt: number;
  sources: SourceRecord[];
};

function buildSourceGroups(sources: SourceRecord[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const source of sources) {
    const key = source.collectionId
      ? `collection:${source.collectionId}`
      : `source:${source.id}`;
    const group = groups.get(key);
    if (group) {
      group.sources.push(source);
      group.passageCount += source.passageCount;
      group.importedAt = Math.max(group.importedAt, source.importedAt);
      continue;
    }
    groups.set(key, {
      key,
      selectionId: source.collectionId
        ? `collection:${source.collectionId}`
        : source.id,
      title: source.collectionTitle || source.title,
      collectionId: source.collectionId || undefined,
      passageCount: source.passageCount,
      importedAt: source.importedAt,
      sources: [source],
    });
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      sources: [...group.sources].sort(
        (a, b) =>
          (a.partOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.partOrder ?? Number.MAX_SAFE_INTEGER) ||
          a.importedAt - b.importedAt,
      ),
    }))
    .sort((a, b) => b.importedAt - a.importedAt);
}

function isStarterSource(source: SourceRecord | undefined) {
  return source?.originalFileName === 'type-practice.sample.md';
}

function sourceMatchesSelection(
  source: SourceRecord | undefined,
  selectionId: string,
) {
  if (!selectionId) return true;
  if (selectionId.startsWith('collection:')) {
    return source?.collectionId === selectionId.slice('collection:'.length);
  }
  return source?.id === selectionId;
}

function orderedPracticePassages(
  data: BootstrapData,
  selectedSourceId: string,
  showStarterSource: boolean,
  language: PracticeLanguage,
) {
  const hasNonStarterSource = data.sources.some(
    (source) => !isStarterSource(source),
  );
  const sourceRank = new Map(
    buildSourceGroups(data.sources)
      .flatMap((group) => group.sources)
      .map((source, index) => [source.id, index]),
  );

  return data.passages
    .filter((passage) => {
      const source = data.sources.find(
        (candidate) => candidate.id === passage.sourceId,
      );
      const sourceIsVisible =
        sourceMatchesSelection(source, selectedSourceId) &&
        (Boolean(selectedSourceId) ||
          showStarterSource ||
          !hasNonStarterSource ||
          !isStarterSource(source));
      const hasRequestedText =
        language !== 'thai' || Boolean(passage.thaiExplanation?.trim());
      return sourceIsVisible && hasRequestedText;
    })
    .sort(
      (left, right) =>
        (sourceRank.get(left.sourceId) ?? Number.MAX_SAFE_INTEGER) -
          (sourceRank.get(right.sourceId) ?? Number.MAX_SAFE_INTEGER) ||
        left.orderIndex - right.orderIndex ||
        left.title.localeCompare(right.title),
    );
}

function buildDemoTarget(language: PracticeLanguage): PracticeTarget {
  const thai = DEMO_TARGET.thaiExplanations[0]?.text ?? '';
  const practicePhases: PracticePhase[] = (
    language === 'thai'
      ? [{ language: 'Thai' as const, content: thai }]
      : language === 'english'
        ? [{ language: 'English' as const, content: DEMO_CONTENT }]
        : [
            { language: 'Thai' as const, content: thai },
            { language: 'English' as const, content: DEMO_CONTENT },
          ]
  ).map((phase, index, phases) => ({
    ...phase,
    passageId: null,
    title: DEMO_TARGET.title,
    setNumber: 1,
    partNumber: index + 1,
    partCount: phases.length,
  }));
  return {
    ...DEMO_TARGET,
    content: practicePhases[0].content,
    practicePhases,
    subtitle: `${
      language === 'thai-english'
        ? 'Thai → English'
        : language === 'thai'
          ? 'Thai only'
          : 'English only'
    } · Demo set · import a source to build your library`,
  };
}

function buildBenchmarkTarget(formId: string, baselineId: string | null): PracticeTarget {
  const form = getBenchmarkForm(formId) ?? BENCHMARK_FORMS[0];
  return {
    title: form.title,
    subtitle: `${baselineId ? 'Re-benchmark' : 'Benchmark'} · English · ${form.id.toUpperCase()}`,
    content: form.text,
    benchmarkFormId: form.id,
    benchmarkBaselineId: baselineId,
    thaiExplanations: [],
    evidence: [],
  };
}

function buildSpeedDrillTarget(words: string[], baselineId: string | null): PracticeTarget {
  return {
    title: words.length === 1 ? `${words[0]} speed drill` : 'Slow-word speed drill',
    subtitle: `Focused words: ${words.join(', ')}`,
    content: buildSpeedDrillText(words),
    benchmarkBaselineId: baselineId,
    speedDrillWords: words,
    thaiExplanations: [],
    evidence: [],
  };
}

function buildTarget(
  data: BootstrapData,
  mode: Mode,
  selectedSourceId: string,
  completionKind: CompletionKind,
  setCount: number,
  minutes: number,
  selectedDrillId = 'combined',
  oneHandSide: OneHandSide = 'right',
  showStarterSource = false,
  selectedPassageId = '',
  practiceLanguage: PracticeLanguage = 'english',
): PracticeTarget {
  if (mode === 'benchmark') {
    const form = chooseBenchmarkForm(
      data.benchmark.sessions.map((session) => session.benchmarkFormId),
    );
    return buildBenchmarkTarget(form.id, null);
  }

  if (mode === 'speed-drill') {
    const words = data.benchmark.slowWords.slice(0, 5).map((item) => item.word);
    const baseline = data.benchmark.sessions.find(
      (session) => !session.benchmarkBaselineId,
    );
    return buildSpeedDrillTarget(words, baseline?.id ?? null);
  }

  if (mode === 'lesson') {
    return buildStudyTarget(getStudyCourse('english').lessons[0]);
  }

  if (mode === 'drill') {
    const selectedDrill = data.analytics.drills.find(
      (drill) => drill.id === selectedDrillId,
    );
    const drillText = selectedDrill?.text ?? data.analytics.drillText;
    const repeats =
      completionKind === 'time' ? Math.max(8, minutes * 8) : setCount;
    const content = Array.from({ length: repeats }, () => drillText).join(' ');
    const targets = selectedDrill
      ? selectedDrill.targets.join(', ')
      : data.analytics.weaknesses
          .slice(0, 6)
          .map((item) => item.expected)
          .join(', ');
    return {
      title: selectedDrill
        ? `${selectedDrill.label} drill`
        : 'Combined weakness drill',
      subtitle: targets
        ? `Built from Practice errors on: ${targets}`
        : 'Home-row baseline · complete sessions to personalize this drill',
      content,
      passageId: null,
      thaiExplanations: [],
      evidence: [],
    };
  }

  if (mode === 'one-hand') {
    const handDrill = data.analytics.oneHandDrills[oneHandSide];
    const repeats =
      completionKind === 'time' ? Math.max(4, minutes * 4) : setCount;
    const content = Array.from({ length: repeats }, () => handDrill.text).join(
      ' ',
    );
    const priority = handDrill.priorityKeys.join(', ');
    return {
      title: `${oneHandSide === 'right' ? 'Right' : 'Left'}-hand drill`,
      subtitle: priority
        ? `Full-hand coverage · extra weight on Practice weaknesses: ${priority}`
        : 'Full-hand US QWERTY coverage · no Practice weakness detected for this hand yet',
      content,
      passageId: null,
      thaiExplanations: [],
      evidence: [],
    };
  }

  const candidates = orderedPracticePassages(
    data,
    selectedSourceId,
    showStarterSource,
    practiceLanguage,
  );
  if (candidates.length === 0) return buildDemoTarget(practiceLanguage);

  const requestedCount =
    completionKind === 'time' ? Math.max(3, minutes * 2) : setCount;
  const completedPassageIds = new Set(
    data.practiceProgress.map((progress) => progress.passageId),
  );
  const manuallySelectedIndex = selectedPassageId
    ? candidates.findIndex((passage) => passage.id === selectedPassageId)
    : -1;
  const firstUnfinishedIndex = candidates.findIndex(
    (passage) => !completedPassageIds.has(passage.id),
  );
  const startIndex =
    manuallySelectedIndex >= 0
      ? manuallySelectedIndex
      : firstUnfinishedIndex >= 0
        ? firstUnfinishedIndex
        : 0;
  const passages = candidates.slice(startIndex, startIndex + requestedCount);
  const sourceNames = new Set(
    passages.map((passage) =>
      (() => {
        const source = data.sources.find(
          (candidate) => candidate.id === passage.sourceId,
        );
        return source?.collectionTitle ?? source?.title ?? 'Imported source';
      })(),
    ),
  );
  const practicePhases: PracticePhase[] = [];
  const passageSegments: PracticePassageSegment[] = [];
  let cumulativeLength = 0;
  passages.forEach((passage, index) => {
    const thai = passage.thaiExplanation?.trim() ?? '';
    const phaseTexts =
      practiceLanguage === 'thai'
        ? [{ language: 'Thai' as const, content: thai }]
        : practiceLanguage === 'english'
          ? [{ language: 'English' as const, content: passage.content }]
          : [
              ...(thai ? [{ language: 'Thai' as const, content: thai }] : []),
              { language: 'English' as const, content: passage.content },
            ];
    phaseTexts.forEach((phase, phaseIndex) => {
      practicePhases.push({
        passageId: passage.id,
        title: passage.title,
        setNumber: startIndex + index + 1,
        language: phase.language,
        content: phase.content,
        partNumber: phaseIndex + 1,
        partCount: phaseTexts.length,
      });
      cumulativeLength += phase.content.length;
    });
    passageSegments.push({
      passageId: passage.id,
      title: passage.title,
      setNumber: startIndex + index + 1,
      endOffset: cumulativeLength,
    });
  });
  const languageLabel =
    practiceLanguage === 'thai-english'
      ? 'Thai → English'
      : practiceLanguage === 'thai'
        ? 'Thai only'
        : 'English only';
  const endIndex = startIndex + passages.length;
  return {
    title:
      passages.length === 1
        ? passages[0].title
        : `Sets ${startIndex + 1}–${endIndex} of ${candidates.length}`,
    subtitle: `Set ${startIndex + 1}${passages.length > 1 ? `–${endIndex}` : ''} of ${candidates.length} · ${languageLabel} · ${[...sourceNames].join(', ')} · ${passages
      .reduce((sum, passage) => sum + passage.wordCount, 0)
      .toLocaleString()} words`,
    content: practicePhases[0].content,
    passageId: passages.length === 1 ? passages[0].id : null,
    passageSegments,
    practicePhases,
    nextPassageTitle: candidates[endIndex]?.title ?? null,
    thaiExplanations: passages.flatMap((passage) =>
      passage.thaiExplanation
        ? [{ title: passage.title, text: passage.thaiExplanation }]
        : [],
    ),
    evidence: passages.flatMap((passage) => passage.evidence),
  };
}

function keyForCharacter(character: string, layout: KeyboardLayout) {
  if (layout === 'kedmanee') {
    const physicalKey = Object.entries(THAI_KEDMANEE_BY_PHYSICAL_KEY).find(
      ([, labels]) => labels.base === character || labels.shifted === character,
    );
    if (!physicalKey) return undefined;
    const [base, labels] = physicalKey;
    const key = KEY_ROWS.flat().find((item) => item.base === base);
    if (!key) return undefined;
    return { key, shifted: labels.shifted === character };
  }

  const key = KEY_ROWS.flat().find(
    (item) =>
      item.base === character.toLowerCase() || item.shifted === character,
  );
  if (!key) return undefined;
  return {
    key,
    shifted: key.shifted === character || /[A-Z]/.test(character),
  };
}

function keyboardLayoutAt(
  content: string,
  cursor: number,
  practiceLanguage: string,
): KeyboardLayout {
  if (practiceLanguage !== 'Thai') return 'qwerty';
  const character = content[cursor] ?? '';
  if (/^[\u0E00-\u0E7F]$/.test(character)) return 'kedmanee';
  if (/^[A-Za-z0-9]$/.test(character)) return 'qwerty';
  const adjacentText = `${content[cursor - 1] ?? ''}${content[cursor + 1] ?? ''}`;
  return /[A-Za-z0-9]/.test(adjacentText) ? 'qwerty' : 'kedmanee';
}

function keyboardLabels(key: KeyDefinition, layout: KeyboardLayout) {
  if (layout === 'kedmanee') {
    return (
      THAI_KEDMANEE_BY_PHYSICAL_KEY[key.base] ?? {
        base: key.label ?? key.base,
        shifted: key.shifted,
      }
    );
  }
  return { base: key.label ?? key.base, shifted: key.shifted };
}

function physicalKeyLabel(key: KeyDefinition) {
  return /^[a-z]$/.test(key.base) ? key.base.toUpperCase() : key.base;
}

function fingerInstruction(
  character: string,
  layout: KeyboardLayout = 'qwerty',
) {
  if (character === ' ')
    return { key: 'space', finger: 'Thumb', shifted: false };
  const match = keyForCharacter(character, layout);
  if (!match) {
    return {
      key: character || 'done',
      finger: '—',
      shifted: false,
    };
  }
  const { key, shifted } = match;
  const shiftFinger = key.finger.startsWith('L') ? 'Right pinky' : 'Left pinky';
  const keyLabel = physicalKeyLabel(key);
  return {
    key: shifted ? `Shift + ${keyLabel}` : keyLabel,
    finger: shifted
      ? `${shiftFinger} + ${FINGER_LABELS[key.finger]}`
      : FINGER_LABELS[key.finger],
    shifted,
  };
}

function activeFingerCodes(
  character: string,
  oneHandSide?: OneHandSide,
  layout: KeyboardLayout = 'qwerty',
) {
  if (character === ' ') {
    if (oneHandSide) return new Set([oneHandSide === 'left' ? 'LT' : 'RT']);
    return new Set(['LT', 'RT']);
  }
  const match = keyForCharacter(character, layout);
  if (!match) return new Set<string>();
  const { key, shifted } = match;
  const active = new Set([key.finger]);
  if (shifted) active.add(key.finger.startsWith('L') ? 'R5' : 'L5');
  return active;
}

type HandFinger = {
  code: string;
  name: string;
  keys: string;
  x: number;
  y: number;
  height: number;
  rotation?: number;
};

const HANDS: Array<{
  side: 'left' | 'right';
  label: string;
  fingers: HandFinger[];
}> = [
  {
    side: 'left',
    label: 'Left hand',
    fingers: [
      { code: 'L5', name: 'Pinky', keys: 'Q A Z', x: 26, y: 47, height: 65 },
      { code: 'L4', name: 'Ring', keys: 'W S X', x: 62, y: 25, height: 87 },
      { code: 'L3', name: 'Middle', keys: 'E D C', x: 98, y: 14, height: 98 },
      {
        code: 'L2',
        name: 'Index',
        keys: 'R T F G V B',
        x: 134,
        y: 30,
        height: 82,
      },
      {
        code: 'LT',
        name: 'Thumb',
        keys: 'Space',
        x: 176,
        y: 104,
        height: 70,
        rotation: -43,
      },
    ],
  },
  {
    side: 'right',
    label: 'Right hand',
    fingers: [
      {
        code: 'RT',
        name: 'Thumb',
        keys: 'Space',
        x: 42,
        y: 104,
        height: 70,
        rotation: 43,
      },
      {
        code: 'R2',
        name: 'Index',
        keys: 'Y U H J N M',
        x: 84,
        y: 30,
        height: 82,
      },
      { code: 'R3', name: 'Middle', keys: 'I K ,', x: 120, y: 14, height: 98 },
      { code: 'R4', name: 'Ring', keys: 'O L .', x: 156, y: 25, height: 87 },
      { code: 'R5', name: 'Pinky', keys: 'P ; /', x: 192, y: 47, height: 65 },
    ],
  },
];

function HandGuide({
  nextCharacter,
  oneHandSide,
  keyboardLayout,
}: {
  nextCharacter: string;
  oneHandSide?: OneHandSide;
  keyboardLayout: KeyboardLayout;
}) {
  const active = activeFingerCodes(nextCharacter, oneHandSide, keyboardLayout);
  const instruction = fingerInstruction(nextCharacter, keyboardLayout);
  if (nextCharacter === ' ' && oneHandSide) {
    instruction.finger = `${oneHandSide === 'left' ? 'Left' : 'Right'} thumb`;
  }
  const activeKey = keyForCharacter(nextCharacter, keyboardLayout)?.key;
  const shiftFingerCode =
    instruction.shifted && activeKey
      ? activeKey.finger.startsWith('L')
        ? 'R5'
        : 'L5'
      : null;

  return (
    <div className="hand-coach" aria-label="Active finger guide">
      <div className="hand-coach-heading">
        <div>
          <p className="hand-coach-kicker">Hand coach</p>
          <p className="hand-coach-instruction">
            {nextCharacter ? instruction.finger : 'Set complete'}
          </p>
        </div>
        <kbd className="hand-coach-key">
          {nextCharacter === ' ' ? 'SPACE' : nextCharacter || '✓'}
        </kbd>
      </div>

      <div className="hand-pair">
        {HANDS.map((hand) => {
          const activeFinger = hand.fingers.find((finger) =>
            active.has(finger.code),
          );
          const activeKeys =
            activeFinger?.code === shiftFingerCode
              ? 'SHIFT'
              : activeFinger?.keys;
          return (
            <section
              key={hand.side}
              className={`hand-panel ${activeFinger ? 'hand-panel-active' : ''}`}
              aria-label={`${hand.label}${activeFinger ? `, use ${activeFinger.name}` : ''}`}
            >
              <div className="hand-panel-heading">
                <span>{hand.label}</span>
                <strong>{activeFinger?.name ?? 'Stand by'}</strong>
              </div>
              <svg
                className="hand-diagram"
                viewBox="0 0 244 198"
                aria-hidden="true"
              >
                <rect
                  className="hand-palm"
                  x="35"
                  y="100"
                  width="174"
                  height="83"
                  rx="36"
                />
                {hand.fingers.map((finger) => {
                  const isActive = active.has(finger.code);
                  const width = finger.code.endsWith('T') ? 31 : 29;
                  const centerX = finger.x + width / 2;
                  const centerY = finger.y + finger.height / 2;
                  return (
                    <g
                      key={finger.code}
                      transform={
                        finger.rotation
                          ? `rotate(${finger.rotation} ${centerX} ${centerY})`
                          : undefined
                      }
                    >
                      <rect
                        className={`hand-finger hand-finger-${finger.code.slice(-1)} ${
                          isActive ? 'hand-finger-active' : ''
                        }`}
                        x={finger.x}
                        y={finger.y}
                        width={width}
                        height={finger.height}
                        rx={width / 2}
                      />
                      {isActive && (
                        <circle
                          className="hand-fingertip-active"
                          cx={centerX}
                          cy={finger.y + 15}
                          r="6"
                        />
                      )}
                    </g>
                  );
                })}
                <path className="hand-palm-line" d="M65 151 Q122 126 179 151" />
              </svg>
              <div
                className={`hand-active-detail ${activeFinger ? 'hand-legend-active' : ''}`}
              >
                <span>{activeFinger?.name ?? 'Ready position'}</span>
                <small>{activeKeys ?? 'Keep fingers on the home row'}</small>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatResultKey(key: string) {
  if (key === ' ') return 'space';
  if (!key) return 'end of text';
  return key;
}

function summarizeSessionErrors(events: TypingEvent[]) {
  const errors = new Map<string, SessionErrorSummary>();

  for (const event of events) {
    if (event.action !== 'insert' || event.correct) continue;
    const pair = `${event.expected}\u0000${event.key}`;
    const current = errors.get(pair);
    if (current) {
      current.count += 1;
      continue;
    }
    errors.set(pair, {
      expected: event.expected,
      entered: event.key,
      count: 1,
      firstSeenAt: event.atMs,
    });
  }

  return [...errors.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.firstSeenAt - right.firstSeenAt,
    )
    .slice(0, 3);
}

function getNextResultAction(mode: Mode, target: PracticeTarget, hasSlowWords = false) {
  if (mode === 'benchmark') {
    return target.benchmarkBaselineId
      ? { label: 'View benchmark', description: 'Review the before-and-after result' }
      : hasSlowWords
        ? { label: 'Train slow words', description: 'Start a focused speed drill' }
        : { label: 'View benchmark', description: 'Review your baseline' };
  }
  if (mode === 'speed-drill') {
    return { label: 'Re-benchmark', description: 'Use a different matched form' };
  }
  if (mode === 'lesson') {
    const completedLesson = getStudyLesson(target.studyLessonId);
    const courseLessons = completedLesson
      ? getStudyCourse(completedLesson.language).lessons
      : [];
    const completedLessonIndex = courseLessons.findIndex(
      (lesson) => lesson.id === target.studyLessonId,
    );
    const nextLesson = courseLessons[completedLessonIndex + 1];
    return nextLesson
      ? { label: 'Next lesson', description: nextLesson.title }
      : { label: 'View course', description: 'Study course overview' };
  }
  if (mode === 'drill') {
    return { label: 'Next session', description: `Another ${target.title}` };
  }
  if (mode === 'one-hand') {
    return { label: 'Next session', description: `Another ${target.title}` };
  }
  return {
    label: 'Next set',
    description: target.nextPassageTitle ?? 'First unfinished set',
  };
}

const burstToneClasses: Record<BurstHeatmap['words'][number]['tone'], string> = {
  slow: 'border-rose-300/45 bg-rose-300/25 text-rose-100 hover:bg-rose-300/35',
  lagging:
    'border-amber-300/40 bg-amber-300/20 text-amber-100 hover:bg-amber-300/30',
  typical: 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
  fast: 'border-cyan-300/35 bg-cyan-300/15 text-cyan-100 hover:bg-cyan-300/25',
  unmeasured: 'border-dashed border-white/10 text-slate-500',
};

function BurstHeatmapPanel({ heatmap }: { heatmap: BurstHeatmap }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const slowest = heatmap.words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => word.msPerKey !== null)
    .sort((a, b) => (b.word.msPerKey ?? 0) - (a.word.msPerKey ?? 0))
    .slice(0, 3);
  const activeIndex = selectedIndex ?? slowest[0]?.index ?? null;
  const selectedWord =
    activeIndex === null ? undefined : heatmap.words[activeIndex];

  return (
    <section className="mt-6 rounded-xl border border-white/7 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300/70">
            Word timing
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-100">
            Burst heatmap
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Time from the first to last key of each word, divided by its key
            intervals. The gap before a word is excluded. Colors compare with
            your median for the same writing system in this session.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400" aria-label="Heatmap legend">
          {([
            ['slow', 'Slow'],
            ['lagging', 'Below pace'],
            ['typical', 'Typical'],
            ['fast', 'Fast'],
            ['unmeasured', 'Too short / no baseline'],
          ] as const).map(([tone, label]) => (
            <span key={tone} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm border ${burstToneClasses[tone]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-lg border border-white/7 bg-black/15 p-4 font-mono text-sm leading-8 whitespace-pre-wrap text-slate-300 sm:text-[15px]">
        {heatmap.segments.map((parts, segmentIndex) => (
          <p key={segmentIndex}>
            {parts.map((part, partIndex) => {
              if (part.wordIndex === null) {
                return <span key={partIndex}>{part.text}</span>;
              }
              const word = heatmap.words[part.wordIndex];
              return (
                <button
                  key={partIndex}
                  type="button"
                  onClick={() => setSelectedIndex(part.wordIndex)}
                  aria-label={`${word.text}, ${word.msPerKey === null ? 'timing unavailable' : `${Math.round(word.msPerKey)} milliseconds per key, ${word.tone}`}`}
                  aria-pressed={activeIndex === part.wordIndex}
                  className={`rounded border px-0.5 text-left font-mono focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${burstToneClasses[word.tone]} ${activeIndex === part.wordIndex ? 'outline-2 outline-offset-2 outline-cyan-300' : ''}`}
                >
                  {part.text}
                </button>
              );
            })}
          </p>
        ))}
      </div>

      {selectedWord ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400" aria-live="polite">
          <strong className="font-mono text-sm text-slate-100">
            {selectedWord.text}
          </strong>
          {selectedWord.durationMs === null ? (
            <span>Not enough completed keys to measure this word.</span>
          ) : (
            <>
              <span>{(selectedWord.durationMs / 1000).toFixed(2)}s in word</span>
              <span>{Math.round(selectedWord.msPerKey ?? 0)} ms/key</span>
              <span>{selectedWord.errors} errors · {selectedWord.corrections} corrections</span>
            </>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Finish at least two keys in a word to see its burst timing.
        </p>
      )}
      {slowest.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Slowest words: {slowest.map(({ word }) => word.text).join(' · ')}
        </p>
      )}
    </section>
  );
}

function SessionResultScreen({
  result,
  target,
  mode,
  baseline,
  onHome,
  onRetry,
  onNext,
  nextLabel = 'Next session',
  nextDescription = 'New session',
}: {
  result: SessionResult;
  target: PracticeTarget;
  mode: Mode;
  baseline?: BenchmarkSessionSummary;
  onHome: () => void;
  onRetry: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDescription?: string;
}) {
  const hasStudyContext =
    mode === 'study' &&
    (target.thaiExplanations.length > 0 || target.evidence.length > 0);
  const isLesson = mode === 'lesson';

  return (
    <section
      className="session-result-screen rounded-2xl border border-white/8 bg-[#0d1721] shadow-[0_24px_90px_rgb(0_0_0/24%)]"
      aria-labelledby="session-result-title"
    >
      <div className="mx-auto w-full max-w-[1120px] p-5 sm:p-7 lg:p-8">
        <header className="flex flex-col justify-between gap-5 border-b border-white/7 pb-6 sm:flex-row sm:items-end">
          <div>
            <p
              className={`flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] ${
                isLesson && !result.studyPassed
                  ? 'text-amber-200/85'
                  : 'text-cyan-300/80'
              }`}
            >
              {isLesson && !result.studyPassed ? (
                <RotateCcw size={15} />
              ) : (
                <Check size={15} />
              )}{' '}
              {isLesson
                ? result.studyPassed
                  ? 'Lesson passed'
                  : 'Keep practicing'
                : 'Session complete'}
            </p>
            <h1
              id="session-result-title"
              className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[30px]"
            >
              {target.title}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {isLesson && !result.studyPassed
                ? `${STUDY_PASS_ACCURACY}% accuracy is required to unlock the next lesson. `
                : ''}
              {result.saved
                ? 'Saved to local SQLite.'
                : 'Saving to local SQLite…'}
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            <button
              type="button"
              onClick={onHome}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <House size={15} /> Home
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <RotateCcw size={15} /> {isLesson ? 'Retry lesson' : 'Retry set'}
            </button>
            {(!isLesson || (result.studyPassed && result.saved)) &&
              ((mode !== 'benchmark' && mode !== 'speed-drill') || result.saved) && (
              <button
                type="button"
                onClick={onNext}
                aria-label={`${nextLabel}: ${nextDescription}`}
                className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-cyan-300 px-4 text-slate-950 hover:bg-cyan-200"
              >
                <span className="min-w-0 text-left leading-tight">
                  <span className="block text-sm font-semibold">
                    {nextLabel}
                  </span>
                  <span className="mt-0.5 block max-w-48 truncate text-[10px] font-medium text-slate-800/70">
                    {nextDescription}
                  </span>
                </span>
                <ChevronRight className="shrink-0" size={15} />
              </button>
              )}
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SessionLanguageCard
            label="Overall"
            wpm={result.wpm}
            accuracy={result.accuracy}
            tone="amber"
            detail={`Time ${formatDuration(result.durationMs)} · ${result.rawErrors} errors · ${result.corrections} corrections`}
          />
          <SessionLanguageCard
            label="Thai"
            metric={result.language.thai}
            tone="cyan"
          />
          <SessionLanguageCard
            label="English"
            metric={result.language.english}
            tone="violet"
          />
        </div>

        {mode === 'benchmark' && (
          <section className="mt-6 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-cyan-300/75">
              {baseline ? 'Re-benchmark vs baseline' : 'Benchmark baseline'}
            </p>
            {baseline ? (
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-200">
                <p>WPM <strong className="font-mono">{baseline.wpm} → {result.wpm}</strong> <span className="text-slate-400">({result.wpm - baseline.wpm >= 0 ? '+' : ''}{result.wpm - baseline.wpm})</span></p>
                <p>Accuracy <strong className="font-mono">{baseline.accuracy}% → {result.accuracy}%</strong> <span className="text-slate-400">({result.accuracy - baseline.accuracy >= 0 ? '+' : ''}{result.accuracy - baseline.accuracy} pp)</span></p>
                <p className="w-full text-xs text-slate-400">
                  {result.wpm > baseline.wpm && result.accuracy < baseline.accuracy
                    ? 'Faster, but with lower accuracy. Treat this as a speed–accuracy trade-off.'
                    : 'Compare repeated tests over time; one pair can vary with the text and the day.'}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-300">
                This is your starting measure. Drill recurring slow words, then test on a different form.
              </p>
            )}
          </section>
        )}

        <BurstHeatmapPanel heatmap={result.burstHeatmap} />

        <div
          className={`mt-6 grid min-w-0 gap-4 ${hasStudyContext ? 'lg:grid-cols-[0.72fr_1.28fr]' : ''}`}
        >
          <section className="rounded-xl border border-white/7 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-rose-300/70">
                  This session
                </p>
                <h2 className="mt-1 text-base font-semibold text-slate-100">
                  Top 3 errors
                </h2>
              </div>
              <span className="rounded-md bg-rose-300/8 px-2.5 py-1 font-mono text-xs text-rose-200">
                {result.rawErrors} total
              </span>
            </div>

            {result.topErrors.length === 0 ? (
              <div className="mt-5 rounded-lg border border-emerald-300/12 bg-emerald-300/[0.035] px-4 py-5 text-center">
                <Check className="mx-auto text-emerald-300" size={20} />
                <p className="mt-2 text-sm font-medium text-emerald-100">
                  No typing errors
                </p>
                <p className="mt-1 text-xs text-slate-600">A clean session.</p>
              </div>
            ) : (
              <ol className="mt-4 space-y-2">
                {result.topErrors.map((error, index) => (
                  <li
                    key={`${error.expected}-${error.entered}`}
                    className="flex items-center gap-3 rounded-lg border border-white/6 bg-black/15 px-3 py-3"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-rose-300/8 font-mono text-xs text-rose-200">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-mono text-sm text-slate-200">
                        <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">
                          {formatResultKey(error.expected)}
                        </kbd>
                        <span className="text-slate-700">→</span>
                        <kbd className="rounded border border-rose-300/14 bg-rose-300/7 px-1.5 py-0.5 text-rose-200">
                          {formatResultKey(error.entered)}
                        </kbd>
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-600">
                        expected → entered
                      </p>
                    </div>
                    <strong className="font-mono text-sm text-slate-400">
                      {error.count}×
                    </strong>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {hasStudyContext && (
            <section className="rounded-xl border border-white/7 bg-white/[0.02] p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-violet-300/75">
                Review
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-100">
                Meaning &amp; source
              </h2>

              {target.thaiExplanations.length > 0 ? (
                <div className="mt-4 space-y-4 rounded-lg border border-violet-300/12 bg-violet-300/[0.035] p-4">
                  {target.thaiExplanations.map((explanation, index) => (
                    <article key={`${explanation.title}-${index}`}>
                      {target.thaiExplanations.length > 1 && (
                        <h3 className="mb-1.5 text-xs font-medium text-violet-200/80">
                          {explanation.title}
                        </h3>
                      )}
                      <p
                        lang="th"
                        className="text-base leading-7 text-slate-200"
                      >
                        {explanation.text}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-amber-300/12 bg-amber-300/[0.035] px-4 py-3 text-sm text-amber-200/80">
                  This older set does not include a Thai explanation.
                </p>
              )}

              {target.evidence.length > 0 && (
                <div className="mt-5 space-y-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300/70">
                    Original evidence
                  </p>
                  {target.evidence.map((evidence, index) => (
                    <article
                      key={`${evidence.label}-${index}`}
                      className="rounded-lg border border-white/7 bg-black/15 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            {evidence.label}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {evidence.locator}
                          </p>
                        </div>
                        {evidence.url && (
                          <a
                            href={evidence.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-600 hover:text-cyan-300"
                            aria-label={`Open ${evidence.label}`}
                          >
                            <ExternalLink size={15} />
                          </a>
                        )}
                      </div>
                      <blockquote className="mt-3 border-l-2 border-cyan-300/25 pl-3 text-sm leading-6 text-slate-400">
                        {evidence.excerpt}
                      </blockquote>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </section>
  );
}

function AppLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-[10px] border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
        <Braces size={18} strokeWidth={2.2} />
      </div>
      <div>
        <p className="font-mono text-[15px] font-semibold tracking-[-0.02em] text-white">
          type/practice
        </p>
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
          local workspace
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = 'text-white',
  detail,
}: {
  label: string;
  value: string | number;
  tone?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-white/7 bg-white/[0.025] px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>
      <p className={`mt-1 font-mono text-xl font-semibold ${tone}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-600">{detail}</p>}
    </div>
  );
}

export function TypingApp() {
  const [view, setView] = useState<View>('practice');
  const [progressScope, setProgressScope] = useState<ProgressScope>('overall');
  const [mode, setMode] = useState<Mode>('study');
  const [completionKind, setCompletionKind] = useState<CompletionKind>('sets');
  const [setCount, setSetCount] = useState(1);
  const [minutes, setMinutes] = useState(1);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedPassageId, setSelectedPassageId] = useState('');
  const [practiceLanguage, setPracticeLanguage] =
    useState<PracticeLanguage>('english');
  const [studyLanguage, setStudyLanguage] = useState<StudyLanguage>('english');
  const [selectedDrillId, setSelectedDrillId] = useState('combined');
  const [oneHandSide, setOneHandSide] = useState<OneHandSide>('right');
  const [data, setData] = useState<BootstrapData>(EMPTY_DATA);
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [dataError, setDataError] = useState('');
  const [target, setTarget] = useState<PracticeTarget>(DEMO_TARGET);
  const [typed, setTyped] = useState('');
  const [cursor, setCursor] = useState(0);
  const [events, setEvents] = useState<TypingEvent[]>([]);
  const [studyRoundIndex, setStudyRoundIndex] = useState(0);
  const [studyCompletedEvents, setStudyCompletedEvents] = useState<
    TypingEvent[]
  >([]);
  const [studyCompletedCorrectCharacters, setStudyCompletedCorrectCharacters] =
    useState(0);
  const [practicePhaseIndex, setPracticePhaseIndex] = useState(0);
  const [practiceCompletedEvents, setPracticeCompletedEvents] = useState<
    TypingEvent[]
  >([]);
  const [
    practiceCompletedCorrectCharacters,
    setPracticeCompletedCorrectCharacters,
  ] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<SessionResult | null>(null);
  const [practicePreviewTarget, setPracticePreviewTarget] =
    useState<PracticeTarget | null>(null);
  const [showSourcePrompt, setShowSourcePrompt] = useState(false);
  const [sourcePromptCopyStatus, setSourcePromptCopyStatus] = useState<
    'idle' | 'copied' | 'error'
  >('idle');
  const [sessionActive, setSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [practiceScale, setPracticeScale] = useState<PracticeScale>('expanded');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [typingFocused, setTypingFocused] = useState(false);
  const [inputNotice, setInputNotice] = useState('');
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugFrozen, setDebugFrozen] = useState(false);
  const [debugPanel, setDebugPanel] = useState<DebugPanelState>({ count: 0 });
  const [debugCopyStatus, setDebugCopyStatus] = useState('');
  const [importState, setImportState] = useState<
    'idle' | 'reading' | 'importing' | 'success' | 'warning' | 'error'
  >('idle');
  const [importMessage, setImportMessage] = useState('');
  const [importResults, setImportResults] = useState<ImportResultItem[]>([]);
  const [showStarterSource, setShowStarterSource] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting'>('idle');
  const [sourceNotice, setSourceNotice] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const typingRef = useRef<HTMLTextAreaElement>(null);
  const typingCopyScrollRef = useRef<HTMLDivElement>(null);
  const activeCharacterRef = useRef<HTMLSpanElement>(null);
  const activeLineRef = useRef<number | null>(null);
  const practiceStageRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typedRef = useRef('');
  const cursorRef = useRef(0);
  const eventsRef = useRef<TypingEvent[]>([]);
  const studyCompletedEventsRef = useRef<TypingEvent[]>([]);
  const studyCompletedTextRef = useRef('');
  const studyCompletedCorrectCharactersRef = useRef(0);
  const practiceCompletedEventsRef = useRef<TypingEvent[]>([]);
  const practiceCompletedTextRef = useRef('');
  const practiceCompletedCorrectCharactersRef = useRef(0);
  const completedBurstSegmentsRef = useRef<BurstInputSegment[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const lastKeyAtRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const lastKeyDownInsertRef = useRef<{ key: string; at: number } | null>(null);
  const roundTransitionRef = useRef(false);
  const finishedRef = useRef(false);
  const debugEnabledRef = useRef(false);
  const debugFrozenRef = useRef(false);
  const debugStartedAtRef = useRef(0);
  const debugSequenceRef = useRef(0);
  const debugEventIdRef = useRef(0);
  const activeDebugEventIdRef = useRef<number | undefined>(undefined);
  const debugRecordsRef = useRef<TypingDebugRecord[]>([]);
  const debugRefreshFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    document.documentElement.dataset.typePracticeReady = 'true';
    window.sessionStorage.removeItem('type-practice-client-recovery-at');

    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('recover')) {
      currentUrl.searchParams.delete('recover');
      window.history.replaceState(
        null,
        '',
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }

    return () => {
      delete document.documentElement.dataset.typePracticeReady;
    };
  }, []);

  const focusTyping = useCallback(() => {
    const input = typingRef.current;
    if (input && !input.disabled) input.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    const viewport = typingCopyScrollRef.current;
    const caret = activeCharacterRef.current;
    if (!sessionActive || result || !viewport || !caret) return;

    const frame = window.requestAnimationFrame(() => {
      const viewportRect = viewport.getBoundingClientRect();
      const caretRect = caret.getBoundingClientRect();
      const lineHeight =
        Number.parseFloat(window.getComputedStyle(caret).lineHeight) || 32;
      const caretTopInContent =
        viewport.scrollTop + caretRect.top - viewportRect.top;
      const activeLine = Math.round(caretTopInContent / lineHeight);

      if (activeLineRef.current === activeLine) return;
      activeLineRef.current = activeLine;

      const upperBoundary = viewportRect.top + lineHeight * 0.2;
      const lowerBoundary = viewportRect.top + viewportRect.height * 0.52;
      if (caretRect.top >= upperBoundary && caretRect.top <= lowerBoundary) {
        return;
      }

      const targetTop = viewportRect.top + viewportRect.height * 0.34;
      viewport.scrollTop = Math.max(
        0,
        viewport.scrollTop + caretRect.top - targetTop,
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [cursor, result, sessionActive, studyRoundIndex, target.content]);

  const commitCursor = useCallback((nextCursor: number) => {
    cursorRef.current = nextCursor;
    setCursor(nextCursor);
  }, []);

  const recordDebug = useCallback(
    (
      record: Pick<TypingDebugRecord, 'phase' | 'event'> &
        Partial<
          Pick<
            TypingDebugRecord,
            | 'eventId'
            | 'key'
            | 'code'
            | 'inputType'
            | 'data'
            | 'decision'
            | 'repeat'
            | 'composing'
            | 'modifiers'
          >
        >,
    ) => {
      if (!debugEnabledRef.current || debugFrozenRef.current) return;

      const input = typingRef.current;
      const activeElement = document.activeElement;
      const nextRecord: TypingDebugRecord = {
        sequence: ++debugSequenceRef.current,
        atMs:
          Math.round((performance.now() - debugStartedAtRef.current) * 10) / 10,
        activeElement:
          activeElement === input
            ? 'typing-input'
            : activeElement?.tagName.toLowerCase() || 'none',
        documentFocused: document.hasFocus(),
        cursor: cursorRef.current,
        typedLength: typedRef.current.length,
        domLength: input?.value.length ?? -1,
        expected: target.content[cursorRef.current] ?? '',
        ...record,
      };

      const records = debugRecordsRef.current;
      records.push(nextRecord);
      if (records.length > DEBUG_RECORD_LIMIT) {
        records.splice(0, records.length - DEBUG_RECORD_LIMIT);
      }

      if (debugRefreshFrameRef.current === null) {
        debugRefreshFrameRef.current = window.requestAnimationFrame(() => {
          debugRefreshFrameRef.current = null;
          const latestRecords = debugRecordsRef.current;
          setDebugPanel({
            count: latestRecords.length,
            latestRaw: findLatestDebugRecord(latestRecords, 'raw'),
            latestHandler: findLatestDebugRecord(latestRecords, 'handler'),
            latestState: findLatestDebugRecord(latestRecords, 'state'),
          });
        });
      }
    },
    [target.content],
  );

  const recordRenderedState = useCallback(
    (eventId: number | undefined, decision: string) => {
      window.requestAnimationFrame(() => {
        recordDebug({
          phase: 'state',
          event: 'render-frame',
          eventId,
          decision,
        });
      });
    },
    [recordDebug],
  );

  useEffect(() => {
    if (
      view !== 'practice' ||
      !sessionActive ||
      isPaused ||
      dataState === 'loading' ||
      result
    )
      return;
    const frame = window.requestAnimationFrame(focusTyping);
    return () => window.cancelAnimationFrame(frame);
  }, [dataState, focusTyping, isPaused, result, sessionActive, view]);

  useEffect(() => {
    if (!debugEnabled) return;

    const recordWindowFocus = () =>
      recordDebug({ phase: 'lifecycle', event: 'window-focus' });
    const recordWindowBlur = () =>
      recordDebug({ phase: 'lifecycle', event: 'window-blur' });
    const recordVisibility = () =>
      recordDebug({
        phase: 'lifecycle',
        event: `visibility:${document.visibilityState}`,
      });
    const recordFullscreen = () =>
      recordDebug({
        phase: 'lifecycle',
        event: document.fullscreenElement
          ? 'fullscreen-enter'
          : 'fullscreen-exit',
      });

    window.addEventListener('focus', recordWindowFocus);
    window.addEventListener('blur', recordWindowBlur);
    document.addEventListener('visibilitychange', recordVisibility);
    document.addEventListener('fullscreenchange', recordFullscreen);

    return () => {
      window.removeEventListener('focus', recordWindowFocus);
      window.removeEventListener('blur', recordWindowBlur);
      document.removeEventListener('visibilitychange', recordVisibility);
      document.removeEventListener('fullscreenchange', recordFullscreen);
    };
  }, [debugEnabled, recordDebug]);

  useEffect(
    () => () => {
      if (debugRefreshFrameRef.current !== null) {
        window.cancelAnimationFrame(debugRefreshFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const savedScale = window.localStorage.getItem(
          'type-practice:practice-scale',
        );
        if (savedScale === 'compact' || savedScale === 'expanded') {
          setPracticeScale(savedScale);
        }
        setShowStarterSource(
          window.localStorage.getItem('type-practice:show-starter-source') ===
            'true',
        );
        const savedPracticeLanguage = window.localStorage.getItem(
          'type-practice:practice-language-v2',
        );
        if (
          savedPracticeLanguage === 'thai-english' ||
          savedPracticeLanguage === 'thai' ||
          savedPracticeLanguage === 'english'
        ) {
          setPracticeLanguage(savedPracticeLanguage);
        }
        const savedStudyLanguage = window.localStorage.getItem(
          'type-practice:study-language',
        );
        if (savedStudyLanguage === 'english' || savedStudyLanguage === 'thai') {
          setStudyLanguage(savedStudyLanguage);
        }
      } catch {
        // Keep the default size when browser storage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === practiceStageRef.current);
      focusTyping();
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [focusTyping]);

  function choosePracticeScale(scale: PracticeScale) {
    setPracticeScale(scale);
    try {
      window.localStorage.setItem('type-practice:practice-scale', scale);
    } catch {
      // Storage restrictions must not interrupt typing.
    }
    focusTyping();
  }

  function choosePracticeLanguage(language: PracticeLanguage) {
    setPracticeLanguage(language);
    setSelectedPassageId('');
    try {
      window.localStorage.setItem(
        'type-practice:practice-language-v2',
        language,
      );
    } catch {
      // The language preference can remain in memory when storage is blocked.
    }
  }

  function chooseStudyLanguage(language: StudyLanguage) {
    setStudyLanguage(language);
    try {
      window.localStorage.setItem('type-practice:study-language', language);
    } catch {
      // The language preference can remain in memory when storage is blocked.
    }
  }

  function chooseStarterVisibility(visible: boolean) {
    setShowStarterSource(visible);
    if (!visible && selectedSourceId) {
      const selectedSource = data.sources.find(
        (source) => source.id === selectedSourceId,
      );
      if (isStarterSource(selectedSource)) setSelectedSourceId('');
    }
    try {
      window.localStorage.setItem(
        'type-practice:show-starter-source',
        String(visible),
      );
    } catch {
      // The visibility preference can remain in memory when storage is blocked.
    }
  }

  async function toggleFullscreen() {
    focusTyping();
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await practiceStageRef.current?.requestFullscreen();
      }
    } catch {
      setInputNotice(
        'Full screen is not available in this browser. You can keep typing here.',
      );
    } finally {
      focusTyping();
    }
  }

  const refreshData = useCallback(async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const response = await fetch(
      `/api/bootstrap?tz=${encodeURIComponent(timeZone)}`,
      {
        cache: 'no-store',
      },
    );
    const payload = (await response.json()) as BootstrapData & {
      error?: string;
    };
    if (!response.ok)
      throw new Error(payload.error || 'Unable to load local data.');
    setData(payload);
    return payload;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void refreshData()
        .then((payload) => {
          if (cancelled) return;
          setDataState('ready');
          if (payload.passages.length > 0) {
            setTarget(
              buildTarget(
                payload,
                'study',
                '',
                'sets',
                1,
                1,
                'combined',
                'right',
                false,
                '',
                'english',
              ),
            );
          }
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setDataState('error');
          setDataError(
            error instanceof Error
              ? error.message
              : 'Unable to load local data.',
          );
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshData]);

  const resetMachine = useCallback(
    (nextTarget?: PracticeTarget) => {
      if (nextTarget) setTarget(nextTarget);
      setTyped('');
      typedRef.current = '';
      commitCursor(0);
      setEvents([]);
      eventsRef.current = [];
      setStudyRoundIndex(0);
      setStudyCompletedEvents([]);
      studyCompletedEventsRef.current = [];
      studyCompletedTextRef.current = '';
      setStudyCompletedCorrectCharacters(0);
      studyCompletedCorrectCharactersRef.current = 0;
      setPracticePhaseIndex(0);
      setPracticeCompletedEvents([]);
      practiceCompletedEventsRef.current = [];
      practiceCompletedTextRef.current = '';
      setPracticeCompletedCorrectCharacters(0);
      practiceCompletedCorrectCharactersRef.current = 0;
      completedBurstSegmentsRef.current = [];
      setStartedAt(null);
      startedAtRef.current = null;
      lastKeyAtRef.current = null;
      pausedAtRef.current = null;
      lastKeyDownInsertRef.current = null;
      roundTransitionRef.current = false;
      activeLineRef.current = null;
      if (typingCopyScrollRef.current) {
        typingCopyScrollRef.current.scrollTop = 0;
      }
      setIsPaused(false);
      setNow(Date.now());
      setResult(null);
      setInputNotice('');
      finishedRef.current = false;
      window.setTimeout(focusTyping, 0);
    },
    [commitCursor, focusTyping],
  );

  const prepareTarget = useCallback(
    (nextMode: Mode = mode) => {
      setMode(nextMode);
      if (nextMode === 'lesson' || nextMode === 'benchmark' || nextMode === 'speed-drill') setCompletionKind('sets');
      setView(nextMode === 'lesson' ? 'study' : nextMode === 'benchmark' || nextMode === 'speed-drill' ? 'benchmark' : 'practice');
      const studyLessons = getStudyCourse(studyLanguage).lessons;
      const currentStudyLesson =
        studyLessons[
          Math.min(
            getCurrentStudyIndex(data, studyLanguage),
            studyLessons.length - 1,
          )
        ];
      const nextTarget =
        nextMode === 'lesson'
          ? buildStudyTarget(currentStudyLesson)
          : buildTarget(
              data,
              nextMode,
              selectedSourceId,
              completionKind,
              setCount,
              minutes,
              selectedDrillId,
              oneHandSide,
              showStarterSource,
              selectedPassageId,
              practiceLanguage,
            );
      resetMachine(nextTarget);
    },
    [
      completionKind,
      data,
      minutes,
      mode,
      oneHandSide,
      resetMachine,
      selectedSourceId,
      selectedPassageId,
      selectedDrillId,
      setCount,
      showStarterSource,
      practiceLanguage,
      studyLanguage,
    ],
  );

  function startSession() {
    const nextTarget = buildTarget(
      data,
      mode,
      selectedSourceId,
      completionKind,
      setCount,
      minutes,
      selectedDrillId,
      oneHandSide,
      showStarterSource,
      selectedPassageId,
      practiceLanguage,
    );
    if (mode === 'study' && practiceLanguage === 'english') {
      setPracticePreviewTarget(nextTarget);
      return;
    }
    resetMachine(nextTarget);
    if (mode === 'study') setSelectedPassageId('');
    setSessionActive(true);
  }

  function startBenchmark(baselineId: string | null = null) {
    const baseline = baselineId
      ? data.benchmark.sessions.find((session) => session.id === baselineId)
      : undefined;
    if (baselineId && !baseline) return;
    const form = chooseBenchmarkForm(
      data.benchmark.sessions.map((session) => session.benchmarkFormId),
      baseline?.benchmarkFormId,
    );
    setMode('benchmark');
    setCompletionKind('sets');
    setView('benchmark');
    resetMachine(buildBenchmarkTarget(form.id, baseline?.id ?? null));
    setSessionActive(true);
  }

  function startSpeedDrill(words: string[]) {
    const validWords = words.filter((word) => /^[a-z]{3,20}$/iu.test(word));
    if (!validWords.length) return;
    const baseline = data.benchmark.sessions.find(
      (session) => !session.benchmarkBaselineId,
    );
    setMode('speed-drill');
    setCompletionKind('sets');
    setView('benchmark');
    resetMachine(buildSpeedDrillTarget(validWords, baseline?.id ?? null));
    setSessionActive(true);
  }

  function beginPracticeAfterPreview() {
    if (!practicePreviewTarget) return;
    resetMachine(practicePreviewTarget);
    setPracticePreviewTarget(null);
    setSelectedPassageId('');
    setSessionActive(true);
  }

  function startStudyLesson(lessonId: string) {
    const lesson = getStudyLesson(lessonId);
    if (!lesson) return;
    const courseLessons = getStudyCourse(lesson.language).lessons;
    const lessonIndex = courseLessons.findIndex((item) => item.id === lessonId);
    if (lessonIndex > getCurrentStudyIndex(data, lesson.language)) return;

    setStudyLanguage(lesson.language);
    setMode('lesson');
    setCompletionKind('sets');
    setView('study');
    resetMachine(buildStudyTarget(lesson));
    setSessionActive(true);
  }

  function continueStudy() {
    const completedLesson = getStudyLesson(target.studyLessonId);
    if (!completedLesson) {
      leaveSession();
      return;
    }
    const courseLessons = getStudyCourse(completedLesson.language).lessons;
    const completedLessonIndex = courseLessons.findIndex(
      (lesson) => lesson.id === target.studyLessonId,
    );
    const nextLesson = courseLessons[completedLessonIndex + 1];
    if (nextLesson) {
      startStudyLesson(nextLesson.id);
      return;
    }
    leaveSession();
  }

  function retrySession() {
    if (mode === 'lesson') {
      const studyLesson = getStudyLesson(target.studyLessonId);
      if (studyLesson) {
        resetMachine(buildStudyTarget(studyLesson));
        return;
      }
    }
    if (mode === 'study' && target.practicePhases?.length) {
      resetMachine({
        ...target,
        content: target.practicePhases[0].content,
      });
      return;
    }
    resetMachine();
  }

  function leaveSession() {
    if (document.fullscreenElement) void document.exitFullscreen();
    setSessionActive(false);
    if (mode === 'lesson') setView('study');
    if (mode === 'benchmark' || mode === 'speed-drill') setView('benchmark');
    resetMachine();
  }

  function toggleSessionPause() {
    if (!sessionActive || result) return;
    const timestamp = Date.now();

    if (isPaused) {
      const pausedAt = pausedAtRef.current;
      if (pausedAt && startedAtRef.current) {
        const adjustedStart =
          startedAtRef.current + Math.max(0, timestamp - pausedAt);
        startedAtRef.current = adjustedStart;
        setStartedAt(adjustedStart);
      }
      pausedAtRef.current = null;
      lastKeyAtRef.current = null;
      setIsPaused(false);
      setNow(timestamp);
      window.setTimeout(focusTyping, 0);
      return;
    }

    pausedAtRef.current = timestamp;
    setNow(timestamp);
    setIsPaused(true);
  }

  function updateSessionFormat(
    nextKind: CompletionKind,
    nextSetCount = setCount,
    nextMinutes = minutes,
  ) {
    setCompletionKind(nextKind);
    setSetCount(nextSetCount);
    setMinutes(nextMinutes);
    const nextTarget = buildTarget(
      data,
      mode,
      selectedSourceId,
      nextKind,
      nextSetCount,
      nextMinutes,
      selectedDrillId,
      oneHandSide,
      showStarterSource,
      selectedPassageId,
      practiceLanguage,
    );
    resetMachine(nextTarget);
  }

  function startWeaknessDrill(drillId: string) {
    setSelectedDrillId(drillId);
    setMode('drill');
    setView('practice');
    const nextTarget = buildTarget(
      data,
      'drill',
      selectedSourceId,
      completionKind,
      setCount,
      minutes,
      drillId,
    );
    resetMachine(nextTarget);
    setSessionActive(true);
  }

  function chooseOneHandSide(side: OneHandSide) {
    setOneHandSide(side);
    if (mode !== 'one-hand') return;
    const nextTarget = buildTarget(
      data,
      'one-hand',
      selectedSourceId,
      completionKind,
      setCount,
      minutes,
      selectedDrillId,
      side,
    );
    resetMachine(nextTarget);
  }

  function startOneHandDrill(side: OneHandSide) {
    setOneHandSide(side);
    setMode('one-hand');
    setView('practice');
    const nextTarget = buildTarget(
      data,
      'one-hand',
      selectedSourceId,
      completionKind,
      setCount,
      minutes,
      selectedDrillId,
      side,
    );
    resetMachine(nextTarget);
    setSessionActive(true);
  }

  const completeSession = useCallback(
    async (
      finalText: string,
      finalEvents: TypingEvent[],
      completedAt = Date.now(),
      forceFinish = false,
    ) => {
      if (finishedRef.current || !startedAtRef.current) return;
      const currentCorrect = finalText
        .split('')
        .filter(
          (character, index) => character === target.content[index],
        ).length;
      const studyRounds = target.studyRounds;
      if (
        mode === 'lesson' &&
        studyRounds &&
        studyRoundIndex < studyRounds.length - 1
      ) {
        roundTransitionRef.current = true;
        const completedEvents = [
          ...studyCompletedEventsRef.current,
          ...finalEvents,
        ];
        const completedCorrect =
          studyCompletedCorrectCharactersRef.current + currentCorrect;
        const nextRoundIndex = studyRoundIndex + 1;
        completedBurstSegmentsRef.current.push({
          text: target.content,
          finalText,
          events: finalEvents,
        });
        studyCompletedEventsRef.current = completedEvents;
        studyCompletedTextRef.current += finalText;
        studyCompletedCorrectCharactersRef.current = completedCorrect;
        setStudyCompletedEvents(completedEvents);
        setStudyCompletedCorrectCharacters(completedCorrect);
        setStudyRoundIndex(nextRoundIndex);
        setTarget((current) => ({
          ...current,
          content: studyRounds[nextRoundIndex],
        }));
        setTyped('');
        typedRef.current = '';
        commitCursor(0);
        setEvents([]);
        eventsRef.current = [];
        lastKeyAtRef.current = null;
        setNow(completedAt);
        setInputNotice(
          `Round ${nextRoundIndex + 1} of ${studyRounds.length} · keep the same calm rhythm.`,
        );
        window.requestAnimationFrame(() => {
          roundTransitionRef.current = false;
          focusTyping();
        });
        return;
      }

      const practicePhases = target.practicePhases;
      if (
        !forceFinish &&
        mode === 'study' &&
        practicePhases &&
        practicePhaseIndex < practicePhases.length - 1
      ) {
        roundTransitionRef.current = true;
        const completedEvents = [
          ...practiceCompletedEventsRef.current,
          ...finalEvents,
        ];
        const completedCorrect =
          practiceCompletedCorrectCharactersRef.current + currentCorrect;
        const nextPhaseIndex = practicePhaseIndex + 1;
        const nextPhase = practicePhases[nextPhaseIndex];
        completedBurstSegmentsRef.current.push({
          text: target.content,
          finalText,
          events: finalEvents,
        });
        practiceCompletedEventsRef.current = completedEvents;
        practiceCompletedTextRef.current += finalText;
        practiceCompletedCorrectCharactersRef.current = completedCorrect;
        setPracticeCompletedEvents(completedEvents);
        setPracticeCompletedCorrectCharacters(completedCorrect);
        setPracticePhaseIndex(nextPhaseIndex);
        setTarget((current) => ({
          ...current,
          content: nextPhase.content,
        }));
        setTyped('');
        typedRef.current = '';
        commitCursor(0);
        setEvents([]);
        eventsRef.current = [];
        lastKeyAtRef.current = null;
        activeLineRef.current = null;
        if (typingCopyScrollRef.current) {
          typingCopyScrollRef.current.scrollTop = 0;
        }
        setNow(completedAt);
        setInputNotice(
          nextPhase.language === 'English'
            ? 'Thai part complete · switch to English (US).'
            : `Set ${nextPhase.setNumber} · continue with the Thai part.`,
        );
        window.requestAnimationFrame(() => {
          roundTransitionRef.current = false;
          focusTyping();
        });
        return;
      }

      finishedRef.current = true;
      const localDuration = Math.max(1_000, completedAt - startedAtRef.current);
      const isMultiPhasePractice =
        mode === 'study' && Boolean(practicePhases?.length);
      const sessionEvents =
        mode === 'lesson'
          ? [...studyCompletedEventsRef.current, ...finalEvents]
          : isMultiPhasePractice
            ? [...practiceCompletedEventsRef.current, ...finalEvents]
            : finalEvents;
      const expectedText =
        mode === 'lesson' && studyRounds
          ? studyRounds.join('')
          : isMultiPhasePractice
            ? practicePhases!.map((phase) => phase.content).join('')
            : target.content;
      const finalSessionText =
        mode === 'lesson'
          ? studyCompletedTextRef.current + finalText
          : isMultiPhasePractice
            ? practiceCompletedTextRef.current + finalText
            : finalText;
      const completedPracticePassageIds =
        mode === 'study'
          ? (target.passageSegments ?? [])
              .filter((segment) => finalSessionText.length >= segment.endOffset)
              .map((segment) => segment.passageId)
          : [];
      const insertions = sessionEvents.filter(
        (event) => event.action === 'insert',
      );
      const correctInsertions = insertions.filter(
        (event) => event.correct,
      ).length;
      const rawErrors = insertions.length - correctInsertions;
      const corrections = sessionEvents.filter(
        (event) => event.action !== 'insert',
      ).length;
      const finalCorrect = finalSessionText
        .split('')
        .filter((character, index) => character === expectedText[index]).length;
      const localResult: SessionResult = {
        wpm: Math.max(
          0,
          Math.round(finalCorrect / 5 / (localDuration / 60_000)),
        ),
        accuracy: insertions.length
          ? Math.floor((correctInsertions / insertions.length) * 100)
          : 100,
        language: computeSessionLanguageMetrics(sessionEvents),
        rawErrors,
        corrections,
        durationMs: localDuration,
        topErrors: summarizeSessionErrors(sessionEvents),
        burstHeatmap: buildBurstHeatmap([
          ...completedBurstSegmentsRef.current,
          { text: target.content, finalText, events: finalEvents },
        ]),
        saved: false,
        studyPassed:
          mode === 'lesson'
            ? (insertions.length
                ? Math.floor((correctInsertions / insertions.length) * 100)
                : 100) >= STUDY_PASS_ACCURACY
            : undefined,
      };
      setResult(localResult);
      setNow(completedAt);

      try {
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passageId: target.passageId,
            studyLessonId: target.studyLessonId,
            benchmarkFormId:
              mode === 'benchmark' ? target.benchmarkFormId : null,
            benchmarkBaselineId:
              mode === 'benchmark' ? target.benchmarkBaselineId : null,
            mode,
            expectedText,
            finalText: finalSessionText,
            events: sessionEvents,
            startedAt: startedAtRef.current,
            completedAt,
            completionKind,
            completedPracticePassageIds,
          }),
        });
        const payload = (await response.json()) as Omit<
          SessionResult,
          'topErrors' | 'burstHeatmap' | 'saved'
        > & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(payload.error || 'Unable to save this session.');
        setResult({ ...localResult, ...payload, saved: true });
        await refreshData();
      } catch (error) {
        setDataError(
          error instanceof Error
            ? error.message
            : 'The session finished but could not be saved.',
        );
      }
    },
    [
      completionKind,
      mode,
      commitCursor,
      focusTyping,
      refreshData,
      practicePhaseIndex,
      studyRoundIndex,
      target.content,
      target.passageId,
      target.passageSegments,
      target.practicePhases,
      target.studyRounds,
      target.studyLessonId,
      target.benchmarkFormId,
      target.benchmarkBaselineId,
    ],
  );

  useEffect(() => {
    if (!startedAt || result || isPaused) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [isPaused, result, startedAt]);

  useEffect(() => {
    if (
      completionKind !== 'time' ||
      !startedAt ||
      isPaused ||
      result ||
      now - startedAt < minutes * 60_000
    ) {
      return;
    }
    void completeSession(typedRef.current, eventsRef.current, now, true);
  }, [
    completeSession,
    completionKind,
    isPaused,
    minutes,
    now,
    result,
    startedAt,
  ]);

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: {
              name: string;
              title: string;
              description: string;
              inputSchema: object;
              annotations: {
                readOnlyHint: boolean;
                untrustedContentHint: boolean;
              };
              execute: (input: unknown) => unknown;
            },
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();

    try {
      void Promise.resolve(
        modelContext.registerTool(
          {
            name: 'read_practice_summary',
            title: 'Read practice summary',
            description:
              'Read the current local typing progress, source count, streak, and top weakness without changing the app.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: () => ({
              sources: data.sources.length,
              passages: data.passages.length,
              sessions: data.analytics.totalSessions,
              averageWpm: data.analytics.averageWpm,
              averageAccuracy: data.analytics.averageAccuracy,
              streak: data.analytics.streak,
              topWeakness: data.analytics.weaknesses[0] ?? null,
            }),
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);

      void Promise.resolve(
        modelContext.registerTool(
          {
            name: 'start_typing_practice',
            title: 'Start typing practice',
            description:
              'Open and prepare a visible Study, Practice, Weakness Drill, One-hand Drill, or Benchmark session. The session is not recorded until the user types.',
            inputSchema: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  enum: ['study', 'practice', 'drill', 'one-hand', 'benchmark'],
                },
              },
              required: ['mode'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: (input: unknown) => {
              const requestedMode = (input as { mode?: unknown })?.mode;
              const nextMode =
                requestedMode === 'study'
                  ? 'lesson'
                  : requestedMode === 'practice'
                    ? 'study'
                    : requestedMode;
              if (
                nextMode !== 'lesson' &&
                nextMode !== 'study' &&
                nextMode !== 'drill' &&
                nextMode !== 'one-hand' &&
                nextMode !== 'benchmark'
              ) {
                throw new Error(
                  'mode must be study, practice, drill, one-hand, or benchmark',
                );
              }
              prepareTarget(nextMode);
              return { status: 'ready', mode: requestedMode };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      return;
    }

    return () => lifecycle.abort();
  }, [data, prepareTarget]);

  const elapsedMs = startedAt ? Math.max(0, now - startedAt) : 0;
  const remainingMs =
    completionKind === 'time'
      ? Math.max(0, minutes * 60_000 - elapsedMs)
      : null;
  const isMultiPhasePractice =
    mode === 'study' && Boolean(target.practicePhases?.length);
  const liveSessionEvents =
    mode === 'lesson'
      ? [...studyCompletedEvents, ...events]
      : isMultiPhasePractice
        ? [...practiceCompletedEvents, ...events]
        : events;
  const insertions = liveSessionEvents.filter(
    (event) => event.action === 'insert',
  );
  const correctInsertions = insertions.filter((event) => event.correct).length;
  const liveErrors = insertions.length - correctInsertions;
  const correctCharacters =
    (mode === 'lesson'
      ? studyCompletedCorrectCharacters
      : isMultiPhasePractice
        ? practiceCompletedCorrectCharacters
        : 0) +
    typed
      .split('')
      .filter((character, index) => character === target.content[index]).length;
  const liveWpm = startedAt
    ? Math.max(
        0,
        Math.round(
          correctCharacters / 5 / Math.max(elapsedMs / 60_000, 1 / 60),
        ),
      )
    : 0;
  const liveAccuracy = insertions.length
    ? Math.floor((correctInsertions / insertions.length) * 100)
    : 100;
  const nextCharacter = target.content[cursor] ?? '';
  const activePracticePhase =
    mode === 'study' ? target.practicePhases?.[practicePhaseIndex] : undefined;
  const activeStudyLesson =
    mode === 'lesson' ? getStudyLesson(target.studyLessonId) : undefined;
  const activePracticeLanguage =
    activeStudyLesson?.language === 'thai'
      ? 'Thai'
      : (activePracticePhase?.language ?? 'English');
  const activeKeyboardLayout = keyboardLayoutAt(
    target.content,
    cursor,
    mode === 'study' || mode === 'lesson' ? activePracticeLanguage : 'English',
  );
  const typingDisplayUnits = buildTypingDisplayUnits(target.content, typed);
  const instruction = fingerInstruction(nextCharacter, activeKeyboardLayout);
  if (mode === 'one-hand' && nextCharacter === ' ') {
    instruction.finger = `${oneHandSide === 'left' ? 'Left' : 'Right'} thumb`;
  }
  const nextKeyDefinition = keyForCharacter(
    nextCharacter,
    activeKeyboardLayout,
  )?.key;
  const shiftHand =
    instruction.shifted && nextKeyDefinition
      ? nextKeyDefinition.finger.startsWith('L')
        ? 'right'
        : 'left'
      : null;
  const latestDebugKey =
    debugPanel.latestRaw?.key === ' ' ? 'Space' : debugPanel.latestRaw?.key;
  const progressMetrics =
    progressScope === 'overall'
      ? {
          totalSessions: data.analytics.totalSessions,
          averageWpm: data.analytics.averageWpm,
          averageAccuracy: data.analytics.averageAccuracy,
          bestWpm: data.analytics.bestWpm,
          daily: data.analytics.daily,
        }
      : (data.analytics.language?.[progressScope] ??
        EMPTY_ANALYTICS.language[progressScope]);
  const progressScopeLabel =
    progressScope === 'overall'
      ? 'Overall'
      : progressScope === 'thai'
        ? 'Thai'
        : 'English';
  const progressChartData = progressMetrics.daily.map((day) => ({
    ...day,
    wpm: day.sessions > 0 ? day.wpm : null,
    accuracy: day.sessions > 0 ? day.accuracy : null,
  }));
  const regularSessionHistory = data.sessions.filter(
    (session) => session.mode !== 'benchmark' && session.mode !== 'speed-drill',
  );
  const studyProgressById = new Map(
    data.studyProgress.map((progress) => [progress.lessonId, progress]),
  );
  const activeStudyCourse = getStudyCourse(studyLanguage);
  const studyLevels = activeStudyCourse.levels;
  const studyLessons = activeStudyCourse.lessons;
  const studyLessonIds = new Set(studyLessons.map((lesson) => lesson.id));
  const currentStudyIndex = getCurrentStudyIndex(data, studyLanguage);
  const currentStudyLesson = studyLessons[currentStudyIndex];
  const passedStudyLessons = data.studyProgress.filter(
    (progress) =>
      progress.passedAt !== null && studyLessonIds.has(progress.lessonId),
  ).length;
  const studyCompletion = Math.round(
    (passedStudyLessons / studyLessons.length) * 100,
  );
  const latestBaseline = data.benchmark.sessions.find(
    (session) => !session.benchmarkBaselineId,
  );
  const latestComparison = data.benchmark.comparisons.find(
    (comparison) => comparison.baselineId === latestBaseline?.id,
  );
  const latestRetest = latestComparison
    ? data.benchmark.sessions.find((session) => session.id === latestComparison.sessionId)
    : undefined;
  const currentResultSlowWords = result?.burstHeatmap.words
    .filter(
      (word) =>
        word.script === 'latin' &&
        (word.tone === 'slow' || word.tone === 'lagging') &&
        word.errors === 0 &&
        word.corrections === 0 &&
        word.text.length >= 3,
    )
    .sort((left, right) => (right.msPerKey ?? 0) - (left.msPerKey ?? 0))
    .map((word) => word.text.toLowerCase()) ?? [];
  const availableSlowWords = data.benchmark.slowWords.length
    ? data.benchmark.slowWords.map((item) => item.word)
    : [...new Set(currentResultSlowWords)];
  const nextResultAction = getNextResultAction(
    mode,
    target,
    availableSlowWords.length > 0,
  );

  function navigateToView(nextView: View) {
    if (nextView === 'practice' && (mode === 'benchmark' || mode === 'speed-drill')) {
      prepareTarget('study');
      return;
    }
    setView(nextView);
  }

  function appendEvent(event: TypingEvent) {
    const next = [...eventsRef.current, event];
    eventsRef.current = next;
    setEvents(next);
  }

  function beginIfNeeded(timestamp: number) {
    if (startedAtRef.current) return;
    startedAtRef.current = timestamp;
    setStartedAt(timestamp);
    setNow(timestamp);
  }

  function keyboardModifiers(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    return [
      event.metaKey ? 'Meta' : '',
      event.ctrlKey ? 'Control' : '',
      event.altKey ? 'Alt' : '',
      event.shiftKey ? 'Shift' : '',
    ].filter(Boolean);
  }

  function captureKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (!debugEnabledRef.current || debugFrozenRef.current) return;
    const eventId = ++debugEventIdRef.current;
    activeDebugEventIdRef.current = eventId;
    recordDebug({
      phase: 'raw',
      event: 'keydown',
      eventId,
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      composing: event.nativeEvent.isComposing,
      modifiers: keyboardModifiers(event),
    });
  }

  function captureKeyUp(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    recordDebug({
      phase: 'raw',
      event: 'keyup',
      eventId: activeDebugEventIdRef.current,
      key: event.key,
      code: event.code,
      repeat: event.repeat,
      composing: event.nativeEvent.isComposing,
      modifiers: keyboardModifiers(event),
    });
    if (lastKeyDownInsertRef.current?.key === event.key) {
      lastKeyDownInsertRef.current = null;
    }
    activeDebugEventIdRef.current = undefined;
  }

  function captureTextInput(eventName: string, nativeEvent: InputEvent) {
    recordDebug({
      phase: 'raw',
      event: eventName,
      eventId: activeDebugEventIdRef.current,
      inputType: nativeEvent.inputType,
      data: nativeEvent.data,
      composing: nativeEvent.isComposing,
    });
  }

  function captureComposition(
    eventName: string,
    nativeEvent: CompositionEvent,
  ) {
    recordDebug({
      phase: 'raw',
      event: eventName,
      eventId: activeDebugEventIdRef.current,
      data: nativeEvent.data,
    });
  }

  function toggleDebug() {
    if (debugEnabledRef.current) {
      recordDebug({ phase: 'lifecycle', event: 'debug-disabled' });
      debugEnabledRef.current = false;
      debugFrozenRef.current = false;
      setDebugEnabled(false);
      setDebugFrozen(false);
      setDebugCopyStatus('');
    } else {
      debugRecordsRef.current = [];
      debugSequenceRef.current = 0;
      debugEventIdRef.current = 0;
      activeDebugEventIdRef.current = undefined;
      debugStartedAtRef.current = performance.now();
      debugEnabledRef.current = true;
      debugFrozenRef.current = false;
      setDebugEnabled(true);
      setDebugFrozen(false);
      setDebugPanel({ count: 0 });
      setDebugCopyStatus('');
      recordDebug({ phase: 'lifecycle', event: 'debug-enabled' });
    }
    window.setTimeout(focusTyping, 0);
  }

  function toggleDebugFrozen() {
    if (debugFrozenRef.current) {
      debugFrozenRef.current = false;
      setDebugFrozen(false);
      setDebugCopyStatus('');
      recordDebug({ phase: 'lifecycle', event: 'debug-resumed' });
    } else {
      recordDebug({ phase: 'lifecycle', event: 'debug-frozen' });
      debugFrozenRef.current = true;
      setDebugFrozen(true);
    }
    window.setTimeout(focusTyping, 0);
  }

  function buildDebugLog() {
    return JSON.stringify(
      {
        format: 'type-practice-typing-debug-v1',
        capturedAt: new Date().toISOString(),
        environment: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          fullscreen: Boolean(document.fullscreenElement),
        },
        practice: {
          mode,
          completionKind,
          targetLength: target.content.length,
        },
        records: debugRecordsRef.current,
      },
      null,
      2,
    );
  }

  async function copyDebugLog() {
    try {
      await navigator.clipboard.writeText(buildDebugLog());
      setDebugCopyStatus('Copied. Paste the JSON into this chat.');
    } catch {
      setDebugCopyStatus('Clipboard was blocked. Download the JSON instead.');
    }
    window.setTimeout(focusTyping, 0);
  }

  function downloadDebugLog() {
    const blob = new Blob([buildDebugLog()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `type-practice-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDebugCopyStatus('Downloaded. Attach the JSON file in this chat.');
    window.setTimeout(focusTyping, 0);
  }

  function clearDebugLog() {
    debugRecordsRef.current = [];
    debugSequenceRef.current = 0;
    debugEventIdRef.current = 0;
    activeDebugEventIdRef.current = undefined;
    debugStartedAtRef.current = performance.now();
    setDebugPanel({ count: 0 });
    setDebugCopyStatus('Log cleared.');
    window.setTimeout(focusTyping, 0);
  }

  function insertCharacter(
    character: string,
    source: 'keydown' | 'input',
    eventId: number | undefined,
  ) {
    const logDecision = (value: string) =>
      recordDebug({
        phase: 'handler',
        event: `${source}-decision`,
        eventId,
        key: source === 'keydown' ? character : undefined,
        data: source === 'input' ? character : undefined,
        decision: value,
      });

    if (result || finishedRef.current) {
      logDecision('ignored:session-complete');
      return false;
    }
    if (roundTransitionRef.current) {
      logDecision('ignored:round-transition');
      return false;
    }
    if (isPaused) {
      logDecision('ignored:session-paused');
      return false;
    }
    if (Array.from(character).length !== 1) {
      logDecision('ignored:unsupported-text');
      return false;
    }
    if (typedRef.current.length >= target.content.length + 24) {
      logDecision('ignored:length-limit');
      return false;
    }

    const timestamp = Date.now();
    const latencyMs = lastKeyAtRef.current
      ? timestamp - lastKeyAtRef.current
      : 0;
    const currentCursor = cursorRef.current;
    const expected = target.content[currentCursor] ?? '';
    const next = `${typedRef.current.slice(0, currentCursor)}${character}${typedRef.current.slice(currentCursor)}`;

    beginIfNeeded(timestamp);
    typedRef.current = next;
    setTyped(next);
    commitCursor(currentCursor + character.length);
    lastKeyAtRef.current = timestamp;

    const nextEvent: TypingEvent = {
      action: 'insert',
      key: character,
      expected,
      position: currentCursor,
      correct: character === expected,
      atMs: timestamp - (startedAtRef.current ?? timestamp),
      latencyMs,
    };
    const nextEvents = [...eventsRef.current, nextEvent];
    eventsRef.current = nextEvents;
    setEvents(nextEvents);
    logDecision(`accepted:insert:${source}`);
    recordDebug({
      phase: 'state',
      event: 'sync-commit',
      eventId,
      decision: `after:insert:${source}`,
    });
    recordRenderedState(eventId, `after:insert:${source}`);

    const hasNextPracticePhase =
      mode === 'study' &&
      Boolean(target.practicePhases?.[practicePhaseIndex + 1]);
    if (
      currentCursor + character.length >= target.content.length &&
      (completionKind === 'sets' || hasNextPracticePhase)
    ) {
      void completeSession(next, nextEvents, timestamp);
    }
    return true;
  }

  function handleInputFallback(
    event: ReactSyntheticEvent<HTMLTextAreaElement, InputEvent>,
  ) {
    const nativeEvent = event.nativeEvent as InputEvent;
    const eventId = activeDebugEventIdRef.current;
    const logDecision = (value: string) =>
      recordDebug({
        phase: 'handler',
        event: 'input-decision',
        eventId,
        inputType: nativeEvent.inputType,
        data: nativeEvent.data,
        decision: value,
      });

    if (nativeEvent.inputType !== 'insertText') {
      logDecision(`ignored:input-type:${nativeEvent.inputType || 'unknown'}`);
      return;
    }

    if (nativeEvent.isComposing || !nativeEvent.data) {
      setInputNotice(
        'Finish composing the current character, then keep typing.',
      );
      logDecision('ignored:composition-or-empty-data');
      return;
    }

    const recentKeyDown = lastKeyDownInsertRef.current;
    if (
      recentKeyDown?.key === nativeEvent.data &&
      performance.now() - recentKeyDown.at < 48
    ) {
      logDecision('ignored:duplicate-keydown');
      return;
    }

    setInputNotice('');
    insertCharacter(nativeEvent.data, 'input', eventId);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    const eventId = activeDebugEventIdRef.current;
    const decision = (value: string) =>
      recordDebug({
        phase: 'handler',
        event: 'keydown-decision',
        eventId,
        key: event.key,
        code: event.code,
        decision: value,
      });

    if (result) {
      decision('ignored:session-complete');
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      decision('ignored:modifier');
      return;
    }

    if (
      event.nativeEvent.isComposing ||
      event.key === 'Process' ||
      event.key === 'Dead'
    ) {
      setInputNotice(
        'Finish composing the current character, then keep typing.',
      );
      decision('ignored:composition-or-dead-key');
      return;
    }
    if (event.key.length === 1) setInputNotice('');

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      commitCursor(Math.max(0, cursorRef.current - 1));
      decision('accepted:navigate-left');
      recordRenderedState(eventId, 'after:navigate-left');
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      commitCursor(Math.min(typedRef.current.length, cursorRef.current + 1));
      decision('accepted:navigate-right');
      recordRenderedState(eventId, 'after:navigate-right');
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      commitCursor(0);
      decision('accepted:navigate-home');
      recordRenderedState(eventId, 'after:navigate-home');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      commitCursor(typedRef.current.length);
      decision('accepted:navigate-end');
      recordRenderedState(eventId, 'after:navigate-end');
      return;
    }

    const timestamp = Date.now();
    const latencyMs = lastKeyAtRef.current
      ? timestamp - lastKeyAtRef.current
      : 0;

    const currentCursor = cursorRef.current;

    if (event.key === 'Backspace' && currentCursor > 0) {
      event.preventDefault();
      beginIfNeeded(timestamp);
      const position = currentCursor - 1;
      const removed = typedRef.current[position] ?? '';
      const next = `${typedRef.current.slice(0, position)}${typedRef.current.slice(currentCursor)}`;
      typedRef.current = next;
      setTyped(next);
      commitCursor(position);
      lastKeyAtRef.current = timestamp;
      appendEvent({
        action: 'backspace',
        key: removed,
        expected: target.content[position] ?? '',
        position,
        correct: removed === target.content[position],
        atMs: timestamp - (startedAtRef.current ?? timestamp),
        latencyMs,
      });
      decision('accepted:backspace');
      recordDebug({
        phase: 'state',
        event: 'sync-commit',
        eventId,
        decision: 'after:backspace',
      });
      recordRenderedState(eventId, 'after:backspace');
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      decision('ignored:backspace-boundary');
      return;
    }

    if (event.key === 'Delete' && currentCursor < typedRef.current.length) {
      event.preventDefault();
      beginIfNeeded(timestamp);
      const removed = typedRef.current[currentCursor] ?? '';
      const next = `${typedRef.current.slice(0, currentCursor)}${typedRef.current.slice(currentCursor + 1)}`;
      typedRef.current = next;
      setTyped(next);
      lastKeyAtRef.current = timestamp;
      appendEvent({
        action: 'delete',
        key: removed,
        expected: target.content[currentCursor] ?? '',
        position: currentCursor,
        correct: removed === target.content[currentCursor],
        atMs: timestamp - (startedAtRef.current ?? timestamp),
        latencyMs,
      });
      decision('accepted:delete');
      recordDebug({
        phase: 'state',
        event: 'sync-commit',
        eventId,
        decision: 'after:delete',
      });
      recordRenderedState(eventId, 'after:delete');
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      decision('ignored:delete-boundary');
      return;
    }

    if (event.key.length !== 1) {
      decision('ignored:non-character');
      return;
    }
    event.preventDefault();
    lastKeyDownInsertRef.current = {
      key: event.key,
      at: performance.now(),
    };
    insertCharacter(event.key, 'keydown', eventId);
  }

  function openSourcePicker() {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.click();
      }
    } catch {
      input.click();
    }
  }

  async function importFiles(fileList?: FileList | File[]) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    setImportState('reading');
    setImportMessage('');
    setImportResults([]);
    setSourceNotice(null);
    setImportState('importing');

    const results: ImportResultItem[] = [];
    let lastImportedSelection = '';
    for (const [index, file] of files.entries()) {
      setImportMessage(
        `Importing ${index + 1} of ${files.length}: ${file.name}`,
      );
      if (!file.name.toLowerCase().endsWith('.md')) {
        results.push({
          filename: file.name,
          status: 'error',
          message: 'Not a Markdown (.md) file.',
          importedSets: 0,
          duplicateSets: 0,
        });
        setImportResults([...results]);
        continue;
      }

      try {
        const markdown = await file.text();
        const response = await fetch('/api/sources/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, markdown }),
        });
        const payload = (await response.json()) as {
          code?: string;
          error?: string;
          importedSetCount?: number;
          duplicateSetCount?: number;
          source?: {
            id: string;
            passageCount: number;
            title: string;
            collectionId?: string;
            collectionTitle?: string;
            partTitle?: string;
          } | null;
        };
        const duplicateSets = payload.duplicateSetCount ?? 0;

        if (payload.code === 'DUPLICATE_FILE') {
          results.push({
            filename: file.name,
            status: 'skipped',
            message: 'Exact duplicate file; nothing was imported.',
            importedSets: 0,
            duplicateSets: 0,
          });
        } else if (!response.ok) {
          results.push({
            filename: file.name,
            status: 'error',
            message: payload.error || 'Unable to import this file.',
            importedSets: 0,
            duplicateSets,
          });
        } else if (!payload.source) {
          results.push({
            filename: file.name,
            status: 'skipped',
            message: `All ${duplicateSets} sets already exist; nothing was imported.`,
            importedSets: 0,
            duplicateSets,
          });
        } else {
          const importedSets =
            payload.importedSetCount ?? payload.source.passageCount;
          lastImportedSelection = payload.source.collectionId
            ? `collection:${payload.source.collectionId}`
            : payload.source.id;
          results.push({
            filename: file.name,
            status: 'imported',
            message:
              duplicateSets > 0
                ? `${importedSets} sets imported; ${duplicateSets} duplicate sets skipped.`
                : `${importedSets} sets imported successfully.`,
            importedSets,
            duplicateSets,
          });
        }
      } catch (error) {
        results.push({
          filename: file.name,
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to read or import this file.',
          importedSets: 0,
          duplicateSets: 0,
        });
      }
      setImportResults([...results]);
    }

    const importedFiles = results.filter(
      (result) => result.status === 'imported',
    ).length;
    const skippedFiles = results.filter(
      (result) => result.status === 'skipped',
    ).length;
    const failedFiles = results.filter(
      (result) => result.status === 'error',
    ).length;
    const importedSets = results.reduce(
      (sum, result) => sum + result.importedSets,
      0,
    );
    const duplicateSets = results.reduce(
      (sum, result) => sum + result.duplicateSets,
      0,
    );

    if (importedFiles > 0) {
      const refreshed = await refreshData();
      setSelectedSourceId(lastImportedSelection);
      setSelectedPassageId('');
      setTarget(
        buildTarget(
          refreshed,
          'study',
          lastImportedSelection,
          'sets',
          1,
          1,
          'combined',
          'right',
          showStarterSource,
          '',
          practiceLanguage,
        ),
      );
    }

    const hasWarnings =
      skippedFiles > 0 || failedFiles > 0 || duplicateSets > 0;
    setImportState(
      failedFiles > 0 && importedFiles === 0
        ? 'error'
        : hasWarnings
          ? 'warning'
          : 'success',
    );
    setImportMessage(
      `${files.length} files processed · ${importedFiles} imported · ${importedSets} sets added · ${skippedFiles} files skipped · ${failedFiles} failed${duplicateSets > 0 ? ` · ${duplicateSets} duplicate sets skipped` : ''}`,
    );
    setImportResults(results);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function confirmDeleteSource() {
    if (!deleteTarget) return;
    setDeleteState('deleting');
    setSourceNotice(null);
    try {
      const response = await fetch('/api/sources/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          deleteTarget.kind === 'collection'
            ? { collectionId: deleteTarget.id }
            : { sourceId: deleteTarget.id },
        ),
      });
      const payload = (await response.json()) as {
        error?: string;
        deletedPartCount?: number;
        deletedSetCount?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to delete this source.');
      }
      if (
        selectedSourceId === deleteTarget.id ||
        selectedSourceId === `collection:${deleteTarget.id}`
      ) {
        setSelectedSourceId('');
      }
      setSelectedPassageId('');
      await refreshData();
      setSourceNotice({
        tone: 'success',
        message: `Deleted “${deleteTarget.title}”: ${payload.deletedPartCount ?? deleteTarget.partCount} part(s) and ${payload.deletedSetCount ?? deleteTarget.setCount} set(s). Session statistics were kept.`,
      });
      setDeleteTarget(null);
    } catch (error) {
      setSourceNotice({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to delete this source.',
      });
    } finally {
      setDeleteState('idle');
    }
  }

  async function copySourcePrompt() {
    try {
      await navigator.clipboard.writeText(SOURCE_TO_MARKDOWN_PROMPT);
      setSourcePromptCopyStatus('copied');
      window.setTimeout(() => setSourcePromptCopyStatus('idle'), 2400);
    } catch {
      setSourcePromptCopyStatus('error');
      setShowSourcePrompt(true);
    }
  }

  const navigation: Array<{
    view: View;
    label: string;
    icon: typeof BookOpen;
  }> = [
    { view: 'study', label: 'Study', icon: Trophy },
    { view: 'practice', label: 'Practice', icon: BookOpen },
    { view: 'benchmark', label: 'Benchmark', icon: Gauge },
    { view: 'sources', label: 'Sources', icon: FileText },
    { view: 'progress', label: 'Progress', icon: BarChart3 },
    { view: 'weaknesses', label: 'Weaknesses', icon: Target },
  ];
  const sourceGroups = buildSourceGroups(data.sources);
  const hasStarterSource = data.sources.some(isStarterSource);
  const hasNonStarterSource = data.sources.some(
    (source) => !isStarterSource(source),
  );
  const starterIsHidden =
    hasStarterSource && hasNonStarterSource && !showStarterSource;
  const visibleSourceGroups = starterIsHidden
    ? sourceGroups.filter(
        (group) => !group.sources.every((source) => isStarterSource(source)),
      )
    : sourceGroups;
  const visibleSourceIds = new Set(
    visibleSourceGroups.flatMap((group) =>
      group.sources.map((source) => source.id),
    ),
  );
  const visiblePassageCount = data.passages.filter((passage) =>
    visibleSourceIds.has(passage.sourceId),
  ).length;
  const selectablePracticePassages = orderedPracticePassages(
    data,
    selectedSourceId,
    showStarterSource,
    practiceLanguage,
  );
  const completedPracticePassageIds = new Set(
    data.practiceProgress.map((progress) => progress.passageId),
  );
  const automaticPracticePassage =
    selectablePracticePassages.find(
      (passage) => !completedPracticePassageIds.has(passage.id),
    ) ?? selectablePracticePassages[0];
  const launchTarget =
    !sessionActive && mode === 'study'
      ? buildTarget(
          data,
          'study',
          selectedSourceId,
          completionKind,
          setCount,
          minutes,
          selectedDrillId,
          oneHandSide,
          showStarterSource,
          selectedPassageId,
          practiceLanguage,
        )
      : target;
  const isImportingSources =
    importState === 'reading' || importState === 'importing';

  return (
    <main
      className={`min-h-screen bg-background text-foreground ${
        sessionActive ? 'typing-session-shell' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".md,text/markdown,text/plain"
        className="sr-only"
        onChange={(event) => void importFiles(event.currentTarget.files ?? [])}
      />

      {!sessionActive && (
        <header className="sticky top-0 z-30 border-b border-white/8 bg-[#0b1118]/92 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
            <AppLogo />
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 rounded-full border border-orange-300/15 bg-orange-300/8 px-3 py-1.5 text-xs text-orange-200">
                <Flame size={14} />
                <span className="font-mono font-semibold">
                  {data.analytics.streak} day streak
                </span>
              </div>
              <span
                className={`h-2 w-2 rounded-full ${
                  dataState === 'ready'
                    ? 'bg-emerald-400'
                    : dataState === 'error'
                      ? 'bg-rose-400'
                      : 'animate-pulse bg-amber-300'
                }`}
                title={
                  dataState === 'ready'
                    ? 'SQLite connected'
                    : dataError || 'Connecting'
                }
              />
            </div>
          </div>
        </header>
      )}

      <div
        className={
          sessionActive
            ? 'min-h-screen'
            : 'mx-auto grid max-w-[1480px] grid-cols-1 xl:grid-cols-[214px_minmax(0,1fr)]'
        }
      >
        {!sessionActive && (
          <aside className="hidden min-h-[calc(100vh-64px)] border-r border-white/7 px-4 py-6 xl:block">
            <nav aria-label="Primary navigation" className="space-y-1">
              {navigation.map(({ view: itemView, label, icon: Icon }) => (
                <button
                  key={itemView}
                  onClick={() => navigateToView(itemView)}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm transition ${
                    view === itemView
                      ? 'bg-cyan-300/9 text-cyan-100'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                  {view === itemView && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  )}
                </button>
              ))}
            </nav>

            <div className="mt-8 border-t border-white/7 pt-6">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                Library
              </p>
              <button
                onClick={openSourcePicker}
                disabled={isImportingSources}
                className="mt-3 flex w-full items-center gap-3 rounded-[10px] border border-dashed border-white/12 px-3 py-3 text-left text-xs text-slate-400 transition hover:border-cyan-300/30 hover:text-cyan-200"
              >
                <Upload size={15} />
                Import .md files
              </button>
              <div className="mt-4 flex items-center justify-between px-3 text-xs text-slate-600">
                <span>{visibleSourceGroups.length} collections</span>
                <span>{visiblePassageCount} sets</span>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-white/7 bg-white/[0.025] p-4">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">Last 7 days</span>
                <span className="font-mono text-cyan-300">
                  {data.analytics.averageWpm || '—'} WPM
                </span>
              </div>
              <div
                className="flex h-10 items-end gap-1.5"
                aria-label="Seven day activity"
              >
                {Array.from({ length: 7 }, (_, index) => {
                  const day = data.analytics.daily.slice(-7)[index];
                  const max = Math.max(
                    ...data.analytics.daily.map((item) => item.wpm),
                    1,
                  );
                  return (
                    <span
                      key={day?.date ?? index}
                      className="flex-1 rounded-sm bg-cyan-300/25 last:bg-cyan-300/70"
                      style={{
                        height: `${day?.wpm ? Math.max(16, (day.wpm / max) * 100) : 8}%`,
                      }}
                      title={
                        day ? `${day.label}: ${day.wpm} WPM` : 'No session'
                      }
                    />
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0">
          {!sessionActive && (
            <nav
              aria-label="Mobile navigation"
              className="flex overflow-x-auto border-b border-white/7 px-4 xl:hidden"
            >
              {navigation.map(({ view: itemView, label, icon: Icon }) => (
                <button
                  key={itemView}
                    onClick={() => navigateToView(itemView)}
                  className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs ${
                    view === itemView
                      ? 'border-cyan-300 text-cyan-200'
                      : 'border-transparent text-slate-500'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </nav>
          )}

          {dataState === 'error' && !sessionActive && (
            <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200 sm:mx-8">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <div>
                <p className="font-medium">Local database is not ready</p>
                <p className="mt-1 text-xs text-rose-200/70">{dataError}</p>
              </div>
            </div>
          )}

          {view === 'study' && !sessionActive && (
            <section className="px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
              <div className="mx-auto max-w-[1040px]">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-slate-600">
                      Study course
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Progress and lesson unlocking are tracked separately for
                      each keyboard.
                    </p>
                  </div>
                  <fieldset className="inline-flex w-fit rounded-xl border border-white/8 bg-black/20 p-1">
                    <legend className="sr-only">Study language</legend>
                    {(
                      [
                        ['english', 'English · US QWERTY'],
                        ['thai', 'Thai · Kedmanee'],
                      ] as const
                    ).map(([language, label]) => (
                      <button
                        key={language}
                        type="button"
                        aria-pressed={studyLanguage === language}
                        onClick={() => chooseStudyLanguage(language)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          studyLanguage === language
                            ? 'bg-cyan-300/12 text-cyan-200 shadow-sm'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </fieldset>
                </div>
                <div className="mb-7 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
                  <article className="rounded-2xl border border-cyan-300/14 bg-[linear-gradient(135deg,rgba(103,232,249,.08),rgba(15,23,42,.2)_58%)] p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-300/18 bg-cyan-300/9 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
                        Guided study
                      </span>
                      <span className="text-xs text-slate-500">
                        {STUDY_PASS_ACCURACY}% accuracy to pass
                      </span>
                    </div>
                    {currentStudyLesson ? (
                      <>
                        <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-slate-500">
                          Current lesson · {currentStudyIndex + 1} of{' '}
                          {studyLessons.length}
                        </p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[30px]">
                          Level {currentStudyLesson.levelNumber} ·{' '}
                          {currentStudyLesson.title}
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                          {currentStudyLesson.focus}
                        </p>
                        <div className="mt-6 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              startStudyLesson(currentStudyLesson.id)
                            }
                            disabled={dataState === 'loading'}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
                          >
                            <Play size={16} fill="currentColor" /> Start current
                            lesson
                          </button>
                          <span className="font-mono text-xs text-slate-500">
                            {currentStudyLesson.rounds.length} rounds ·{' '}
                            {countStudyLessonCharacters(currentStudyLesson)}{' '}
                            characters total
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-emerald-300/75">
                          Course complete
                        </p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[30px]">
                          Every lesson is unlocked.
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                          You can replay any lesson below and improve your best
                          round.
                        </p>
                      </>
                    )}
                  </article>

                  <article className="rounded-2xl border border-white/7 bg-white/[0.025] p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                          Course progress
                        </p>
                        <p className="mt-2 font-mono text-3xl font-semibold text-white">
                          {studyCompletion}%
                        </p>
                      </div>
                      <Trophy
                        size={24}
                        className={
                          currentStudyLesson
                            ? 'text-slate-700'
                            : 'text-amber-200'
                        }
                      />
                    </div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/6">
                      <div
                        className="h-full rounded-full bg-cyan-300 transition-[width]"
                        style={{ width: `${studyCompletion}%` }}
                      />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <MetricCard
                        label="Passed"
                        value={passedStudyLessons}
                        detail={`of ${studyLessons.length} lessons`}
                      />
                      <MetricCard
                        label="Levels"
                        value={studyLevels.length}
                        detail="in sequence"
                      />
                    </div>
                  </article>
                </div>

                <div className="space-y-5">
                  {studyLevels.map((level, levelIndex) => (
                    <section
                      key={level.id}
                      className="overflow-hidden rounded-2xl border border-white/7 bg-white/[0.02]"
                    >
                      <header className="flex flex-col justify-between gap-2 border-b border-white/7 px-5 py-4 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300/65">
                            Level {levelIndex + 1}
                          </p>
                          <h2 className="mt-1 text-lg font-semibold text-slate-100">
                            {level.title}
                          </h2>
                        </div>
                        <p className="max-w-xl text-sm text-slate-500">
                          {level.description}
                        </p>
                      </header>

                      <div className="divide-y divide-white/6">
                        {level.lessons.map((lesson, lessonIndex) => {
                          const flatIndex = studyLessons.findIndex(
                            (item) => item.id === lesson.id,
                          );
                          const progress = studyProgressById.get(lesson.id);
                          const passed =
                            progress?.passedAt !== null && Boolean(progress);
                          const locked = flatIndex > currentStudyIndex;
                          const current = flatIndex === currentStudyIndex;
                          return (
                            <article
                              key={lesson.id}
                              className={`grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                                current ? 'bg-cyan-300/[0.035]' : ''
                              }`}
                            >
                              <div className="flex min-w-0 items-start gap-3.5">
                                <span
                                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-mono text-xs ${
                                    passed
                                      ? 'border-emerald-300/18 bg-emerald-300/8 text-emerald-200'
                                      : locked
                                        ? 'border-white/7 bg-white/[0.025] text-slate-700'
                                        : 'border-cyan-300/20 bg-cyan-300/9 text-cyan-200'
                                  }`}
                                >
                                  {passed ? (
                                    <Check size={15} />
                                  ) : locked ? (
                                    <Lock size={14} />
                                  ) : (
                                    lessonIndex + 1
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-medium text-slate-200">
                                      {lesson.title}
                                    </h3>
                                    {current && (
                                      <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                                        Current
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {lesson.focus} · {lesson.rounds.length}{' '}
                                    rounds ·{' '}
                                    {countStudyLessonCharacters(lesson)}{' '}
                                    characters total
                                  </p>
                                  <p className="mt-2 truncate font-mono text-sm text-slate-400">
                                    {lesson.checkpoint
                                      ? 'Level checkpoint'
                                      : lesson.rounds[0]}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-4 sm:justify-end">
                                {progress ? (
                                  <div className="text-left sm:text-right">
                                    <p className="font-mono text-sm text-slate-300">
                                      {progress.bestAccuracy}% ·{' '}
                                      {formatDuration(progress.bestDurationMs)}
                                    </p>
                                    <p className="mt-1 text-[11px] text-slate-600">
                                      Best attempt · {progress.attempts}{' '}
                                      {progress.attempts === 1
                                        ? 'attempt'
                                        : 'attempts'}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-700">
                                    No attempts
                                  </span>
                                )}
                                <button
                                  type="button"
                                  disabled={locked || dataState === 'loading'}
                                  onClick={() => startStudyLesson(lesson.id)}
                                  className="inline-flex h-9 min-w-20 items-center justify-center gap-2 rounded-lg border border-cyan-300/18 bg-cyan-300/8 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/14 disabled:cursor-not-allowed disabled:border-white/6 disabled:bg-transparent disabled:text-slate-700"
                                >
                                  {locked ? (
                                    <Lock size={13} />
                                  ) : (
                                    <Play size={13} />
                                  )}
                                  {passed
                                    ? 'Replay'
                                    : locked
                                      ? 'Locked'
                                      : 'Start'}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </section>
          )}

          {view === 'benchmark' && !sessionActive && (
            <section className="px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
              <div className="mx-auto max-w-[1040px] space-y-5">
                <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-cyan-300/80">
                      Measure → train → measure again
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-white sm:text-[30px]">
                      Benchmark
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      English typing on prepared, roughly matched passages. Forms rotate so a retest does not repeat its baseline text. This is separate from source-based Practice and general Progress.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startBenchmark()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                    >
                      <Gauge size={16} /> Start new baseline
                    </button>
                    {latestBaseline && (
                      <button
                        type="button"
                        onClick={() => startBenchmark(latestBaseline.id)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/12 px-4 text-sm font-medium text-slate-200 hover:bg-white/5"
                      >
                        <RotateCcw size={16} /> Re-benchmark
                      </button>
                    )}
                  </div>
                </header>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                    <h2 className="text-base font-semibold text-slate-100">Current baseline</h2>
                    {latestBaseline ? (
                      <div className="mt-4">
                        <p className="text-sm text-slate-400">
                          {getBenchmarkForm(latestBaseline.benchmarkFormId)?.title ?? latestBaseline.benchmarkFormId} · {new Date(latestBaseline.completedAt).toLocaleDateString()}
                        </p>
                        <p className="mt-2 font-mono text-xl text-cyan-200">
                          {latestBaseline.wpm} WPM <span className="text-slate-600">·</span> {latestBaseline.accuracy}% accuracy
                        </p>
                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          A new baseline starts a new comparison cycle. Drill sessions never change this score.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        No benchmark yet. Start a baseline to discover slow words.
                      </p>
                    )}
                  </section>
                  <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                    <h2 className="text-base font-semibold text-slate-100">Latest re-benchmark</h2>
                    {latestComparison && latestRetest ? (
                      <div className="mt-4">
                        <p className="font-mono text-xl text-slate-100">
                          {latestComparison.wpmDelta >= 0 ? '+' : ''}{latestComparison.wpmDelta} WPM <span className="text-slate-600">·</span> {latestComparison.accuracyDelta >= 0 ? '+' : ''}{latestComparison.accuracyDelta} pp accuracy
                        </p>
                        <p className="mt-2 text-sm text-slate-400">
                          {latestRetest.wpm} WPM · {latestRetest.accuracy}% accuracy · {new Date(latestRetest.completedAt).toLocaleDateString()}
                        </p>
                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          Slow-word check: {latestComparison.matchedWords > 0
                            ? `${latestComparison.fasterWords} of ${latestComparison.matchedWords} baseline slow words found in both forms were faster.`
                            : 'The forms have no shared baseline slow words with clean timing.'} This check is separate from the overall score.
                        </p>
                        {latestComparison.wpmDelta > 0 && latestComparison.accuracyDelta < 0 && (
                          <p className="mt-2 text-xs text-amber-200">
                            Faster with lower accuracy: review the trade-off before calling it progress.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">
                        Drill the slow words, then test on a different form to see the comparison here.
                      </p>
                    )}
                  </section>
                </div>

                <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-100">Slow words across benchmarks</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Clean word bursts only; corrected words are not ranked as slow. One appearance is provisional.
                      </p>
                    </div>
                    {data.benchmark.slowWords.length > 0 && (
                      <button
                        type="button"
                        onClick={() => startSpeedDrill(data.benchmark.slowWords.slice(0, 5).map((item) => item.word))}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/8 px-3 text-sm font-medium text-amber-100 hover:bg-amber-300/15"
                      >
                        <Play size={15} /> Drill top words
                      </button>
                    )}
                  </div>
                  {data.benchmark.slowWords.length ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {data.benchmark.slowWords.slice(0, 8).map((item) => (
                        <div key={item.word} className="flex items-center gap-3 rounded-lg border border-white/7 bg-black/15 px-3 py-2.5">
                          <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-100">{item.word}</span>
                          <span className="text-xs text-slate-500" title="Relative to the median clean word in its benchmark">
                            {item.relativePace.toFixed(2)}× · {item.appearances} {item.provisional ? 'provisional' : 'times'}
                          </span>
                          <button
                            type="button"
                            onClick={() => startSpeedDrill([item.word])}
                            className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-cyan-200 hover:bg-cyan-300/10"
                            aria-label={`Drill ${item.word}`}
                          >
                            Drill
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      Complete a benchmark to start collecting word timing.
                    </p>
                  )}
                </section>

                {data.benchmark.sessions.length > 0 && (
                  <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                    <h2 className="text-base font-semibold text-slate-100">Benchmark history</h2>
                    <div className="mt-3 space-y-2">
                      {data.benchmark.sessions.slice(0, 8).map((session) => (
                        <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 py-2 text-sm">
                          <span className="text-slate-400">
                            {session.benchmarkBaselineId ? 'Retest' : 'Baseline'} · {getBenchmarkForm(session.benchmarkFormId)?.title ?? session.benchmarkFormId} · {new Date(session.completedAt).toLocaleDateString()}
                          </span>
                          <span className="font-mono text-slate-200">{session.wpm} WPM · {session.accuracy}%</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <p className="text-xs leading-5 text-slate-600">
                  {BENCHMARK_FORMS.length} original English forms are bundled with the app. They are approximately matched, not empirically calibrated; compare several attempts rather than treating one pair as proof of improvement.
                </p>
              </div>
            </section>
          )}

          {(view === 'practice' || ((view === 'study' || view === 'benchmark') && sessionActive)) && (
            <section
              ref={practiceStageRef}
              className={`practice-stage practice-stage-${practiceScale} ${
                sessionActive ? 'session-stage-active' : ''
              } ${result ? 'session-stage-result' : ''} ${
                isFullscreen ? 'practice-stage-fullscreen' : ''
              } px-4 py-5 sm:px-6 lg:px-8`}
            >
              <div className="practice-workspace mx-auto max-w-[1180px]">
                {!sessionActive && (
                  <div className="practice-topbar mb-4 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                    <div className="practice-intro-copy">
                      <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-cyan-300/80">
                        Ordered sets ·{' '}
                        {practiceLanguage === 'english'
                          ? 'English typing'
                          : practiceLanguage === 'thai'
                            ? 'Thai typing'
                            : 'Thai and English typing'}
                      </p>
                      <h1 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[28px]">
                        Build accuracy. Speed follows.
                      </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Collection or part"
                        value={selectedSourceId}
                        onChange={(event) => {
                          setSelectedSourceId(event.target.value);
                          setSelectedPassageId('');
                        }}
                        disabled={mode !== 'study'}
                        className="h-10 max-w-[220px] rounded-lg border border-white/9 bg-[#101923] px-3 text-sm text-slate-300 outline-none focus:border-cyan-300/35 disabled:opacity-40"
                      >
                        <option value="">All collections</option>
                        {visibleSourceGroups.flatMap((group) =>
                          group.collectionId
                            ? [
                                <option
                                  key={group.selectionId}
                                  value={group.selectionId}
                                >
                                  {group.title} · All parts (
                                  {group.passageCount})
                                </option>,
                                ...group.sources.map((source) => (
                                  <option key={source.id} value={source.id}>
                                    ↳ Part {source.partOrder}:{' '}
                                    {source.partTitle} ({source.passageCount})
                                  </option>
                                )),
                              ]
                            : [
                                <option
                                  key={group.selectionId}
                                  value={group.selectionId}
                                >
                                  {group.title} ({group.passageCount})
                                </option>,
                              ],
                        )}
                      </select>
                      <select
                        aria-label="Starting set"
                        value={selectedPassageId}
                        onChange={(event) =>
                          setSelectedPassageId(event.target.value)
                        }
                        disabled={mode !== 'study'}
                        className="h-10 max-w-[250px] rounded-lg border border-white/9 bg-[#101923] px-3 text-sm text-slate-300 outline-none focus:border-cyan-300/35 disabled:opacity-40"
                      >
                        <option value="">
                          {automaticPracticePassage
                            ? `Continue · ${automaticPracticePassage.title}`
                            : 'Continue automatically'}
                        </option>
                        {selectablePracticePassages.map((passage, index) => (
                          <option key={passage.id} value={passage.id}>
                            {completedPracticePassageIds.has(passage.id)
                              ? '✓ '
                              : ''}
                            Set {index + 1} · {passage.title}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Practice language"
                        value={practiceLanguage}
                        onChange={(event) =>
                          choosePracticeLanguage(
                            event.target.value as PracticeLanguage,
                          )
                        }
                        disabled={mode !== 'study'}
                        className="h-10 rounded-lg border border-white/9 bg-[#101923] px-3 text-sm text-slate-300 outline-none focus:border-cyan-300/35 disabled:opacity-40"
                      >
                        <option value="english">English only</option>
                        <option value="thai-english">Thai → English</option>
                        <option value="thai">Thai only</option>
                      </select>
                      <button
                        onClick={() => prepareTarget()}
                        className="h-10 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-300/15"
                      >
                        Load selection
                      </button>
                      <fieldset className="workspace-size-controls">
                        <legend className="sr-only">Practice area size</legend>
                        <button
                          type="button"
                          aria-pressed={practiceScale === 'compact'}
                          onClick={() => choosePracticeScale('compact')}
                          title="Compact practice area"
                        >
                          <Minimize2 size={14} />
                          <span>Compact</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={
                            practiceScale === 'expanded' && !isFullscreen
                          }
                          onClick={() => choosePracticeScale('expanded')}
                          title="Expanded practice area"
                        >
                          <Maximize2 size={14} />
                          <span>Expanded</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={isFullscreen}
                          onClick={() => void toggleFullscreen()}
                          title={
                            isFullscreen
                              ? 'Exit full screen'
                              : 'Enter full screen'
                          }
                        >
                          <Fullscreen size={14} />
                          <span>
                            {isFullscreen ? 'Exit full screen' : 'Full screen'}
                          </span>
                        </button>
                      </fieldset>
                      <button
                        type="button"
                        aria-pressed={debugEnabled}
                        onClick={toggleDebug}
                        title="Record local keyboard diagnostics"
                        className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
                          debugEnabled
                            ? 'border-amber-300/30 bg-amber-300/12 text-amber-100'
                            : 'border-white/9 bg-[#101923] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Bug size={15} />
                        Debug {debugEnabled ? 'on' : 'off'}
                      </button>
                    </div>
                  </div>
                )}

                {!sessionActive && (
                  <div className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-white/7 bg-black/15 p-2 sm:flex-row sm:items-center">
                    <div
                      aria-label="Practice mode"
                      className="inline-flex rounded-lg p-0.5"
                    >
                      <button
                        aria-pressed={mode === 'study'}
                        onClick={() => prepareTarget('study')}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          mode === 'study'
                            ? 'bg-white/10 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Practice
                      </button>
                      <button
                        aria-pressed={mode === 'drill'}
                        onClick={() => prepareTarget('drill')}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          mode === 'drill'
                            ? 'bg-white/10 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Weakness drill
                      </button>
                      <button
                        aria-pressed={mode === 'one-hand'}
                        onClick={() => prepareTarget('one-hand')}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          mode === 'one-hand'
                            ? 'bg-white/10 text-white'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        One-hand drill
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 px-1">
                      {mode === 'one-hand' && (
                        <div
                          className="inline-flex rounded-lg border border-cyan-300/12 bg-cyan-300/[0.035] p-0.5"
                          aria-label="Hand to train"
                        >
                          <button
                            type="button"
                            aria-pressed={oneHandSide === 'left'}
                            onClick={() => chooseOneHandSide('left')}
                            className={`rounded-md px-3 py-1.5 text-xs ${
                              oneHandSide === 'left'
                                ? 'bg-cyan-300/12 text-cyan-100'
                                : 'text-slate-500'
                            }`}
                          >
                            Left hand
                          </button>
                          <button
                            type="button"
                            aria-pressed={oneHandSide === 'right'}
                            onClick={() => chooseOneHandSide('right')}
                            className={`rounded-md px-3 py-1.5 text-xs ${
                              oneHandSide === 'right'
                                ? 'bg-cyan-300/12 text-cyan-100'
                                : 'text-slate-500'
                            }`}
                          >
                            Right hand
                          </button>
                        </div>
                      )}
                      <div className="inline-flex rounded-lg border border-white/7 bg-white/[0.025] p-0.5">
                        <button
                          aria-pressed={completionKind === 'sets'}
                          onClick={() => setCompletionKind('sets')}
                          className={`rounded-md px-3 py-1.5 text-xs ${
                            completionKind === 'sets'
                              ? 'bg-white/8 text-slate-200'
                              : 'text-slate-600'
                          }`}
                        >
                          Sets
                        </button>
                        <button
                          aria-pressed={completionKind === 'time'}
                          onClick={() => setCompletionKind('time')}
                          className={`rounded-md px-3 py-1.5 text-xs ${
                            completionKind === 'time'
                              ? 'bg-white/8 text-slate-200'
                              : 'text-slate-600'
                          }`}
                        >
                          Time
                        </button>
                      </div>
                      {completionKind === 'sets' ? (
                        <select
                          aria-label="Number of sets"
                          value={setCount}
                          onChange={(event) =>
                            setSetCount(Number(event.target.value))
                          }
                          className="h-8 rounded-md border border-white/7 bg-[#101923] px-2 text-xs text-slate-300"
                        >
                          <option value={1}>1 set</option>
                          <option value={3}>3 sets</option>
                          <option value={5}>5 sets</option>
                        </select>
                      ) : (
                        <select
                          aria-label="Session time"
                          value={minutes}
                          onChange={(event) =>
                            setMinutes(Number(event.target.value))
                          }
                          className="h-8 rounded-md border border-white/7 bg-[#101923] px-2 text-xs text-slate-300"
                        >
                          <option value={1}>1 minute</option>
                          <option value={3}>3 minutes</option>
                          <option value={5}>5 minutes</option>
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {!sessionActive && (
                  <div className="practice-launch-card rounded-2xl border border-white/8 bg-[#101923] p-6 sm:p-8">
                    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/75">
                          Ready session
                        </p>
                        <h2 className="mt-2 truncate text-xl font-semibold text-white">
                          {launchTarget.title}
                        </h2>
                        <p className="mt-2 text-sm text-slate-500">
                          {launchTarget.subtitle}
                        </p>
                        {mode === 'study' &&
                          selectablePracticePassages.length > 0 && (
                            <p className="mt-2 font-mono text-xs text-slate-600">
                              {
                                selectablePracticePassages.filter((passage) =>
                                  completedPracticePassageIds.has(passage.id),
                                ).length
                              }{' '}
                              / {selectablePracticePassages.length} sets
                              completed · completion requires reaching the end
                            </p>
                          )}
                      </div>
                      <button
                        type="button"
                        onClick={startSession}
                        disabled={dataState === 'loading'}
                        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50"
                      >
                        <Play size={17} fill="currentColor" />
                        {mode === 'study' && practiceLanguage === 'english'
                          ? 'Read Thai overview'
                          : 'Start session'}
                      </button>
                    </div>
                  </div>
                )}

                {sessionActive && (
                  <header className="session-topbar">
                    <div
                      className="session-controls"
                      aria-label="Session controls"
                    >
                      {mode === 'benchmark' || mode === 'speed-drill' ? (
                        <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/8 px-3 py-2 text-sm font-medium text-cyan-100">
                          {mode === 'benchmark' ? 'Benchmark' : 'Speed drill'}
                        </span>
                      ) : (
                        <div
                          className="session-setting-group"
                          aria-label="Typing mode"
                        >
                        <button
                          type="button"
                          aria-pressed={mode === 'lesson'}
                          onClick={() => prepareTarget('lesson')}
                        >
                          Study
                        </button>
                        <button
                          type="button"
                          aria-pressed={mode === 'study'}
                          onClick={() => prepareTarget('study')}
                        >
                          Practice
                        </button>
                        <button
                          type="button"
                          aria-pressed={mode === 'drill'}
                          onClick={() => prepareTarget('drill')}
                        >
                          Drill
                        </button>
                        <button
                          type="button"
                          aria-pressed={mode === 'one-hand'}
                          onClick={() => prepareTarget('one-hand')}
                        >
                          One hand
                        </button>
                        </div>
                      )}
                      {mode === 'one-hand' && (
                        <div
                          className="session-setting-group"
                          aria-label="Hand to train"
                        >
                          <button
                            type="button"
                            aria-pressed={oneHandSide === 'left'}
                            onClick={() => chooseOneHandSide('left')}
                          >
                            Left
                          </button>
                          <button
                            type="button"
                            aria-pressed={oneHandSide === 'right'}
                            onClick={() => chooseOneHandSide('right')}
                          >
                            Right
                          </button>
                        </div>
                      )}
                      {mode !== 'lesson' && mode !== 'benchmark' && mode !== 'speed-drill' && (
                        <>
                          <div
                            className="session-setting-group"
                            aria-label="Session format"
                          >
                            <button
                              type="button"
                              aria-pressed={completionKind === 'sets'}
                              onClick={() => updateSessionFormat('sets')}
                            >
                              Sets
                            </button>
                            <button
                              type="button"
                              aria-pressed={completionKind === 'time'}
                              onClick={() => updateSessionFormat('time')}
                            >
                              Time
                            </button>
                          </div>
                          <select
                            aria-label={
                              completionKind === 'sets'
                                ? 'Number of sets'
                                : 'Session time'
                            }
                            value={
                              completionKind === 'sets' ? setCount : minutes
                            }
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              updateSessionFormat(
                                completionKind,
                                completionKind === 'sets' ? value : setCount,
                                completionKind === 'time' ? value : minutes,
                              );
                            }}
                          >
                            {completionKind === 'sets' ? (
                              <>
                                <option value={1}>1 set</option>
                                <option value={3}>3 sets</option>
                                <option value={5}>5 sets</option>
                              </>
                            ) : (
                              <>
                                <option value={1}>1 min</option>
                                <option value={3}>3 min</option>
                                <option value={5}>5 min</option>
                              </>
                            )}
                          </select>
                        </>
                      )}
                      <span className="session-control-divider" />
                      <button
                        type="button"
                        onClick={toggleSessionPause}
                        disabled={Boolean(result)}
                        className="session-action-button"
                      >
                        {isPaused ? <Play size={15} /> : <Pause size={15} />}
                        {isPaused ? 'Resume' : 'Pause'}
                      </button>
                      <button
                        type="button"
                        onClick={retrySession}
                        className="session-icon-button"
                        aria-label="Restart session"
                        title="Restart session"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleFullscreen()}
                        className="session-icon-button"
                        aria-label={
                          isFullscreen
                            ? 'Exit full screen'
                            : 'Enter full screen'
                        }
                        title={
                          isFullscreen
                            ? 'Exit full screen'
                            : 'Enter full screen'
                        }
                      >
                        <Fullscreen size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={leaveSession}
                        className="session-action-button session-exit-button"
                      >
                        <LogOut size={15} />
                        Exit
                      </button>
                    </div>

                    <div
                      className="session-metrics"
                      aria-label="Live session status"
                    >
                      <div>
                        <span>WPM</span>
                        <strong>{result?.wpm ?? liveWpm}</strong>
                      </div>
                      <div>
                        <span>ACC</span>
                        <strong className="text-cyan-300">
                          {result?.accuracy ?? liveAccuracy}%
                        </strong>
                      </div>
                      <div>
                        <span>ERROR</span>
                        <strong className="text-rose-300">
                          {result?.rawErrors ?? liveErrors}
                        </strong>
                      </div>
                      <div>
                        <span>TIME</span>
                        <strong className="text-amber-200">
                          {result
                            ? formatDuration(result.durationMs)
                            : completionKind === 'time'
                              ? formatDuration(remainingMs ?? minutes * 60_000)
                              : formatDuration(elapsedMs)}
                        </strong>
                      </div>
                    </div>
                  </header>
                )}

                {sessionActive && !result && (
                  <>
                    <div className="typing-surface group relative min-h-[248px] rounded-2xl border border-white/8 bg-[#101923] p-5 shadow-[0_22px_80px_rgb(0_0_0/18%)] transition focus-within:border-cyan-300/35 focus-within:ring-4 focus-within:ring-cyan-300/5 sm:p-6">
                      <div className="mb-5 flex items-center justify-between gap-4 border-b border-white/7 pb-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-200">
                            {target.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-600">
                            {target.subtitle}
                          </p>
                        </div>
                        {mode === 'lesson' && target.studyRounds && (
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-xs font-semibold text-cyan-200">
                              Round {studyRoundIndex + 1} /{' '}
                              {target.studyRounds.length}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-600">
                              {target.studyCheckpoint
                                ? 'Checkpoint'
                                : 'Lesson progress'}
                            </p>
                          </div>
                        )}
                        {mode === 'study' && activePracticePhase && (
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-xs font-semibold text-cyan-200">
                              Set {activePracticePhase.setNumber} ·{' '}
                              {activePracticeLanguage}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-600">
                              Part {activePracticePhase.partNumber} of{' '}
                              {activePracticePhase.partCount}
                              {activePracticePhase.language === 'Thai' &&
                              activePracticePhase.partCount > 1
                                ? ' · English next'
                                : ''}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="typing-copy-area relative min-h-[145px] cursor-text">
                        <textarea
                          ref={typingRef}
                          value={typed}
                          onChange={() => undefined}
                          onKeyDownCapture={captureKeyDown}
                          onKeyDown={handleKeyDown}
                          onKeyUpCapture={captureKeyUp}
                          onBeforeInputCapture={(event) =>
                            captureTextInput(
                              'beforeinput',
                              event.nativeEvent as InputEvent,
                            )
                          }
                          onInputCapture={(event) =>
                            captureTextInput(
                              'input',
                              event.nativeEvent as InputEvent,
                            )
                          }
                          onInput={handleInputFallback}
                          onFocus={() => {
                            setTypingFocused(true);
                            recordDebug({
                              phase: 'lifecycle',
                              event: 'input-focus',
                            });
                          }}
                          onBlur={() => {
                            setTypingFocused(false);
                            recordDebug({
                              phase: 'lifecycle',
                              event: 'input-blur',
                            });
                          }}
                          onCompositionStart={(event) => {
                            setInputNotice(
                              'Finish composing the current character, then keep typing.',
                            );
                            captureComposition(
                              'compositionstart',
                              event.nativeEvent,
                            );
                          }}
                          onCompositionUpdate={(event) =>
                            captureComposition(
                              'compositionupdate',
                              event.nativeEvent,
                            )
                          }
                          onCompositionEnd={(event) =>
                            captureComposition(
                              'compositionend',
                              event.nativeEvent,
                            )
                          }
                          onPaste={(event) => event.preventDefault()}
                          disabled={
                            Boolean(result) ||
                            dataState === 'loading' ||
                            isPaused
                          }
                          aria-label="Typing passage. Match the language shown, press any character key to begin, and use arrow keys, Backspace, or Delete to correct errors."
                          spellCheck={false}
                          autoCapitalize="off"
                          autoCorrect="off"
                          className="absolute inset-0 z-10 h-full w-full resize-none cursor-text opacity-0 outline-none disabled:cursor-default"
                        />
                        <div
                          ref={typingCopyScrollRef}
                          className="typing-copy-scroll absolute inset-0 overflow-y-auto"
                        >
                          <p
                            aria-hidden="true"
                            lang={
                              activePracticeLanguage === 'Thai' ? 'th' : 'en'
                            }
                            className="practice-copy font-mono text-[18px] leading-[1.7] tracking-[0.005em] sm:text-[20px]"
                          >
                            {typingDisplayUnits.map((unit) => {
                              const isCurrent =
                                !result &&
                                cursor >= unit.start &&
                                cursor < unit.end;
                              const enteredState =
                                unit.state === 'wrong'
                                  ? 'rounded-[2px] bg-rose-400/14 text-rose-300 underline decoration-rose-400/60 decoration-2 underline-offset-4'
                                  : 'text-slate-100';
                              return (
                                <span
                                  ref={
                                    isCurrent ? activeCharacterRef : undefined
                                  }
                                  key={unit.start}
                                  className="typing-grapheme"
                                >
                                  {unit.entered && (
                                    <span
                                      className={`${enteredState} ${
                                        isCurrent &&
                                        typingFocused &&
                                        cursor > unit.start
                                          ? 'typing-caret typing-caret-after'
                                          : ''
                                      }`}
                                    >
                                      {unit.entered}
                                    </span>
                                  )}
                                  {unit.pending && (
                                    <span
                                      className={`text-slate-500 ${
                                        isCurrent &&
                                        typingFocused &&
                                        cursor === unit.start
                                          ? 'typing-caret'
                                          : ''
                                      }`}
                                    >
                                      {unit.pending}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                            {cursor === typed.length &&
                              cursor === target.content.length &&
                              !result &&
                              typingFocused && (
                                <span
                                  ref={activeCharacterRef}
                                  className="typing-caret"
                                >
                                  &nbsp;
                                </span>
                              )}
                          </p>
                        </div>
                      </div>

                      {isPaused && !result && (
                        <output className="session-pause-overlay">
                          <Pause size={24} />
                          <div>
                            <p>Session paused</p>
                            <span>The timer and typing input are stopped.</span>
                          </div>
                          <button type="button" onClick={toggleSessionPause}>
                            <Play size={15} />
                            Resume
                          </button>
                        </output>
                      )}

                      {!result && !isPaused && (
                        <div className="mt-3 flex min-h-9 items-center justify-between gap-3 border-t border-white/8 pt-3 text-sm">
                          <output
                            className={
                              inputNotice ? 'text-amber-200' : 'text-slate-400'
                            }
                          >
                            {dataState === 'loading'
                              ? 'Loading passage…'
                              : inputNotice ||
                                (typingFocused
                                  ? `Ready to type · ${activeKeyboardLayout === 'kedmanee' ? 'Thai Kedmanee' : 'English (US)'} · paste is disabled`
                                  : 'Typing is not focused. Click the passage to continue.')}
                          </output>
                          {!typingFocused && dataState !== 'loading' && (
                            <button
                              type="button"
                              onClick={focusTyping}
                              className="shrink-0 rounded-lg bg-cyan-300/15 px-3 py-2 font-medium text-cyan-100 hover:bg-cyan-300/25"
                            >
                              {startedAt ? 'Resume typing' : 'Start typing'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {debugEnabled && (
                      <section
                        aria-label="Typing debug recorder"
                        className="mt-4 rounded-2xl border border-amber-300/18 bg-amber-300/[0.035] p-4"
                      >
                        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  debugFrozen
                                    ? 'bg-slate-500'
                                    : 'animate-pulse bg-amber-300'
                                }`}
                              />
                              <p className="text-sm font-semibold text-amber-100">
                                Debug recorder ·{' '}
                                {debugFrozen ? 'paused' : 'recording'}
                              </p>
                              <span className="rounded-md bg-black/20 px-2 py-1 font-mono text-xs text-amber-100/70">
                                {debugPanel.count}/{DEBUG_RECORD_LIMIT} events
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Local memory only. Reproduce the missing key, then
                              pause and copy the log.
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={toggleDebugFrozen}
                              className="flex items-center gap-2 rounded-lg border border-amber-300/20 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-300/10"
                            >
                              {debugFrozen ? (
                                <Play size={14} />
                              ) : (
                                <Pause size={14} />
                              )}
                              {debugFrozen ? 'Resume' : 'Pause'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyDebugLog()}
                              className="flex items-center gap-2 rounded-lg border border-white/9 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
                            >
                              <Copy size={14} />
                              Copy JSON
                            </button>
                            <button
                              type="button"
                              onClick={downloadDebugLog}
                              className="flex items-center gap-2 rounded-lg border border-white/9 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
                            >
                              <Download size={14} />
                              Download
                            </button>
                            <button
                              type="button"
                              onClick={clearDebugLog}
                              aria-label="Clear debug log"
                              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg border border-white/6 bg-black/15 px-3 py-2">
                            <p className="text-xs text-slate-600">
                              Last raw event
                            </p>
                            <p className="mt-1 truncate font-mono text-sm text-slate-200">
                              {debugPanel.latestRaw
                                ? `${debugPanel.latestRaw.event} · ${latestDebugKey || debugPanel.latestRaw.inputType || '—'}`
                                : 'Waiting…'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-white/6 bg-black/15 px-3 py-2">
                            <p className="text-xs text-slate-600">
                              Handler decision
                            </p>
                            <p className="mt-1 truncate font-mono text-sm text-slate-200">
                              {debugPanel.latestHandler?.decision || 'Waiting…'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-white/6 bg-black/15 px-3 py-2">
                            <p className="text-xs text-slate-600">
                              Committed state
                            </p>
                            <p className="mt-1 truncate font-mono text-sm text-slate-200">
                              {debugPanel.latestState
                                ? `cursor ${debugPanel.latestState.cursor} · text ${debugPanel.latestState.typedLength}`
                                : 'Waiting…'}
                            </p>
                          </div>
                        </div>

                        {debugCopyStatus && (
                          <p className="mt-3 text-xs text-amber-100/80">
                            {debugCopyStatus}
                          </p>
                        )}
                      </section>
                    )}

                    <div className="practice-guide mt-4 rounded-2xl border border-white/7 bg-white/[0.018] p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                          <p className="text-sm font-medium text-slate-200">
                            Next key:{' '}
                            <span className="font-mono text-cyan-300">
                              {nextCharacter ? instruction.key : 'done'}
                            </span>
                          </p>
                        </div>
                        <p className="hidden text-sm text-slate-400 sm:block">
                          {nextCharacter ? instruction.finger : 'Set complete'}
                        </p>
                      </div>

                      <div className="practice-guidance-layout">
                        <div className="keyboard-scroll">
                          <div
                            className="keyboard-board space-y-1.5"
                            aria-label={`${activeKeyboardLayout === 'kedmanee' ? 'Thai Kedmanee' : 'US QWERTY'} keyboard finger guide`}
                          >
                            {KEY_ROWS.map((row, rowIndex) => (
                              <div
                                key={rowIndex}
                                className="flex justify-center gap-1.5"
                                style={{
                                  paddingInlineStart: `${rowIndex * 10}px`,
                                }}
                              >
                                {row.map((key) => {
                                  const labels = keyboardLabels(
                                    key,
                                    activeKeyboardLayout,
                                  );
                                  const active =
                                    nextKeyDefinition?.base === key.base;
                                  return (
                                    <span
                                      key={key.base}
                                      className={`keycap finger-${key.finger} ${
                                        active ? 'keycap-active' : ''
                                      } ${key.width ?? ''}`}
                                      title={FINGER_LABELS[key.finger]}
                                    >
                                      <small>{labels.shifted}</small>
                                      <span>{labels.base}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ))}
                            <div className="flex justify-center gap-1.5 pt-0.5">
                              <span
                                className={`keycap keycap-wide ${
                                  shiftHand === 'left'
                                    ? 'keycap-shift-active'
                                    : ''
                                }`}
                              >
                                shift
                              </span>
                              <span
                                className={`keycap keycap-space ${nextCharacter === ' ' ? 'keycap-active' : ''}`}
                              >
                                space
                              </span>
                              <span
                                className={`keycap keycap-wide ${
                                  shiftHand === 'right'
                                    ? 'keycap-shift-active'
                                    : ''
                                }`}
                              >
                                shift
                              </span>
                            </div>
                          </div>
                        </div>
                        <HandGuide
                          nextCharacter={nextCharacter}
                          keyboardLayout={activeKeyboardLayout}
                          oneHandSide={
                            mode === 'one-hand' ? oneHandSide : undefined
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                {sessionActive && result && (
                  <SessionResultScreen
                    result={result}
                    target={target}
                    mode={mode}
                    baseline={
                      target.benchmarkBaselineId
                        ? data.benchmark.sessions.find(
                            (session) => session.id === target.benchmarkBaselineId,
                          )
                        : undefined
                    }
                    onHome={leaveSession}
                    onRetry={retrySession}
                    onNext={
                      mode === 'lesson'
                        ? continueStudy
                        : mode === 'benchmark'
                          ? target.benchmarkBaselineId || !availableSlowWords.length
                            ? leaveSession
                            : () => startSpeedDrill(availableSlowWords.slice(0, 5))
                          : mode === 'speed-drill'
                            ? () => startBenchmark(target.benchmarkBaselineId ?? latestBaseline?.id ?? null)
                            : () => prepareTarget()
                    }
                    nextLabel={nextResultAction.label}
                    nextDescription={nextResultAction.description}
                  />
                )}
              </div>
            </section>
          )}

          {view === 'sources' && (
            <section className="px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
              <div className="mx-auto max-w-[1040px]">
                <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-cyan-300/80">
                      Source-grounded library
                    </p>
                    <h1 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[30px]">
                      Practice sets from Markdown
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Every set pairs a learner-oriented Thai typing passage
                      with a 50–100 word English passage and at least one
                      evidence excerpt. Practice types the Thai text first by
                      default, then English. Related files sharing a collection
                      ID are grouped automatically.
                    </p>
                  </div>
                  <button
                    onClick={openSourcePicker}
                    disabled={isImportingSources}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50"
                  >
                    <FileUp size={16} />
                    {importState === 'importing'
                      ? 'Importing…'
                      : 'Import .md files'}
                  </button>
                </div>

                {importMessage && (
                  <div
                    className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                      importState === 'success'
                        ? 'border-emerald-300/18 bg-emerald-300/7 text-emerald-200'
                        : importState === 'warning'
                          ? 'border-amber-300/18 bg-amber-300/7 text-amber-200'
                          : 'border-rose-300/18 bg-rose-300/7 text-rose-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {importState === 'success' ? (
                        <Check className="mt-0.5 shrink-0" size={16} />
                      ) : (
                        <AlertCircle className="mt-0.5 shrink-0" size={16} />
                      )}
                      <span>{importMessage}</span>
                    </div>
                    {importResults.length > 0 &&
                      importState !== 'importing' && (
                        <div className="mt-3 space-y-2 border-t border-current/10 pt-3">
                          {importResults.map((result, index) => (
                            <div
                              key={`${result.filename}-${index}`}
                              className="flex items-start justify-between gap-4 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-200">
                                  {result.filename}
                                </p>
                                <p className="mt-0.5 text-slate-500">
                                  {result.message}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 uppercase tracking-[0.1em] ${
                                  result.status === 'imported'
                                    ? 'text-emerald-300'
                                    : result.status === 'skipped'
                                      ? 'text-amber-300'
                                      : 'text-rose-300'
                                }`}
                              >
                                {result.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                )}

                {sourceNotice && (
                  <div
                    className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                      sourceNotice.tone === 'success'
                        ? 'border-emerald-300/18 bg-emerald-300/7 text-emerald-200'
                        : 'border-rose-300/18 bg-rose-300/7 text-rose-200'
                    }`}
                  >
                    {sourceNotice.tone === 'success' ? (
                      <Check className="mt-0.5 shrink-0" size={16} />
                    ) : (
                      <AlertCircle className="mt-0.5 shrink-0" size={16} />
                    )}
                    {sourceNotice.message}
                  </div>
                )}

                <section className="mb-4 rounded-2xl border border-white/7 bg-white/[0.02] p-5">
                  <h2 className="text-sm font-semibold text-slate-100">
                    Add a source in four steps
                  </h2>
                  <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      [
                        '1',
                        'Copy the AI prompt',
                        'Open or copy the prompt below.',
                      ],
                      [
                        '2',
                        'Choose topic and evidence',
                        'Tell the AI what to study and which sources it may use.',
                      ],
                      [
                        '3',
                        'Save each part as .md',
                        'Keep the same collection ID across related parts.',
                      ],
                      [
                        '4',
                        'Import all files together',
                        'Select or drop multiple files, then review the result for each file.',
                      ],
                    ].map(([number, title, detail]) => (
                      <li key={number} className="flex gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/8 font-mono text-xs text-cyan-300">
                          {number}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            {title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>

                <div className="mb-4 rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.035] p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
                  <div className="flex items-start gap-3.5">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/8 text-cyan-300">
                      <Braces size={18} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">
                        Create a compatible file with AI
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                        Paste the prompt into an AI first. It will ask for your
                        topic and source method before creating English typing
                        passages, beginner-friendly Thai teaching notes, and
                        exact evidence in an import-safe .md part with up to 100
                        sets. Related parts use the same collection ID and group
                        automatically.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex shrink-0 items-center gap-2 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => setShowSourcePrompt(true)}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.025] px-3 text-xs font-medium text-slate-300 hover:border-white/16 hover:text-white"
                    >
                      View prompt
                    </button>
                    <button
                      type="button"
                      onClick={() => void copySourcePrompt()}
                      className="inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-200"
                    >
                      {sourcePromptCopyStatus === 'copied' ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      {sourcePromptCopyStatus === 'copied'
                        ? 'Prompt copied'
                        : 'Copy prompt'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={openSourcePicker}
                  disabled={isImportingSources}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (isImportingSources) return;
                    void importFiles(event.dataTransfer.files);
                  }}
                  className="group mb-8 flex w-full flex-col items-center rounded-2xl border border-dashed border-white/12 bg-white/[0.018] px-6 py-10 text-center transition hover:border-cyan-300/28 hover:bg-cyan-300/[0.025]"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/8 text-cyan-300">
                    <Upload size={21} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-200">
                    Drop one or more Type Practice Markdown files here
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    or click to choose multiple files · 1 MB max per file
                  </p>
                </button>

                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-200">
                    Imported collections
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    {hasStarterSource && hasNonStarterSource && (
                      <label
                        htmlFor="show-starter-source"
                        className="flex cursor-pointer items-center gap-2 text-slate-500"
                      >
                        <Switch
                          id="show-starter-source"
                          size="sm"
                          checked={showStarterSource}
                          onCheckedChange={chooseStarterVisibility}
                          aria-label="Show starter sample"
                        />
                        Show starter sample
                      </label>
                    )}
                    <a
                      href="/type-practice.sample.md"
                      download
                      className="inline-flex items-center gap-1.5 text-slate-500 hover:text-cyan-300"
                    >
                      <Download size={13} /> Sample file
                    </a>
                  </div>
                </div>

                {visibleSourceGroups.length === 0 ? (
                  <div className="rounded-2xl border border-white/7 bg-white/[0.018] p-8 text-center">
                    <Database className="mx-auto text-slate-700" size={28} />
                    <p className="mt-3 text-sm text-slate-400">
                      Your library is empty.
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Use the included Codex prompt to create your first
                      compatible file.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {visibleSourceGroups.map((group) => (
                      <article
                        key={group.key}
                        className="rounded-2xl border border-white/7 bg-white/[0.025] p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-100">
                              {group.title}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-600">
                              {group.collectionId
                                ? `${group.sources.length} ${group.sources.length === 1 ? 'part' : 'parts'} · ${group.collectionId}`
                                : group.sources[0].originalFileName}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-md bg-cyan-300/8 px-2 py-1 font-mono text-[11px] text-cyan-300">
                            {group.passageCount} sets
                          </span>
                        </div>
                        {group.collectionId && (
                          <div className="mt-4 space-y-2 border-t border-white/6 pt-4">
                            {group.sources.map((source) => (
                              <div
                                key={source.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-black/10 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs text-slate-300">
                                    Part {source.partOrder}: {source.partTitle}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-slate-600">
                                    {source.originalFileName}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="font-mono text-[11px] text-slate-500">
                                    {source.passageCount} sets
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isImportingSources}
                                    onClick={() =>
                                      setDeleteTarget({
                                        kind: 'part',
                                        id: source.id,
                                        title: source.partTitle || source.title,
                                        partCount: 1,
                                        setCount: source.passageCount,
                                      })
                                    }
                                    aria-label={`Delete part ${source.partTitle || source.title}`}
                                    title="Delete this part"
                                    className="grid h-7 w-7 place-items-center rounded-md text-slate-600 hover:bg-rose-300/8 hover:text-rose-300"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-5 border-t border-white/6 pt-4">
                          <p className="text-xs text-slate-500">
                            {group.sources.length > 1
                              ? 'Primary sources'
                              : 'Primary source'}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between gap-3">
                            <span className="truncate text-sm text-slate-300">
                              {[
                                ...new Set(
                                  group.sources.map(
                                    (source) => source.sourceTitle,
                                  ),
                                ),
                              ].join(', ')}
                            </span>
                            {group.sources[0].sourceUrl && (
                              <a
                                href={group.sources[0].sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Open ${group.sources[0].sourceTitle}`}
                                className="text-slate-600 hover:text-cyan-300"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="mt-5 flex items-center justify-between gap-3">
                          <button
                            onClick={() => {
                              setSelectedSourceId(group.selectionId);
                              setView('practice');
                              const next = buildTarget(
                                data,
                                'study',
                                group.selectionId,
                                'sets',
                                1,
                                1,
                              );
                              setMode('study');
                              resetMachine(next);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200"
                          >
                            Practice this{' '}
                            {group.collectionId ? 'collection' : 'source'}{' '}
                            <ChevronRight size={13} />
                          </button>
                          <button
                            type="button"
                            disabled={isImportingSources}
                            onClick={() =>
                              setDeleteTarget({
                                kind: group.collectionId
                                  ? 'collection'
                                  : 'part',
                                id: group.collectionId || group.sources[0].id,
                                title: group.title,
                                partCount: group.sources.length,
                                setCount: group.passageCount,
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-300"
                          >
                            <Trash2 size={13} /> Delete{' '}
                            {group.collectionId ? 'collection' : 'source'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {view === 'progress' && (
            <section className="px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
              <div className="mx-auto max-w-[1040px]">
                <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                  <div>
                    <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-cyan-300/80">
                      Long-term signal
                    </p>
                    <h1 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[30px]">
                      Progress, without guesswork.
                    </h1>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-600">
                      Language views follow the characters being typed. A
                      cross-language input mistake stays in Overall only.
                    </p>
                  </div>
                  <fieldset className="inline-flex w-fit rounded-lg border border-white/8 bg-black/20 p-1">
                    <legend className="sr-only">Progress language</legend>
                    {(
                      [
                        ['overall', 'Overall'],
                        ['thai', 'Thai'],
                        ['english', 'English'],
                      ] as const
                    ).map(([scope, label]) => (
                      <button
                        key={scope}
                        type="button"
                        aria-pressed={progressScope === scope}
                        onClick={() => setProgressScope(scope)}
                        className={`rounded-md px-3 py-2 text-xs font-medium transition ${
                          progressScope === scope
                            ? 'bg-cyan-300/14 text-cyan-100'
                            : 'text-slate-500 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </fieldset>
                </div>

                <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard
                    label="Average WPM"
                    value={progressMetrics.averageWpm || '—'}
                  />
                  <MetricCard
                    label="Average accuracy"
                    value={
                      progressMetrics.totalSessions
                        ? `${progressMetrics.averageAccuracy}%`
                        : '—'
                    }
                    tone="text-cyan-300"
                  />
                  <MetricCard
                    label="Personal best"
                    value={progressMetrics.bestWpm || '—'}
                  />
                  <MetricCard
                    label="Current streak"
                    value={`${data.analytics.streak} days`}
                    tone="text-orange-200"
                  />
                </div>

                <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-5 sm:p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-200">
                        WPM &amp; accuracy trend
                      </h2>
                      <p className="mt-1 text-xs text-slate-600">
                        {progressScopeLabel} · daily average · last 14 days
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-cyan-300" />
                        WPM
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-violet-400" />
                        Accuracy
                      </span>
                      <Gauge className="text-cyan-300/70" size={18} />
                    </div>
                  </div>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={progressChartData}
                        margin={{ left: -20, right: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="wpmFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#67e8f9"
                              stopOpacity={0.26}
                            />
                            <stop
                              offset="100%"
                              stopColor="#67e8f9"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="accuracyFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#a78bfa"
                              stopOpacity={0.18}
                            />
                            <stop
                              offset="100%"
                              stopColor="#a78bfa"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="rgba(255,255,255,0.055)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          yAxisId="wpm"
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          yAxisId="accuracy"
                          orientation="right"
                          domain={[0, 100]}
                          ticks={[0, 25, 50, 75, 100]}
                          tickFormatter={(value) => `${value}%`}
                          tick={{ fill: '#7c6ca8', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={42}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#101923',
                            border: '1px solid rgba(255,255,255,.09)',
                            borderRadius: 10,
                            color: '#e2e8f0',
                            fontSize: 12,
                          }}
                        />
                        <Area
                          yAxisId="wpm"
                          type="monotone"
                          dataKey="wpm"
                          name="WPM"
                          stroke="#67e8f9"
                          strokeWidth={2}
                          fill="url(#wpmFill)"
                          connectNulls
                        />
                        <Area
                          yAxisId="accuracy"
                          type="monotone"
                          dataKey="accuracy"
                          name="Accuracy"
                          unit="%"
                          stroke="#a78bfa"
                          strokeWidth={2}
                          fill="url(#accuracyFill)"
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-white/7 bg-white/[0.02]">
                  <div className="border-b border-white/7 px-5 py-4">
                    <h2 className="text-sm font-semibold text-slate-200">
                      Recent sessions · overall results
                    </h2>
                  </div>
                  {regularSessionHistory.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-slate-600">
                      Complete a practice set to establish your baseline.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="text-[11px] uppercase tracking-[0.12em] text-slate-600">
                          <tr>
                            <th className="px-5 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Mode</th>
                            <th className="px-4 py-3 font-medium">WPM</th>
                            <th className="px-4 py-3 font-medium">Accuracy</th>
                            <th className="px-4 py-3 font-medium">Errors</th>
                            <th className="px-5 py-3 text-right font-medium">
                              Corrections
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {regularSessionHistory.slice(0, 12).map((session) => (
                            <tr
                              key={session.id}
                              className="border-t border-white/6 text-slate-400"
                            >
                              <td className="px-5 py-3">
                                {new Date(
                                  session.completedAt,
                                ).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 capitalize">
                                {session.mode === 'study'
                                  ? 'Practice'
                                  : session.mode === 'lesson'
                                    ? 'Study'
                                    : session.mode}
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-200">
                                {session.wpm}
                              </td>
                              <td className="px-4 py-3 font-mono text-cyan-300">
                                {session.accuracy}%
                              </td>
                              <td className="px-4 py-3 font-mono text-rose-300">
                                {session.rawErrors}
                              </td>
                              <td className="px-5 py-3 text-right font-mono">
                                {session.corrections}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {view === 'weaknesses' && (
            <section className="px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
              <div className="mx-auto max-w-[1040px]">
                <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                  <div>
                    <p className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-cyan-300/80">
                      Error-weighted training
                    </p>
                    <h1 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[30px]">
                      Train what slows you down.
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Built from real mistakes in Practice sessions. Drill
                      results never change these percentages.
                    </p>
                  </div>
                  <button
                    onClick={() => startWeaknessDrill('combined')}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950"
                  >
                    <Target size={16} /> Start combined drill
                  </button>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  {(['right', 'left'] as const).map((side) => {
                    const handDrill = data.analytics.oneHandDrills[side];
                    const handLabel = side === 'right' ? 'Right' : 'Left';
                    return (
                      <article
                        key={side}
                        className={`rounded-2xl border p-5 ${
                          side === 'right'
                            ? 'border-cyan-300/18 bg-cyan-300/[0.045]'
                            : 'border-white/7 bg-white/[0.025]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-cyan-300/70">
                              One-hand mode
                            </p>
                            <h2 className="mt-2 text-lg font-semibold text-white">
                              {handLabel}-hand drill
                            </h2>
                          </div>
                          {side === 'right' && (
                            <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                          150 varied patterns across every {side}-hand key.
                          {handDrill.priorityKeys.length > 0
                            ? ` Extra repetitions: ${handDrill.priorityKeys.join(', ')}.`
                            : ' No Practice weakness detected for this hand yet.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => startOneHandDrill(side)}
                          className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/9 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/14"
                        >
                          <Play size={14} /> Train {handLabel.toLowerCase()}{' '}
                          hand
                        </button>
                      </article>
                    );
                  })}
                </div>

                <div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
                  <div className="overflow-hidden rounded-2xl border border-white/7 bg-white/[0.025]">
                    <div className="flex items-center justify-between border-b border-white/7 px-5 py-4">
                      <h2 className="text-sm font-semibold text-slate-200">
                        Priority keys
                      </h2>
                      <span className="text-xs text-slate-600">
                        Practice sessions only
                      </span>
                    </div>
                    {data.analytics.weaknesses.length === 0 ? (
                      <div className="px-6 py-12 text-center">
                        <ListChecks
                          className="mx-auto text-slate-700"
                          size={28}
                        />
                        <p className="mt-3 text-sm text-slate-400">
                          No error pattern yet.
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          The first drill uses the F and J home keys as a
                          baseline.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/6">
                        {data.analytics.weaknesses.map((weakness, index) => (
                          <div
                            key={`${weakness.expected}-${weakness.confusedWith}`}
                            className="grid grid-cols-[36px_1fr_auto] items-center gap-4 px-5 py-4"
                          >
                            <span className="font-mono text-xs text-slate-600">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <kbd className="grid h-7 min-w-7 place-items-center rounded-md border border-rose-300/18 bg-rose-300/8 px-2 font-mono text-sm text-rose-200">
                                  {weakness.expected === ' '
                                    ? 'space'
                                    : weakness.expected}
                                </kbd>
                                {weakness.confusedWith && (
                                  <>
                                    <span className="text-xs text-slate-700">
                                      typed as
                                    </span>
                                    <kbd className="grid h-7 min-w-7 place-items-center rounded-md border border-white/8 bg-white/4 px-2 font-mono text-sm text-slate-300">
                                      {weakness.confusedWith === ' '
                                        ? 'space'
                                        : weakness.confusedWith}
                                    </kbd>
                                  </>
                                )}
                              </div>
                              <p className="mt-2 text-xs text-slate-600">
                                {weakness.errors} errors / {weakness.exposures}{' '}
                                attempts · {weakness.averageLatencyMs} ms
                                average
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-lg text-rose-300">
                                {weakness.errorRate}%
                              </p>
                              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-700">
                                error rate
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/7 bg-white/[0.025] p-5">
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-200">
                      <span className="flex items-center gap-2">
                        <Braces size={16} className="text-cyan-300" /> Combined
                        drill preview
                      </span>
                      <span className="font-mono text-xs font-normal text-slate-600">
                        {data.analytics.drillText.trim().split(/\s+/).length}{' '}
                        patterns
                      </span>
                    </div>
                    <p className="mt-5 max-h-[240px] overflow-hidden break-words font-mono text-lg leading-8 text-slate-400">
                      {data.analytics.drillText}
                    </p>
                    <div className="mt-6 rounded-xl border border-white/7 bg-black/15 p-4">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                        Training logic
                      </p>
                      <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">
                        <li>• Highest-scoring keys appear first.</li>
                        <li>
                          • Nearby keys that use the same finger are grouped.
                        </li>
                        <li>
                          • The combined drill interleaves every active group.
                        </li>
                        <li>• Drill sessions are excluded from error rates.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {data.analytics.drills.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-200">
                          Focused drills
                        </h2>
                        <p className="mt-1 text-xs text-slate-600">
                          One drill per nearby-key group, ranked by Practice
                          error frequency and rate.
                        </p>
                      </div>
                      <span className="text-xs text-slate-600">
                        Updated after every completed session
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {data.analytics.drills.map((drill) => (
                        <article
                          key={drill.id}
                          className="flex min-h-[250px] flex-col rounded-2xl border border-white/7 bg-white/[0.025] p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-100">
                                {drill.label}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {drill.targets.map((targetKey) => (
                                  <kbd
                                    key={targetKey}
                                    className="rounded-md border border-rose-300/18 bg-rose-300/8 px-2 py-1 font-mono text-xs text-rose-200"
                                  >
                                    {targetKey === ' ' ? 'space' : targetKey}
                                  </kbd>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-xl text-rose-300">
                                {drill.errorRate}%
                              </p>
                              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-700">
                                Practice errors
                              </p>
                            </div>
                          </div>

                          <p className="mt-4 text-xs text-slate-600">
                            {drill.errors} errors / {drill.exposures} attempts
                            {drill.confusions.length > 0 && (
                              <>
                                {' '}
                                · confused with{' '}
                                {drill.confusions
                                  .map((key) => (key === ' ' ? 'space' : key))
                                  .join(', ')}
                              </>
                            )}
                          </p>
                          <p className="mt-3 max-h-14 overflow-hidden break-words font-mono text-xs leading-5 text-slate-500">
                            {drill.text}
                          </p>
                          <button
                            type="button"
                            onClick={() => startWeaknessDrill(drill.id)}
                            className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/9 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/14"
                          >
                            <Play size={14} /> Start focused drill
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(practicePreviewTarget)}
        onOpenChange={(open) => {
          if (!open) setPracticePreviewTarget(null);
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-3xl gap-0 overflow-hidden border-white/10 bg-[#101923] p-0 text-slate-100 shadow-2xl sm:max-w-3xl">
          {practicePreviewTarget && (
            <>
              <DialogHeader className="border-b border-white/8 px-5 py-4 pr-12 text-left sm:px-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-300/75">
                  Before you type
                </p>
                <DialogTitle className="text-xl font-semibold text-white">
                  {practicePreviewTarget.title}
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-slate-500">
                  Read the Thai overview first. It will not be included in the
                  typing session; the next screen contains English only.
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
                {practicePreviewTarget.thaiExplanations.length > 0 ? (
                  <div className="space-y-4">
                    {practicePreviewTarget.thaiExplanations.map(
                      (explanation, index) => (
                        <article
                          key={`${explanation.title}-${index}`}
                          className="rounded-xl border border-violet-300/12 bg-violet-300/[0.035] p-4 sm:p-5"
                        >
                          {practicePreviewTarget.thaiExplanations.length >
                            1 && (
                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-200/70">
                              Set {index + 1} · {explanation.title}
                            </p>
                          )}
                          <p
                            lang="th"
                            className="text-base leading-8 text-slate-200"
                          >
                            {explanation.text}
                          </p>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-300/14 bg-amber-300/[0.04] p-4 text-sm leading-6 text-amber-100/80">
                    This older set does not include a Thai overview. You can
                    still continue to the English typing passage.
                  </div>
                )}

                {practicePreviewTarget.evidence.length > 0 && (
                  <div className="mt-5 border-t border-white/7 pt-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-600">
                      Source references
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {practicePreviewTarget.evidence.map((evidence, index) => (
                        <span
                          key={`${evidence.label}-${index}`}
                          className="rounded-md border border-white/7 bg-white/[0.025] px-2.5 py-1.5 text-xs text-slate-500"
                        >
                          {evidence.label} · {evidence.locator}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-white/8 bg-black/10 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={() => setPracticePreviewTarget(null)}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-white/9 px-4 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={beginPracticeAfterPreview}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                >
                  <Play size={15} fill="currentColor" /> Start English typing
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showSourcePrompt} onOpenChange={setShowSourcePrompt}>
        <DialogContent className="max-h-[88vh] max-w-3xl gap-0 overflow-hidden border-white/10 bg-[#101923] p-0 text-slate-100 shadow-2xl sm:max-w-3xl">
          <DialogHeader className="border-b border-white/8 px-5 py-4 pr-12 text-left">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-300/75">
              Source to Markdown
            </p>
            <DialogTitle className="text-lg font-semibold text-white">
              AI conversion prompt
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-500">
              Send this prompt to an AI first. It will ask what you want to
              study and whether to use files, pasted text, URLs, or web search.
              It creates up to 100 non-repetitive sets per part and adds the
              metadata used to group related files automatically. Save its final
              response with a .md extension.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 p-5">
            <textarea
              readOnly
              value={SOURCE_TO_MARKDOWN_PROMPT}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="AI source conversion prompt"
              className="h-[min(58vh,560px)] w-full resize-none rounded-xl border border-white/8 bg-[#091018] p-4 font-mono text-xs leading-5 text-slate-300 outline-none selection:bg-cyan-300/25 focus:border-cyan-300/25"
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={`text-xs ${
                  sourcePromptCopyStatus === 'error'
                    ? 'text-amber-300'
                    : 'text-slate-600'
                }`}
              >
                {sourcePromptCopyStatus === 'error'
                  ? 'Automatic copy was blocked. Click inside the prompt, then copy the selected text.'
                  : 'The generated file is still validated when you import it.'}
              </p>
              <button
                type="button"
                onClick={() => void copySourcePrompt()}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              >
                {sourcePromptCopyStatus === 'copied' ? (
                  <Check size={15} />
                ) : (
                  <Copy size={15} />
                )}
                {sourcePromptCopyStatus === 'copied'
                  ? 'Copied to clipboard'
                  : 'Copy full prompt'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && deleteState !== 'deleting') setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#101923] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{' '}
              {deleteTarget?.kind === 'collection' ? 'collection' : 'part'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              “{deleteTarget?.title}” contains {deleteTarget?.partCount ?? 0}{' '}
              part(s) and {deleteTarget?.setCount ?? 0} set(s). Its passages,
              Thai meanings, and evidence will be removed. Completed session
              statistics will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-white/8 bg-white/[0.025]">
            <AlertDialogCancel disabled={deleteState === 'deleting'}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteState === 'deleting'}
              onClick={() => void confirmDeleteSource()}
              className="bg-rose-500 text-white hover:bg-rose-400"
            >
              {deleteState === 'deleting' ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
