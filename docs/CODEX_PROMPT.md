# Codex prompt for creating practice Markdown

Paste the prompt below into an AI. It must ask for the topic and source basis before it creates a file.

````text
Help me create one source-grounded Markdown file that can be imported into Type Practice.

Mandatory intake:
- On your first response, do not create the file or begin research.
- Ask only: (1) What topic or learning scope should the sets cover, and if this continues an existing collection, what are its exact collection ID, title, and next part number? (2) Which sources should be used: attached files, pasted text, URLs, or explicitly authorized web search?
- Wait for both answers. Ask only the minimum focused follow-up if the topic or evidence basis remains ambiguous.
- Never choose a topic or source on the user's behalf.

Requirements:
- Output only one Markdown document that follows the exact schema below.
- Write grammatically correct English practice passages.
- Each `passage` block must contain 50–100 words, use complete sentences, and express a self-contained idea.
- After each English passage, write a learner-oriented Thai explanation for someone who may be encountering the topic for the first time. Teach the supported idea rather than translating sentence by sentence.
- Begin with a brief plain-Thai orientation to the topic, question, or distinction before using unexplained technical terminology.
- When an English technical term first appears, immediately give a short Thai meaning or plain-language explanation in parentheses. Explain its meaning in context rather than merely transliterating it.
- Explain what the concept is, when it applies, what role it serves, what the learner should notice, and relevant contrasts only when those points are supported by Evidence in the same set.
- For grammar or language topics, identify the exact word, form, or structure where the rule operates and explain why that form is used, within the limits of the source.
- Include a short, simple example only when it materially improves understanding. Prefer a source example. A created example may illustrate only one pattern explicitly supported by the Evidence and may not introduce a new rule, exception, meaning, or usage condition.
- After an example, identify the word or structure that demonstrates the target point and explain why it has that form.
- The Thai explanation may be longer than the English passage when necessary for clarity, but it must remain focused and fully source-grounded.
- When useful, end with a plain-text “สิ่งที่ควรจำ:” takeaway that summarizes an already-supported point without adding a new rule.
- Preserve the source's wording when it remains clear and grammatically correct. Paraphrase only when needed for a coherent 50–100 word passage.
- Every factual claim in a passage and every instructional claim, definition, contrast, example analysis, or takeaway in the Thai explanation must be supported by one or more evidence excerpts included under that set.
- Do not add facts from memory or inference.
- If the supplied material cannot support a claim, omit the claim.
- Copy evidence excerpts exactly and provide a precise locator such as heading, paragraph, page, or line range.
- Use a source URL only when one is available in the supplied material.
- Create 1–100 non-duplicative sets in one file. If more are needed, create another non-overlapping part when the user asks.
- Treat the overall topic as a collection. Use the exact same lowercase kebab-case `collection-id` and `collection-title` in every related file.
- Give each file a unique `part-title` and positive integer `part-order`, starting at 1 and increasing for later parts.
- If the user provides named files or sections, preserve those labels as part titles when appropriate.
- Before returning the file, count the words in every passage and verify the evidence coverage sentence by sentence. Audit each Thai explanation for beginner clarity, meaningful first-use term definitions, source-grounded examples, and unsupported knowledge.
- After intake is complete, output only the Markdown document with no outer code fence.

Exact schema:

---
type-practice-version: 2
title: [PART TITLE]
collection-id: [STABLE LOWERCASE KEBAB-CASE COLLECTION ID]
collection-title: [STABLE COLLECTION TITLE SHARED BY ALL PARTS]
part-title: [UNIQUE PART TITLE]
part-order: [POSITIVE INTEGER]
source-title: [PRIMARY SOURCE TITLE]
source-url: [OPTIONAL URL; OMIT THIS LINE WHEN UNAVAILABLE]
---

# [COLLECTION TITLE] - [PART TITLE]

## Set: [SELF-CONTAINED SET TITLE]

### Passage

```passage
[ONE 50–100 WORD, GRAMMATICALLY CORRECT, SOURCE-GROUNDED PASSAGE]
```

### Thai explanation

```thai-explanation
[A LEARNER-ORIENTED THAI EXPLANATION THAT TEACHES THE SOURCE-GROUNDED IDEA, DEFINES NECESSARY TERMS, AND ADDS NO UNSUPPORTED KNOWLEDGE]
```

### Evidence

#### Evidence: [SHORT SOURCE LABEL]
- Locator: [PRECISE LOCATION IN THE SOURCE]
- URL: [OPTIONAL URL; OMIT THIS LINE WHEN UNAVAILABLE]

```evidence
[EXACT SOURCE EXCERPT THAT SUPPORTS THE PASSAGE]
```

Repeat the `#### Evidence:` block when a passage needs more than one excerpt. Repeat the complete `## Set:` section for every additional practice set.
````

The app rejects a file when it contains over 100 sets, a passage is outside 50–100 words, a Thai explanation is missing, a set has no evidence, collection metadata is incomplete, or another imported part already uses the same title or order in that collection.
