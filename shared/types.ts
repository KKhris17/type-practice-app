export type Evidence = {
  label: string;
  locator: string;
  url?: string;
  excerpt: string;
};

export type ParsedPassage = {
  title: string;
  content: string;
  thaiExplanation: string;
  wordCount: number;
  evidence: Evidence[];
};

export type ParsedSource = {
  title: string;
  collectionId?: string;
  collectionTitle?: string;
  partTitle?: string;
  partOrder?: number;
  sourceTitle: string;
  sourceUrl?: string;
  passages: ParsedPassage[];
};

export type PassageRecord = Omit<ParsedPassage, 'thaiExplanation'> & {
  id: string;
  sourceId: string;
  thaiExplanation: string | null;
  orderIndex: number;
};

export type SourceRecord = {
  id: string;
  title: string;
  collectionId?: string | null;
  collectionTitle?: string | null;
  partTitle?: string | null;
  partOrder?: number | null;
  originalFileName: string;
  sourceTitle: string;
  sourceUrl?: string | null;
  importedAt: number;
  passageCount: number;
};

export type TypingEvent = {
  action: 'insert' | 'backspace' | 'delete';
  key: string;
  expected: string;
  position: number;
  correct: boolean;
  atMs: number;
  latencyMs: number;
};

export type SessionSummary = {
  id: string;
  passageId?: string | null;
  studyLessonId?: string | null;
  mode: 'study' | 'lesson' | 'drill' | 'one-hand' | 'benchmark' | 'speed-drill';
  completedAt: number;
  durationMs: number;
  wpm: number;
  accuracy: number;
  rawErrors: number;
  corrections: number;
};

export type BenchmarkSessionSummary = SessionSummary & {
  benchmarkFormId: string;
  benchmarkBaselineId: string | null;
};

export type BenchmarkData = {
  sessions: BenchmarkSessionSummary[];
  slowWords: import('./benchmark').SlowWordStat[];
  comparisons: import('./benchmark').BenchmarkComparison[];
};

export type StudyProgressRecord = {
  lessonId: string;
  bestAccuracy: number;
  bestDurationMs: number;
  attempts: number;
  passedAt: number | null;
  lastPracticedAt: number;
};

export type PracticeProgressRecord = {
  passageId: string;
  completions: number;
  firstCompletedAt: number;
  lastCompletedAt: number;
};

export type WeaknessStat = {
  expected: string;
  confusedWith: string;
  exposures: number;
  errors: number;
  errorRate: number;
  averageLatencyMs: number;
  score: number;
};

export type WeaknessDrill = {
  id: string;
  label: string;
  targets: string[];
  confusions: string[];
  exposures: number;
  errors: number;
  errorRate: number;
  text: string;
};

export type OneHandSide = 'left' | 'right';

export type OneHandDrill = {
  side: OneHandSide;
  keys: string[];
  priorityKeys: string[];
  text: string;
};

export type DailyStat = {
  date: string;
  label: string;
  wpm: number;
  accuracy: number;
  sessions: number;
};

export type TypingLanguage = 'thai' | 'english';

export type SessionLanguageMetric = {
  wpm: number;
  accuracy: number;
  typedCharacters: number;
  correctCharacters: number;
  durationMs: number;
};

export type SessionLanguageMetrics = Record<
  TypingLanguage,
  SessionLanguageMetric | null
>;

export type ProgressMetrics = {
  totalSessions: number;
  averageWpm: number;
  averageAccuracy: number;
  bestWpm: number;
  daily: DailyStat[];
};

export type Analytics = {
  totalSessions: number;
  averageWpm: number;
  averageAccuracy: number;
  bestWpm: number;
  streak: number;
  daily: DailyStat[];
  language: Record<TypingLanguage, ProgressMetrics>;
  weaknesses: WeaknessStat[];
  drills: WeaknessDrill[];
  drillText: string;
  oneHandDrills: Record<OneHandSide, OneHandDrill>;
};

export type BootstrapData = {
  sources: SourceRecord[];
  passages: PassageRecord[];
  sessions: SessionSummary[];
  benchmark: BenchmarkData;
  studyProgress: StudyProgressRecord[];
  practiceProgress: PracticeProgressRecord[];
  analytics: Analytics;
};
