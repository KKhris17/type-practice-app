# Type Practice

A local-first typing trainer for source-grounded practice passages. Import a strict Markdown file, practice randomly selected 50–100 word sets, review the meaning and evidence after each session, and use recorded errors to generate adaptive muscle-memory drills.

## Requirements

- Node.js 22.13 or newer (`tooling/.nvmrc` pins the major version)
- npm

Dependencies are installed only in `tooling/node_modules/`. The install
command creates local directory links so Vinext can find the source folders;
no global package or container is required.

## Project structure

- `frontend/`: typing workspace, reusable UI components, styles, and browser hooks.
- `backend/`: API handlers, source parsing, and server-side analytics.
- `database/`: D1/SQLite schema, connection helper, and existing migrations.
- `config/`: lint and formatting configuration.
- `shared/`: types and pure practice logic used by both frontend and backend.
- `tests/`: automated checks for typing analysis and benchmark behavior.
- `docs/`: source-generation prompt, roadmap, and architecture notes.
- `app/`: thin route and layout entry points required by Vinext; public URLs are unchanged.
- `public/`: bundled sample source and favicon.
- `tooling/`: npm package, framework config, local dependencies, build output,
  and local SQLite state.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for boundaries and data flow.

## Run locally

From `type_practice/`:

```bash
cd tooling
npm install
npm run dev
```

Open <http://localhost:3000>. The `dev` command applies pending local SQLite migrations before starting the app. App data stays under the ignored `tooling/.wrangler/` directory.
Wait until Terminal prints `Local: http://localhost:3000/` before using or
reloading the page. When the local database already contains every migration,
the startup check skips Wrangler's slower migration process.

The Practice screen starts in Expanded view. Use Compact to reduce the workspace,
or Full screen to isolate the passage, keyboard, and live hand guide. The guide follows
the current cursor position and updates the highlighted key, hand, finger, and Shift key
after every typed character, deletion, or cursor movement.

The typing field receives focus when the passage is ready, when returning to Practice,
and after changing the workspace size or entering/exiting full screen. If you move focus
to another control, use **Resume typing** or click the passage. The caret appears only
while the typing field has focus. Use English (US) keyboard input; composition/IME input
shows a reminder to switch input language.

## Create source files with Codex

Use [`docs/CODEX_PROMPT.md`](docs/CODEX_PROMPT.md) as the generation prompt. A working import file is available at [`public/type-practice.sample.md`](public/type-practice.sample.md); its evidence cites this project's own Metrics section below.

Every imported set must:

- contain one `passage` block with 50–100 English words;
- contain one `thai-explanation` block that explains the passage in Thai;
- include complete, grammatically correct sentences;
- contain at least one source evidence block with an exact excerpt and locator; and
- follow `type-practice-version: 2`.

AI-generated files also include `collection-id`, `collection-title`, `part-title`,
and `part-order`. Files with the same collection ID appear as one collection, while
remaining selectable as individual parts. A part may contain up to 100 sets. The app
accepts multiple `.md` files in one import and reports the result for each file. Exact
duplicate files are skipped. Duplicate passages are compared across the library and
within the selected batch after whitespace normalization; repeated sets are skipped
and counted in the import summary. Legacy files without collection metadata remain
valid standalone sources.

Collections and individual parts can be deleted from the Sources screen after a
confirmation. Their passages, Thai explanations, and evidence are removed while past
session statistics remain. Once another collection exists, the imported
`type-practice.sample.md` starter source is hidden from the source list and random
Practice pool by default; the Sources screen includes a toggle to show it again.

## Metrics

- WPM uses correct final characters divided by five and by elapsed minutes.
- Accuracy uses correct key insertions divided by all key insertions, so corrected errors still count.
- Error analysis records the expected key, actual key, position, correction action, latency, and relative time for each event.
- The result screen shows a word-level Burst heatmap. It measures time inside each completed word, normalizes by key intervals, and colors words relative to that session's median for the same writing system; the pause before a word is excluded.
- Weakness percentages and scores use Practice sessions only. Weakness Drill sessions remain in general progress but never feed back into the weakness model.
- Focused drills group nearby US QWERTY keys by finger. Combined drills interleave those groups and weight groups with more frequent Practice errors more heavily.
- One-hand drills provide 150 patterns for either the left or right US QWERTY hand assignment and give extra repetitions to that hand's Practice weaknesses. They do not feed back into weakness percentages.
- A streak counts consecutive local calendar days with at least one completed Practice, Weakness Drill, or One-hand Drill session.

## Benchmark loop

