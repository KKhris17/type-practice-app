import { eq, inArray, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/database';
import {
  passages,
  practicePassageProgress,
  sessions,
  studyLessonProgress,
} from '@/database/schema';
import {
  getStudyCourse,
  getStudyLesson,
  getStudyLessonText,
  STUDY_PASS_ACCURACY,
} from '@/shared/study-curriculum';
import { computeSessionLanguageMetrics } from '@/shared/typing-metrics';
import { getBenchmarkForm } from '@/shared/benchmark';
import type { TypingEvent } from '@/shared/types';

export const dynamic = 'force-dynamic';

type SessionInput = {
  passageId?: string | null;
  studyLessonId?: unknown;
  benchmarkFormId?: unknown;
  benchmarkBaselineId?: unknown;
  mode?: unknown;
  expectedText?: unknown;
  finalText?: unknown;
  events?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  completionKind?: unknown;
  completedPracticePassageIds?: unknown;
};

function isTypingEvent(value: unknown): value is TypingEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<TypingEvent>;
  return (
    ['insert', 'backspace', 'delete'].includes(event.action ?? '') &&
    typeof event.key === 'string' &&
    typeof event.expected === 'string' &&
    typeof event.position === 'number' &&
    typeof event.correct === 'boolean' &&
    typeof event.atMs === 'number' &&
    typeof event.latencyMs === 'number'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SessionInput;
    const events = Array.isArray(body.events) ? body.events : [];
    const completedPracticePassageIds = Array.isArray(
      body.completedPracticePassageIds,
    )
      ? body.completedPracticePassageIds
      : [];
    if (
      !['study', 'lesson', 'drill', 'one-hand', 'benchmark', 'speed-drill'].includes(String(body.mode)) ||
      !['sets', 'time'].includes(String(body.completionKind)) ||
      typeof body.expectedText !== 'string' ||
      typeof body.finalText !== 'string' ||
      typeof body.startedAt !== 'number' ||
      typeof body.completedAt !== 'number' ||
      body.expectedText.length > 10_000 ||
      body.finalText.length > 10_024 ||
      events.length > 10_000 ||
      !events.every(isTypingEvent) ||
      completedPracticePassageIds.length > 50 ||
      !completedPracticePassageIds.every(
        (passageId) => typeof passageId === 'string' && passageId.length > 0,
      ) ||
      new Set(completedPracticePassageIds).size !==
        completedPracticePassageIds.length ||
      (body.mode !== 'study' && completedPracticePassageIds.length > 0)
    ) {
      return NextResponse.json(
        { error: 'Invalid session data.' },
        { status: 400 },
      );
    }

    const studyLesson =
      body.mode === 'lesson' && typeof body.studyLessonId === 'string'
        ? getStudyLesson(body.studyLessonId)
        : undefined;
    if (
      body.mode === 'lesson' &&
      (!studyLesson ||
        body.expectedText !== getStudyLessonText(studyLesson) ||
        body.completionKind !== 'sets')
    ) {
      return NextResponse.json(
        { error: 'Invalid study lesson.' },
        { status: 400 },
      );
    }

    const benchmarkForm =
      body.mode === 'benchmark' && typeof body.benchmarkFormId === 'string'
        ? getBenchmarkForm(body.benchmarkFormId)
        : undefined;
    if (
      (body.mode === 'benchmark' &&
        (!benchmarkForm ||
          body.expectedText !== benchmarkForm.text ||
          body.completionKind !== 'sets' ||
          body.passageId ||
          body.studyLessonId)) ||
      (body.mode !== 'benchmark' &&
        (body.benchmarkFormId || body.benchmarkBaselineId)) ||
      (body.mode === 'speed-drill' && body.completionKind !== 'sets') ||
      (body.benchmarkBaselineId != null &&
        (typeof body.benchmarkBaselineId !== 'string' ||
          body.benchmarkBaselineId.length === 0 ||
          body.benchmarkBaselineId.length > 100))
    ) {
      return NextResponse.json(
        { error: 'Invalid benchmark session.' },
        { status: 400 },
      );
    }

    const db = getDb();
    if (body.mode === 'benchmark' && body.benchmarkBaselineId) {
      const baseline = await db
        .select({
          mode: sessions.mode,
          formId: sessions.benchmarkFormId,
          baselineId: sessions.benchmarkBaselineId,
        })
        .from(sessions)
        .where(eq(sessions.id, body.benchmarkBaselineId as string))
        .get();
      if (
        baseline?.mode !== 'benchmark' ||
        baseline.baselineId ||
        baseline.formId === benchmarkForm?.id ||
        !getBenchmarkForm(baseline.formId)
      ) {
        return NextResponse.json(
          { error: 'The benchmark baseline is unavailable or uses this form.' },
          { status: 409 },
        );
      }
    }
    if (completedPracticePassageIds.length > 0) {
      const existingPassages = await db
        .select({ id: passages.id })
        .from(passages)
        .where(inArray(passages.id, completedPracticePassageIds as string[]))
        .all();
      if (existingPassages.length !== completedPracticePassageIds.length) {
        return NextResponse.json(
          { error: 'One or more completed Practice sets no longer exist.' },
          { status: 409 },
        );
      }
    }
    if (studyLesson) {
      const courseLessons = getStudyCourse(studyLesson.language).lessons;
      const lessonIndex = courseLessons.findIndex(
        (lesson) => lesson.id === studyLesson.id,
      );
      const previousLesson = courseLessons[lessonIndex - 1];
      if (previousLesson) {
        const prerequisite = await db
          .select()
          .from(studyLessonProgress)
          .where(eq(studyLessonProgress.lessonId, previousLesson.id))
          .get();
        if (!prerequisite?.passedAt) {
          return NextResponse.json(
            { error: 'Complete the previous study lesson first.' },
            { status: 409 },
          );
        }
      }
    }

    if (
      body.completionKind === 'sets' &&
      body.finalText.length < body.expectedText.length
    ) {
      return NextResponse.json(
        { error: 'A set session must reach the end of the passage.' },
        { status: 400 },
      );
    }

    const durationMs = Math.max(1_000, body.completedAt - body.startedAt);
    if (durationMs > 86_400_000 || body.completedAt < body.startedAt) {
      return NextResponse.json(
        { error: 'Invalid session duration.' },
        { status: 400 },
      );
    }

    const expectedText = body.expectedText;
    const finalText = body.finalText;
    const completedAt = body.completedAt;
    const insertions = events.filter((event) => event.action === 'insert');
    const correctInsertions = insertions.filter(
      (event) => event.correct,
    ).length;
    const rawErrors = insertions.length - correctInsertions;
    const corrections = events.filter(
      (event) => event.action !== 'insert',
    ).length;
    const finalCorrect = finalText
      .split('')
      .filter((character, index) => character === expectedText[index]).length;
    const elapsedMinutes = durationMs / 60_000;
    const wpm = Math.max(0, Math.round(finalCorrect / 5 / elapsedMinutes));
    const accuracy = insertions.length
      ? Math.floor((correctInsertions / insertions.length) * 100)
      : 100;
    const language = computeSessionLanguageMetrics(events);
    const id = crypto.randomUUID();

    const sessionInsert = db.insert(sessions).values({
      id,
      passageId:
        typeof body.passageId === 'string' && body.passageId
          ? body.passageId
          : null,
      studyLessonId: studyLesson?.id ?? null,
      mode: body.mode as 'study' | 'lesson' | 'drill' | 'one-hand' | 'benchmark' | 'speed-drill',
      benchmarkFormId: benchmarkForm?.id ?? null,
      benchmarkBaselineId:
        body.mode === 'benchmark' && typeof body.benchmarkBaselineId === 'string'
          ? body.benchmarkBaselineId
          : null,
      expectedText,
      finalText,
      eventsJson: JSON.stringify(events),
      startedAt: new Date(body.startedAt),
      completedAt: new Date(body.completedAt),
      durationMs,
      wpm,
      accuracy,
      rawErrors,
      corrections,
      completionKind: body.completionKind as 'sets' | 'time',
    });

    if (studyLesson) {
      const existingProgress = await db
        .select()
        .from(studyLessonProgress)
        .where(eq(studyLessonProgress.lessonId, studyLesson.id))
        .get();
      const isBestRound =
        !existingProgress ||
        accuracy > existingProgress.bestAccuracy ||
        (accuracy === existingProgress.bestAccuracy &&
          durationMs < existingProgress.bestDurationMs);
      const passed = accuracy >= STUDY_PASS_ACCURACY;
      const progressInsert = db
        .insert(studyLessonProgress)
        .values({
          lessonId: studyLesson.id,
          bestAccuracy: isBestRound ? accuracy : existingProgress.bestAccuracy,
          bestDurationMs: isBestRound
            ? durationMs
            : existingProgress.bestDurationMs,
          attempts: (existingProgress?.attempts ?? 0) + 1,
          passedAt:
            existingProgress?.passedAt ??
            (passed ? new Date(completedAt) : null),
          lastPracticedAt: new Date(completedAt),
        })
        .onConflictDoUpdate({
          target: studyLessonProgress.lessonId,
          set: {
            bestAccuracy: isBestRound
              ? accuracy
              : existingProgress.bestAccuracy,
            bestDurationMs: isBestRound
              ? durationMs
              : existingProgress.bestDurationMs,
            attempts: (existingProgress?.attempts ?? 0) + 1,
            passedAt:
              existingProgress?.passedAt ??
              (passed ? new Date(completedAt) : null),
            lastPracticedAt: new Date(completedAt),
          },
        });
      await db.batch([sessionInsert, progressInsert]);
    } else if (completedPracticePassageIds.length > 0) {
      const progressInserts = (completedPracticePassageIds as string[]).map(
        (passageId) =>
          db
            .insert(practicePassageProgress)
            .values({
              passageId,
              completions: 1,
              firstCompletedAt: new Date(completedAt),
              lastCompletedAt: new Date(completedAt),
            })
            .onConflictDoUpdate({
              target: practicePassageProgress.passageId,
              set: {
                completions: sql`${practicePassageProgress.completions} + 1`,
                lastCompletedAt: new Date(completedAt),
              },
            }),
      );
      await db.batch([sessionInsert, ...progressInserts] as [
        typeof sessionInsert,
        ...typeof progressInserts,
      ]);
    } else {
      await sessionInsert.run();
    }

    return NextResponse.json(
      {
        id,
        wpm,
        accuracy,
        language,
        rawErrors,
        corrections,
        durationMs,
        studyPassed: studyLesson ? accuracy >= STUDY_PASS_ACCURACY : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Failed to save session', error);
    return NextResponse.json(
      { error: 'The session could not be saved.' },
      { status: 500 },
    );
  }
}
