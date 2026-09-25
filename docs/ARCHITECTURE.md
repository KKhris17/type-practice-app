# Architecture

`type_practice/` is the repository root. It contains the source directories
and `README.md` directly. The npm package and framework configuration live in
`tooling/`; run npm commands there.

| Directory | Responsibility |
| --- | --- |
| `app/` | Thin Vinext page, layout, and API route entry points |
| `frontend/` | React typing app, UI components, browser hooks, and CSS |
| `backend/` | API handlers, Markdown parsing, and session analytics |
| `database/` | D1 connection, Drizzle schema/config, migration script, and immutable SQL migrations |
| `shared/` | Types, curriculum, benchmark data, and pure typing calculations |
| `public/` | Static assets and sample source file |
| `config/` | Lint and formatting configuration |
| `tests/` | Node tests for shared logic |
| `docs/` | Usage and design documentation |
| `tooling/` | npm package, Vinext config, installed dependencies, build output, and local SQLite state |

The browser calls `/api/bootstrap`, `/api/sessions`,
`/api/sources/import`, and `/api/sources/manage`. Each `app/api/**/route.ts`
re-exports a handler from `backend/routes/`. Handlers access D1 through
`database/index.ts`. Shared modules do not import frontend or backend code.

Vinext requires its `app/` and `public/` entries beside its package/config.
`npm install` in `tooling/` runs `scripts/link-workspace.mjs`, which creates
directory links from `tooling/app` and `tooling/public` to the repository
source, plus a root `node_modules` link for module resolution. These links
are generated, ignored by Git, and never replace an existing directory that
points elsewhere. On Windows, the script creates directory junctions.

Generated migration files live in `database/migrations/`. Keep previously
applied SQL and `meta/` snapshots unchanged; add migrations with
`npm run db:generate` from `tooling/`. `npm run dev` invokes
`npm run db:migrate` before starting. Local SQLite data remains in
`tooling/.wrangler/state/`; do not delete it during routine cleanup.

`npm run lint` checks source syntax and style. `npm run typecheck` runs the
TypeScript compiler separately so source folders outside the package
directory retain full type diagnostics.