The Benchmark screen uses six original English passages of approximately 80 words each. Starting a new baseline creates a comparison cycle; Re-benchmark rotates to a different form and compares WPM and accuracy with that baseline. These forms are approximately matched by length but have **not** been empirically calibrated. Compare several attempts rather than treating one pair as proof of improvement.

Slow words are ranked from clean, completed word bursts in Benchmark sessions. A word seen only once is marked provisional. The Speed drill repeats selected words in varied order, but its WPM and accuracy do not affect Benchmark comparisons, general Progress, or the Practice weakness model. A separate slow-word check compares only baseline slow words that also appear with clean timing in the retest; it reports insufficient overlap when none qualify. Benchmark text is bundled with the app and is independent of imported, source-grounded Practice material. No AI service is required.

## Project commands

Run these from `tooling/`:

```bash
npm run dev          # migrate the local SQLite database and start the app
npm run build        # production build
npm run lint         # source lint
npm run typecheck    # TypeScript diagnostics
npm test             # automated tests
npm run db:generate  # generate a migration after changing database/schema.ts
npm run db:migrate   # apply pending local migrations
```

See [`docs/ROADMAP.md`](docs/ROADMAP.md) for deliberately deferred features.

## License and credits

Original Type Practice code and project-created content are released under the
[MIT License](LICENSE), copyright (c) 2026 [KKhris17](https://github.com/KKhris17).
Third-party code and assets retain their own licenses; the project's MIT license
does **not** relicense them. This also does not grant rights to Markdown sources
that users import into their own local databases.

| Included in this repository | Origin and credit | License / status |
| --- | --- | --- |
| App logic, Study lesson sequences, Benchmark passages, and [`public/type-practice.sample.md`](public/type-practice.sample.md) | Created for Type Practice with [OpenAI Codex](https://openai.com/codex/) under the maintainer's direction. The bundled sample cites the project's own README rather than an external typing course. | Project MIT license. |
| [`frontend/ui/`](frontend/ui/) component layer and its configuration in [`tooling/components.json`](tooling/components.json) | Based on the [shadcn/ui](https://ui.shadcn.com/) component system; components use [Base UI](https://base-ui.com/) primitives. These files have been adapted for this app. | shadcn/ui MIT; Base UI MIT. The shadcn notice is preserved in [`docs/THIRD_PARTY_NOTICES.md`](docs/THIRD_PARTY_NOTICES.md). |
| Icons rendered by `lucide-react` | [Lucide](https://lucide.dev/), including the Feather-derived icons identified in Lucide's license. | Lucide ISC; specified Feather-derived icons MIT. Both notices are preserved in [`docs/THIRD_PARTY_NOTICES.md`](docs/THIRD_PARTY_NOTICES.md). |
| [`public/favicon.svg`](public/favicon.svg) | Created for this project with Codex, as confirmed by the maintainer. | Project MIT license. |
| Typing-test interaction ideas | Inspired in part by [Monkeytype](https://monkeytype.com/). The maintainer reports that no Monkeytype code, CSS, word lists, or assets were copied into this project. | Inspiration only; Monkeytype's [GPL-3.0-licensed code](https://github.com/monkeytypegame/monkeytype/blob/master/LICENSE) is not included or relicensed here. This project is independent and is not affiliated with or endorsed by Monkeytype. |

The app also installs the following **direct npm dependencies**. This is a
dependency inventory, not a claim that their source files were copied into this
repository. Versions are pinned in [`tooling/package.json`](tooling/package.json)
and [`tooling/package-lock.json`](tooling/package-lock.json); each package's own
license remains in force. The license labels below were checked against the
installed package manifests for those pinned versions. Transitive dependencies
are recorded in the lockfile and retain their respective licenses.

| Dependency group | Direct packages | Declared license |
| --- | --- | --- |
| App runtime | `react`, `react-dom`, `react-server-dom-webpack`, `vinext`, `@base-ui/react`, `@shadcn/react`, `clsx`, `cmdk`, `date-fns`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `recharts`, `shadcn`, `tailwind-merge`, `tw-animate-css` | MIT |
| App runtime | `drizzle-orm`, `class-variance-authority` | Apache-2.0 |
| App runtime | `lucide-react` | ISC; bundled notice also covers Feather-derived icons under MIT |
| Development and build | `@cloudflare/vite-plugin`, `@openai/sites-vite-plugin`, `@tailwindcss/postcss`, `@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@vitejs/plugin-rsc`, `oxfmt`, `oxlint`, `oxlint-tsgolint`, `tailwindcss`, `vite`, `drizzle-kit` | MIT |
| Development and build | `typescript` | Apache-2.0 |
| Development and build | `@cloudflare/workers-types`, `wrangler` | MIT OR Apache-2.0 |
