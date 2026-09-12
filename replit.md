# Focus Galaxy

An interactive personal focus map that turns priorities into a living galaxy and shows what deserves attention now.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/focus-galaxy run dev` — run the Focus Galaxy web app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Focus Galaxy requires no backend environment variables.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React, Vite, Tailwind CSS, Framer Motion

## Where things live

- `artifacts/focus-galaxy/` — the complete single-page app
- `artifacts/focus-galaxy/src/App.tsx` — priority state, scoring, persistence, and interactions
- `artifacts/focus-galaxy/src/index.css` — visual system, responsive layout, and motion

## Architecture decisions

- The MVP is intentionally frontend-only and persists priority data in browser localStorage.
- The visual mapping is deterministic: importance controls size, urgency controls center distance, and energy controls activity.
- Focus Score is rule-based and normalized to 0–100; no AI or external service is used.

## Product

- View six seeded priorities as interactive bodies around YOU / NOW.
- Select a priority and adjust importance, urgency, and effort with immediate visual feedback.
- Add, remove, reset, and locally persist priorities.
- See strongest focus signals and a concise rule-based interpretation.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
