# Focus Galaxy

Focus Galaxy is a local-first focus and priority map that turns tasks into an interactive galaxy and shows what deserves attention now.

## What it does

- Maps importance, urgency, and effort to visual position, size, and activity.
- Shows a deterministic Focus Score from 0–100 with a short rule-based interpretation.
- Lets you add, edit, remove, reset, and locally persist priorities.
- Starts with six seeded priorities so the product is useful immediately.
- Runs without an API key or external service.

The MVP is intentionally frontend-only: priority data is stored in the browser with `localStorage`. The repository is a pnpm workspace that also contains the supporting API and database packages for future extension.

## Stack

- React, Vite, and TypeScript
- Tailwind CSS and Framer Motion
- Express 5, PostgreSQL, and Drizzle ORM in the workspace infrastructure
- Zod validation and generated API contracts

## Run locally

Requirements: Node.js 24+ and pnpm.

```bash
git clone https://github.com/amu3dev/focus-galaxy.git
cd focus-galaxy
pnpm install
pnpm --filter @workspace/focus-galaxy run dev
```

Useful checks:

```bash
pnpm run typecheck
pnpm run build
```

## Project structure

```text
artifacts/focus-galaxy/       # Focus Galaxy web app
artifacts/focus-galaxy/src/   # UI, scoring, persistence, and interactions
scripts/                      # Workspace scripts and checks
```

## Product decisions

- A rule-based score keeps the MVP explainable and predictable.
- The visual map makes trade-offs visible instead of hiding them in a list.
- Local persistence keeps the first-use experience simple and private.
