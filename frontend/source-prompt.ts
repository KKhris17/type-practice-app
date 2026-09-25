export const SOURCE_TO_MARKDOWN_PROMPT = `Help me create one source-grounded Markdown file that can be imported into Type Practice.

Mandatory intake workflow:
- On your first response, do not create the Markdown file, summarize the topic, or begin research yet.
- Reply only with these two concise questions. Use the same language as the user when it is clear:
  1. What topic, subject, or learning scope should the typing sets cover? If this continues an existing collection, ask for its exact collection-id, collection-title, and the next part number.
  2. Which sources should be used? Ask the user to attach files, paste source text, provide URLs, or explicitly authorize web search and name any preferred sources.
- Wait for the user's answers before continuing.
- If the topic or source basis is still ambiguous, ask only the minimum focused follow-up needed. Never choose a topic or source on the user's behalf.
- If a supplied file or URL cannot be accessed or does not contain enough evidence, explain what is missing and request another source instead of filling the gap.
- Once the topic and usable sources are confirmed, create the final Markdown document using all rules below.

Grounding rules:
- Use only facts supported by the source material selected or approved by the user. Do not add facts from memory, inference, or general knowledge.
- When the user explicitly authorizes web search, use reliable primary or authoritative sources whenever available. Every web-derived claim must still be supported by an exact evidence excerpt, locator, and URL in the same set.
- Do not search the web unless the user selects web search as a source method.
- If the source does not support a claim, omit it. Never fill gaps or invent supporting evidence.
- Preserve the source's wording and technical terminology when they remain clear and grammatically correct. Paraphrase only when needed to form a coherent passage.
- If the source is not in English, translate it faithfully into natural, grammatically correct English without changing its meaning.
- Every factual statement in each passage must be supported by one or more evidence excerpts included in the same set.
- Every instructional claim in the Thai explanation, including a definition, contrast, usage condition, example analysis, or takeaway, must also be supported by the Evidence in the same set.
- Copy every evidence excerpt exactly from the source. Do not paraphrase evidence.
- Give each excerpt a precise locator, such as a page number, section heading, paragraph, timestamp, or line range.
- Include a URL only when it is known from the supplied material. Omit URL fields when no URL is available.

Passage rules:
- Each passage must contain 50-100 words, counted by whitespace.
- Use complete, grammatically correct sentences that form a self-contained idea.
- Every sentence must add a distinct, useful, source-supported point. Do not repeat, restate, or lightly paraphrase the same claim merely to reach the word limit.
- Do not use filler, circular explanations, or formulaic phrases such as "in other words" and "the same rule can be stated" unless the source genuinely requires that distinction.
- Keep sets distinct and non-duplicative. Create only sets that the source clearly supports; do not pad the output.
- Inside passage blocks, use only characters available on a standard US QWERTY keyboard. Use straight quotation marks, straight apostrophes, and hyphens instead of typographic punctuation.
- Create between 1 and 100 sets in one file. Never put more than 100 sets in a file.
- If the source supports fewer complete, non-repetitive sets, create fewer sets. Evidence quality is more important than set count.

Thai typing passage and teaching rules:
- After every English passage, write a learner-oriented Thai explanation of its complete meaning. Type Practice uses this block as the Thai typing passage before the English passage, so it must work both as a clear explanation and as natural continuous typing practice.
- Write complete Thai sentences in one plain-text paragraph. Do not put Markdown headings, bullets, numbered lists, tables, inline code, URLs, citations, evidence labels, or formatting marks inside the thai-explanation block.
- Make the Thai text comfortable to type with a standard Thai Kedmanee keyboard. Avoid emoji, curly quotation marks, typographic apostrophes, en dashes, em dashes, ellipses, invisible characters, and decorative symbols. Use ordinary Thai punctuation and simple ASCII punctuation available from the layout.
- Prefer Thai wording throughout the Thai block. Include a Latin-script technical term only when retaining the exact term materially helps the learner; use it no more than necessary and keep it in one uninterrupted phrase so the learner does not have to switch keyboard layouts repeatedly.
- Spell out quantities in Thai when practical. Use Arabic digits only when the exact number or notation is important to the source-grounded meaning.
- Keep the explanation focused enough to type before the English passage. Usually use 2-6 complete sentences; exceed that only when the source-supported concept genuinely cannot be explained clearly within that range.
- Assume the learner may be encountering the topic and its technical terms for the first time.
- Teach the source-grounded idea instead of translating the passage sentence by sentence.
- Begin with a brief plain-Thai orientation: explain what the topic is about and what question, relationship, or distinction the learner is trying to understand. Do not begin with unexplained technical terminology when a short introduction would make the idea clearer.
- When an English technical term first appears, immediately give a short Thai meaning or plain-language explanation in parentheses. Explain what the term means in this context; do not merely transliterate or give its pronunciation. The definition itself must be supported by the Evidence in the same set.
- Explain, in a logical order, what the concept is, when it applies, what role it serves, what the learner should notice, and how it differs from a closely related concept only when each point is relevant and supported by the source. Do not force every explanation to cover points the source does not establish.
- For a grammar or language set, identify the exact word, form, or sentence structure where the rule operates. Explain its function and the reason for choosing that form only to the extent supported by the source.
- Include a short example sentence only when it materially improves understanding. Each example must demonstrate one main point, use simple vocabulary and structure, and be easy to inspect.
- Prefer an example quoted directly from the approved source when suitable. If you create a new example, it must be a direct, minimal illustration of a pattern explicitly supported by the Evidence in the same set.
- After each example, briefly identify the word or structure that demonstrates the target point and explain why it has that form. Do not use an example or its analysis to introduce a new fact, rule, exception, vocabulary meaning, usage condition, or grammatical behavior.
- The Thai explanation has no requirement to match the English passage in length. Expand only as much as needed to define prerequisite terms, unpack relationships, or walk through a supported example. Clarity is more important than brevity, but do not turn one set into a comprehensive lesson or add outside knowledge.
- When useful, end with one concise sentence beginning “สิ่งที่ควรจำ -” that states what the learner should notice or remember. It must summarize an already-supported point and must not introduce a new rule.
- The Thai explanation must faithfully teach only the meaning and relationships supported by the passage and its Evidence. If the source does not support the background, distinction, definition, or example needed for a clear explanation, omit that material or request better source material; never fill the gap from memory.

Collection and part rules:
- Treat the user's overall topic as a collection. Give it one stable lowercase kebab-case collection-id and one stable collection-title.
- A file is one part of that collection. Give every file a concise part-title and a positive integer part-order starting at 1.
- Use the exact same collection-id and collection-title in every related file. This is how Type Practice groups separately imported files into one topic.
- Keep part-title and part-order unique within the collection. When continuing the same collection, preserve the previous collection metadata and increment part-order.
- If the topic needs more than 100 sets, create at most 100 in the current file. The user can ask for the next non-overlapping part afterward.
- If the user supplies several named files or sections and wants them kept as parts, use those labels as part titles and assign their intended sequence as part-order.
- Do not repeat a set, claim, or exercise from an earlier part in the same collection.

Final output rules (after the intake is complete):
- Output only the completed Markdown document. Do not add an introduction, explanation, checklist, or outer code fence.
- Infer a concise collection title, part title, and primary source title from the supplied material. Use the topic as the collection and the current file scope as the part.
- Follow the schema and heading text exactly.
- Before answering, silently verify that there are no more than 100 sets, count every passage, remove repeated claims, check sentence-by-sentence evidence coverage, and confirm that all collection fields are present.
- Silently audit every Thai explanation: it must be natural plain-text Thai suitable for Kedmanee typing before the English passage; a beginner should be able to identify the main idea; first-use technical terms should have meaningful Thai explanations; every teaching claim and example analysis should be traceable to Evidence in that set; and no example or takeaway should add unsupported knowledge.

Exact schema:

---
type-practice-version: 2
title: [CONCISE PART TITLE]
collection-id: [STABLE LOWERCASE KEBAB-CASE COLLECTION ID]
collection-title: [STABLE COLLECTION TITLE SHARED BY ALL PARTS]
part-title: [UNIQUE TITLE FOR THIS PART]
part-order: [POSITIVE INTEGER]
source-title: [PRIMARY SOURCE TITLE]
source-url: [OPTIONAL SOURCE URL - OMIT THIS LINE WHEN UNAVAILABLE]
---

# [COLLECTION TITLE] - [PART TITLE]

## Set: [SELF-CONTAINED SET TITLE]

### Passage

\`\`\`passage
[ONE 50-100 WORD, GRAMMATICALLY CORRECT, SOURCE-GROUNDED PASSAGE]
\`\`\`

### Thai explanation

\`\`\`thai-explanation
[ONE PLAIN-TEXT THAI PARAGRAPH SUITABLE FOR KEDMANEE TYPING THAT TEACHES THE SOURCE-GROUNDED IDEA, DEFINES NECESSARY TERMS, AND ADDS NO UNSUPPORTED KNOWLEDGE]
\`\`\`

### Evidence

#### Evidence: [SHORT SOURCE LABEL]
- Locator: [PRECISE LOCATION IN THE SOURCE]
- URL: [OPTIONAL EVIDENCE URL - OMIT THIS LINE WHEN UNAVAILABLE]

\`\`\`evidence
[EXACT SOURCE EXCERPT THAT SUPPORTS THE PASSAGE]
\`\`\`

Repeat the complete \`#### Evidence:\` block when a passage needs more than one excerpt. Repeat the complete \`## Set:\` section for every additional practice set.`;
