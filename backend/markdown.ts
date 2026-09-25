import type { Evidence, ParsedSource } from '@/shared/types';

export class MarkdownFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownFormatError';
  }
}

function normalizeBlock(value: string) {
  return value
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .join(' ')
    .replace(/\s+/g, ' ');
}

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) {
    throw new MarkdownFormatError('Missing YAML-style frontmatter block.');
  }

  const values: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    values[key] = value;
  }
  return { values, body: markdown.slice(match[0].length) };
}

function parseEvidence(section: string, setTitle: string): Evidence[] {
  const evidence: Evidence[] = [];
  const evidencePattern =
    /^#### Evidence:\s*(.+)\n([\s\S]*?)(?=^#### Evidence:|^## Set:|(?![\s\S]))/gm;

  for (const match of section.matchAll(evidencePattern)) {
    const block = match[2];
    const locator = block.match(/^- Locator:\s*(.+)$/m)?.[1]?.trim();
    const url = block.match(/^- URL:\s*(.+)$/m)?.[1]?.trim();
    const excerpt = block.match(/```evidence\s*\n([\s\S]*?)```/)?.[1]?.trim();

    if (!locator || !excerpt) {
      throw new MarkdownFormatError(
        `Set “${setTitle}” has evidence without both a locator and excerpt.`,
      );
    }

    evidence.push({
      label: match[1].trim(),
      locator,
      url: url || undefined,
      excerpt,
    });
  }

  if (evidence.length === 0) {
    throw new MarkdownFormatError(
      `Set “${setTitle}” needs at least one Evidence block.`,
    );
  }
  return evidence;
}

export function parseTypePracticeMarkdown(markdown: string): ParsedSource {
  if (markdown.length > 1_000_000) {
    throw new MarkdownFormatError(
      'The Markdown file must be smaller than 1 MB.',
    );
  }

  const { values, body } = parseFrontmatter(markdown);
  if (values['type-practice-version'] !== '2') {
    throw new MarkdownFormatError('type-practice-version must be 2.');
  }
  if (!values.title || !values['source-title']) {
    throw new MarkdownFormatError('Frontmatter needs title and source-title.');
  }

  const collectionFields = [
    values['collection-id'],
    values['collection-title'],
    values['part-title'],
    values['part-order'],
  ];
  const hasCollectionMetadata = collectionFields.some(Boolean);
  if (hasCollectionMetadata && collectionFields.some((value) => !value)) {
    throw new MarkdownFormatError(
      'Collection imports need collection-id, collection-title, part-title, and part-order together.',
    );
  }
  if (
    hasCollectionMetadata &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values['collection-id'])
  ) {
    throw new MarkdownFormatError(
      'collection-id must be a lowercase slug such as “toeic-grammar”.',
    );
  }
  const partOrder = hasCollectionMetadata
    ? Number(values['part-order'])
    : undefined;
  if (
    hasCollectionMetadata &&
    (!Number.isSafeInteger(partOrder) || (partOrder ?? 0) < 1)
  ) {
    throw new MarkdownFormatError('part-order must be a positive integer.');
  }

  const setMatches = [...body.matchAll(/^## Set:\s*(.+)$/gm)];
  if (setMatches.length === 0) {
    throw new MarkdownFormatError('Add at least one “## Set:” section.');
  }
  if (setMatches.length > 100) {
    throw new MarkdownFormatError('A file can contain at most 100 sets.');
  }

  const passages = setMatches.map((setMatch, index) => {
    const start = (setMatch.index ?? 0) + setMatch[0].length;
    const end = setMatches[index + 1]?.index ?? body.length;
    const section = body.slice(start, end);
    const title = setMatch[1].trim();
    const contentMatch = section.match(/```passage\s*\n([\s\S]*?)```/);
    if (!contentMatch) {
      throw new MarkdownFormatError(
        `Set “${title}” is missing a fenced \`\`\`passage block.`,
      );
    }

    const content = normalizeBlock(contentMatch[1]);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (wordCount < 50 || wordCount > 100) {
      throw new MarkdownFormatError(
        `Set “${title}” has ${wordCount} words; each passage must contain 50–100.`,
      );
    }

    const thaiExplanationMatch = section.match(
      /```thai-explanation\s*\n([\s\S]*?)```/,
    );
    if (!thaiExplanationMatch) {
      throw new MarkdownFormatError(
        `Set “${title}” is missing a fenced \`\`\`thai-explanation block.`,
      );
    }
    const thaiExplanation = normalizeBlock(thaiExplanationMatch[1]);
    if (!thaiExplanation || !/[\u0E00-\u0E7F]/.test(thaiExplanation)) {
      throw new MarkdownFormatError(
        `Set “${title}” needs a non-empty explanation written in Thai.`,
      );
    }

    return {
      title,
      content,
      thaiExplanation,
      wordCount,
      evidence: parseEvidence(section, title),
    };
  });

  return {
    title: values.title,
    collectionId: hasCollectionMetadata ? values['collection-id'] : undefined,
    collectionTitle: hasCollectionMetadata
      ? values['collection-title']
      : undefined,
    partTitle: hasCollectionMetadata ? values['part-title'] : undefined,
    partOrder,
    sourceTitle: values['source-title'],
    sourceUrl: values['source-url'] || undefined,
    passages,
  };
}
