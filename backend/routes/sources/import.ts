import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/database';
import { passages, sources } from '@/database/schema';
import { MarkdownFormatError, parseTypePracticeMarkdown } from '@/backend/markdown';

export const dynamic = 'force-dynamic';

const PASSAGE_INSERT_BATCH_SIZE = 10;

function chunksOf<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function duplicatePassageKey(content: string) {
  return content.trim().replace(/\s+/g, ' ');
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      filename?: unknown;
      markdown?: unknown;
    };
    if (
      typeof body.filename !== 'string' ||
      !body.filename.toLowerCase().endsWith('.md') ||
      typeof body.markdown !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Choose a valid .md file.' },
        { status: 400 },
      );
    }

    const parsed = parseTypePracticeMarkdown(body.markdown);
    const contentHash = await sha256(body.markdown);
    const db = getDb();
    const duplicate = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.contentHash, contentHash))
      .limit(1)
      .all();

    if (duplicate.length > 0) {
      return NextResponse.json(
        {
          code: 'DUPLICATE_FILE',
          error: 'This exact file has already been imported.',
        },
        { status: 409 },
      );
    }

    const existingPassages = await db
      .select({ content: passages.content })
      .from(passages)
      .all();
    const knownPassages = new Set(
      existingPassages.map((passage) => duplicatePassageKey(passage.content)),
    );
    const uniquePassages = [];
    let duplicateSetCount = 0;
    for (const passage of parsed.passages) {
      const key = duplicatePassageKey(passage.content);
      if (knownPassages.has(key)) {
        duplicateSetCount += 1;
        continue;
      }
      knownPassages.add(key);
      uniquePassages.push(passage);
    }

    if (uniquePassages.length === 0) {
      return NextResponse.json({
        code: 'NO_UNIQUE_SETS',
        source: null,
        importedSetCount: 0,
        duplicateSetCount,
      });
    }

    if (parsed.collectionId) {
      const collectionParts = await db
        .select({
          collectionTitle: sources.collectionTitle,
          partTitle: sources.partTitle,
          partOrder: sources.partOrder,
        })
        .from(sources)
        .where(eq(sources.collectionId, parsed.collectionId))
        .all();
      const existingCollectionTitle = collectionParts[0]?.collectionTitle;
      if (
        existingCollectionTitle &&
        existingCollectionTitle !== parsed.collectionTitle
      ) {
        return NextResponse.json(
          {
            code: 'COLLECTION_TITLE_CONFLICT',
            error: `Collection “${parsed.collectionId}” already uses the title “${existingCollectionTitle}”. Use the same collection-title in every part.`,
            duplicateSetCount,
          },
          { status: 409 },
        );
      }
      const duplicatePart = collectionParts.find(
        (part) =>
          part.partOrder === parsed.partOrder ||
          part.partTitle === parsed.partTitle,
      );
      if (duplicatePart) {
        return NextResponse.json(
          {
            code: 'DUPLICATE_PART',
            error: `This collection already has part ${duplicatePart.partOrder}: “${duplicatePart.partTitle}”. Use a unique part-title and part-order.`,
            duplicateSetCount,
          },
          { status: 409 },
        );
      }
    }

    const sourceId = crypto.randomUUID();
    const importedAt = new Date();
    await db
      .insert(sources)
      .values({
        id: sourceId,
        title: parsed.title,
        collectionId: parsed.collectionId,
        collectionTitle: parsed.collectionTitle,
        partTitle: parsed.partTitle,
        partOrder: parsed.partOrder,
        originalFileName: body.filename,
        sourceTitle: parsed.sourceTitle,
        sourceUrl: parsed.sourceUrl,
        contentHash,
        importedAt,
      })
      .run();

    try {
      const passageValues = uniquePassages.map((passage, index) => ({
        id: crypto.randomUUID(),
        sourceId,
        title: passage.title,
        content: passage.content,
        thaiExplanation: passage.thaiExplanation,
        wordCount: passage.wordCount,
        orderIndex: index,
        evidenceJson: JSON.stringify(passage.evidence),
      }));
      const [firstInsert, ...remainingInserts] = chunksOf(
        passageValues,
        PASSAGE_INSERT_BATCH_SIZE,
      ).map((batch) => db.insert(passages).values(batch));
      if (!firstInsert) {
        throw new Error('The parsed source did not contain any passages.');
      }
      await db.batch([firstInsert, ...remainingInserts]);
    } catch (error) {
      await db.delete(sources).where(eq(sources.id, sourceId)).run();
      throw error;
    }

    return NextResponse.json(
      {
        source: {
          id: sourceId,
          title: parsed.title,
          collectionId: parsed.collectionId,
          collectionTitle: parsed.collectionTitle,
          partTitle: parsed.partTitle,
          partOrder: parsed.partOrder,
          originalFileName: body.filename,
          sourceTitle: parsed.sourceTitle,
          sourceUrl: parsed.sourceUrl,
          importedAt: importedAt.getTime(),
          passageCount: uniquePassages.length,
        },
        importedSetCount: uniquePassages.length,
        duplicateSetCount,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof MarkdownFormatError) {
      return NextResponse.json(
        { code: 'INVALID_MARKDOWN', error: error.message },
        { status: 422 },
      );
    }
    console.error('Failed to import source', error);
    return NextResponse.json(
      {
        code: 'IMPORT_FAILED',
        error: 'The source could not be imported.',
      },
      { status: 500 },
    );
  }
}
