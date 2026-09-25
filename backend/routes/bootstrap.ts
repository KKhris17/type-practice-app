import { desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/database';
import {
  passages,
  practicePassageProgress,
  practicePassageResets,
  sessions,
  sources,
  studyLessonProgress,
} from '@/database/schema';
import { computeAnalytics } from '@/backend/analytics';
import { analyzeBenchmarkAttempts } from '@/shared/benchmark';
import type { BootstrapData, Evidence, TypingEvent } from '@/shared/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const timeZone = request.nextUrl.searchParams.get('tz') || 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone });
  } catch {
    return NextResponse.json({ error: 'Invalid time zone.' }, { status: 400 });
  }

  try {
    const db = getDb();
    const [
      sourceRows,
      passageRows,
      sessionRows,
      benchmarkRows,
      studyProgressRows,
      practiceProgressRows,
      practiceResetRows,
    ] = await Promise.all([
      db.select().from(sources).orderBy(desc(sources.importedAt)).all(),
      db.select().from(passages).orderBy(passages.orderIndex).all(),
      db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.completedAt))
        .limit(500)
        .all(),
      db
        .select()
        .from(sessions)
        .where(eq(sessions.mode, 'benchmark'))
        .orderBy(desc(sessions.completedAt))
        .limit(100)
        .all(),
      db.select().from(studyLessonProgress).all(),
      db.select().from(practicePassageProgress).all(),
      db.select().from(practicePassageResets).all(),
    ]);

    const countBySource = new Map<string, number>();
    for (const passage of passageRows) {
      countBySource.set(
        passage.sourceId,
        (countBySource.get(passage.sourceId) ?? 0) + 1,
      );
    }

    const durablePracticeProgress = new Map(
      practiceProgressRows.map((progress) => [progress.passageId, progress]),
    );
    const resetAtByPassageId = new Map(
      practiceResetRows.map((reset) => [
        reset.passageId,
        reset.resetAt.getTime(),
      ]),
    );
    const legacyPracticeProgress = new Map<
      string,
      { completions: number; firstCompletedAt: Date; lastCompletedAt: Date }
    >();
    for (const session of sessionRows) {
      if (
        session.mode !== 'study' ||
        !session.passageId ||
        session.completionKind !== 'sets' ||
        session.finalText.length < session.expectedText.length ||
        durablePracticeProgress.has(session.passageId) ||
        session.completedAt.getTime() <=
          (resetAtByPassageId.get(session.passageId) ?? 0)
      ) {
        continue;
      }
      const current = legacyPracticeProgress.get(session.passageId);
      legacyPracticeProgress.set(session.passageId, {
        completions: (current?.completions ?? 0) + 1,
        firstCompletedAt:
          !current || session.completedAt < current.firstCompletedAt
            ? session.completedAt
            : current.firstCompletedAt,
        lastCompletedAt:
          !current || session.completedAt > current.lastCompletedAt
            ? session.completedAt
            : current.lastCompletedAt,
      });
    }

    const benchmarkAnalysis = analyzeBenchmarkAttempts(
      benchmarkRows.flatMap((session) => {
        if (!session.benchmarkFormId) return [];
        try {
          return [{
            id: session.id,
            formId: session.benchmarkFormId,
            baselineId: session.benchmarkBaselineId,
            expectedText: session.expectedText,
            finalText: session.finalText,
            events: JSON.parse(session.eventsJson) as TypingEvent[],
            wpm: session.wpm,
            accuracy: session.accuracy,
          }];
        } catch {
          return [];
        }
      }),
    );

    const data: BootstrapData = {
      sources: sourceRows.map((source) => ({
        ...source,
        collectionId: source.collectionId || undefined,
        collectionTitle: source.collectionTitle || undefined,
        partTitle: source.partTitle || undefined,
        sourceUrl: source.sourceUrl || undefined,
        importedAt: source.importedAt.getTime(),
        passageCount: countBySource.get(source.id) ?? 0,
      })),
      passages: passageRows.map((passage) => ({
        id: passage.id,
        sourceId: passage.sourceId,
        title: passage.title,
        content: passage.content,
        thaiExplanation: passage.thaiExplanation,
        wordCount: passage.wordCount,
        orderIndex: passage.orderIndex,
        evidence: JSON.parse(passage.evidenceJson) as Evidence[],
      })),
      sessions: sessionRows.map((session) => ({
        id: session.id,
        passageId: session.passageId,
        studyLessonId: session.studyLessonId,
        mode: session.mode,
        completedAt: session.completedAt.getTime(),
        durationMs: session.durationMs,
        wpm: session.wpm,
        accuracy: session.accuracy,
        rawErrors: session.rawErrors,
        corrections: session.corrections,
      })),
      benchmark: {
        sessions: benchmarkRows.flatMap((session) =>
          session.benchmarkFormId
            ? [{
                id: session.id,
                passageId: session.passageId,
                studyLessonId: session.studyLessonId,
                mode: 'benchmark' as const,
                benchmarkFormId: session.benchmarkFormId,
                benchmarkBaselineId: session.benchmarkBaselineId,
                completedAt: session.completedAt.getTime(),
                durationMs: session.durationMs,
                wpm: session.wpm,
                accuracy: session.accuracy,
                rawErrors: session.rawErrors,
                corrections: session.corrections,
              }]
            : [],
        ),
        ...benchmarkAnalysis,
      },
      studyProgress: studyProgressRows.map((progress) => ({
        lessonId: progress.lessonId,
        bestAccuracy: progress.bestAccuracy,
        bestDurationMs: progress.bestDurationMs,
        attempts: progress.attempts,
        passedAt: progress.passedAt?.getTime() ?? null,
        lastPracticedAt: progress.lastPracticedAt.getTime(),
      })),
      practiceProgress: [
        ...practiceProgressRows.map((progress) => ({
          passageId: progress.passageId,
          completions: progress.completions,
          firstCompletedAt: progress.firstCompletedAt.getTime(),
          lastCompletedAt: progress.lastCompletedAt.getTime(),
        })),
        ...[...legacyPracticeProgress.entries()].map(
          ([passageId, progress]) => ({
            passageId,
            completions: progress.completions,
            firstCompletedAt: progress.firstCompletedAt.getTime(),
            lastCompletedAt: progress.lastCompletedAt.getTime(),
          }),
        ),
      ],
      analytics: computeAnalytics(sessionRows, timeZone),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to load app data', error);
    return NextResponse.json(
      { error: 'The local database is unavailable. Run npm run db:migrate.' },
      { status: 500 },
    );
  }
}
