import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable(
  'sources',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    collectionId: text('collection_id'),
    collectionTitle: text('collection_title'),
    partTitle: text('part_title'),
    partOrder: integer('part_order'),
    originalFileName: text('original_file_name').notNull(),
    sourceTitle: text('source_title').notNull(),
    sourceUrl: text('source_url'),
    contentHash: text('content_hash').notNull().unique(),
    importedAt: integer('imported_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('idx_sources_collection_id').on(table.collectionId)],
);

export const passages = sqliteTable(
  'passages',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    thaiExplanation: text('thai_explanation'),
    wordCount: integer('word_count').notNull(),
    orderIndex: integer('order_index').notNull(),
    evidenceJson: text('evidence_json').notNull(),
  },
  (table) => [index('idx_passages_source_id').on(table.sourceId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    passageId: text('passage_id').references(() => passages.id, {
      onDelete: 'set null',
    }),
    studyLessonId: text('study_lesson_id'),
    mode: text('mode', {
      enum: ['study', 'lesson', 'drill', 'one-hand', 'benchmark', 'speed-drill'],
    }).notNull(),
    benchmarkFormId: text('benchmark_form_id'),
    benchmarkBaselineId: text('benchmark_baseline_id'),
    expectedText: text('expected_text').notNull(),
    finalText: text('final_text').notNull(),
    eventsJson: text('events_json').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }).notNull(),
    durationMs: integer('duration_ms').notNull(),
    wpm: integer('wpm').notNull(),
    accuracy: integer('accuracy').notNull(),
    rawErrors: integer('raw_errors').notNull(),
    corrections: integer('corrections').notNull(),
    completionKind: text('completion_kind', {
      enum: ['sets', 'time'],
    }).notNull(),
  },
  (table) => [
    index('idx_sessions_completed_at').on(table.completedAt),
    index('idx_sessions_mode_completed_at').on(table.mode, table.completedAt),
  ],
);

export const studyLessonProgress = sqliteTable('study_lesson_progress', {
  lessonId: text('lesson_id').primaryKey(),
  bestAccuracy: integer('best_accuracy').notNull(),
  bestDurationMs: integer('best_duration_ms').notNull(),
  attempts: integer('attempts').notNull(),
  passedAt: integer('passed_at', { mode: 'timestamp_ms' }),
  lastPracticedAt: integer('last_practiced_at', {
    mode: 'timestamp_ms',
  }).notNull(),
});

export const practicePassageProgress = sqliteTable(
  'practice_passage_progress',
  {
    passageId: text('passage_id')
      .primaryKey()
      .references(() => passages.id, { onDelete: 'cascade' }),
    completions: integer('completions').notNull(),
    firstCompletedAt: integer('first_completed_at', {
      mode: 'timestamp_ms',
    }).notNull(),
    lastCompletedAt: integer('last_completed_at', {
      mode: 'timestamp_ms',
    }).notNull(),
  },
);

export const practicePassageResets = sqliteTable('practice_passage_resets', {
  passageId: text('passage_id')
    .primaryKey()
    .references(() => passages.id, { onDelete: 'cascade' }),
  resetAt: integer('reset_at', { mode: 'timestamp_ms' }).notNull(),
});

export type Source = typeof sources.$inferSelect;
export type Passage = typeof passages.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type StudyLessonProgress = typeof studyLessonProgress.$inferSelect;
export type PracticePassageProgress =
  typeof practicePassageProgress.$inferSelect;
export type PracticePassageReset = typeof practicePassageResets.$inferSelect;
