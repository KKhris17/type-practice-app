import { count, eq, inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/database';
import { passages, sources } from '@/database/schema';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      sourceId?: unknown;
      collectionId?: unknown;
    };
    const sourceId =
      typeof body.sourceId === 'string' && body.sourceId
        ? body.sourceId
        : undefined;
    const collectionId =
      typeof body.collectionId === 'string' && body.collectionId
        ? body.collectionId
        : undefined;
    if ((sourceId ? 1 : 0) + (collectionId ? 1 : 0) !== 1) {
      return NextResponse.json(
        {
          error: 'Choose exactly one source part or collection to delete.',
        },
        { status: 400 },
      );
    }

    const db = getDb();
    const targets = collectionId
      ? await db
          .select({ id: sources.id })
          .from(sources)
          .where(eq(sources.collectionId, collectionId))
          .all()
      : await db
          .select({ id: sources.id })
          .from(sources)
          .where(eq(sources.id, sourceId!))
          .all();
    if (targets.length === 0) {
      return NextResponse.json(
        { error: 'The selected source was not found.' },
        { status: 404 },
      );
    }

    const targetIds = targets.map((target) => target.id);
    const passageCountRow = await db
      .select({ count: count() })
      .from(passages)
      .where(inArray(passages.sourceId, targetIds))
      .get();
    const deletedSetCount = passageCountRow?.count ?? 0;

    if (collectionId) {
      await db
        .delete(sources)
        .where(eq(sources.collectionId, collectionId))
        .run();
    } else {
      await db.delete(sources).where(eq(sources.id, sourceId!)).run();
    }

    return NextResponse.json({
      deletedPartCount: targets.length,
      deletedSetCount,
    });
  } catch (error) {
    console.error('Failed to delete source', error);
    return NextResponse.json(
      { error: 'The selected source could not be deleted.' },
      { status: 500 },
    );
  }
}
