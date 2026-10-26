# Focus Galaxy

A local-first focus map that turns priorities into an interactive galaxy around YOU / NOW, with per-planet notes and tasks, a Focus Mode workspace, and safe browser persistence.

Production: https://focus-galaxy.amu3dev.workers.dev/ (Cloudflare Workers static SPA).

## Run & Operate

- `pnpm install` — install workspace dependencies (pnpm only; `minimumReleaseAge` is enforced).
- `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/focus-galaxy run dev` — dev server on `0.0.0.0:5173` (defaults: `PORT=5173`, `BASE_PATH=/`).
- `pnpm run typecheck` — typecheck libs, all `artifacts/*`, and `scripts`.
- `PORT=18857 BASE_PATH=/ pnpm --filter @workspace/focus-galaxy run build` — production build to `artifacts/focus-galaxy/dist/public`.
- `pnpm run deploy:focus-galaxy` — build, then `wrangler@4.142.0 deploy --config wrangler.jsonc` (requires Wrangler auth for the configured account).
- Focus Galaxy needs no backend or env vars. Optional: `VITE_SPOTIFY_CLIENT_ID` enables Spotify playback; built-in focus audio works without it.

## Regression tests

Browser suites in `artifacts/focus-galaxy/scripts/` drive Chrome over CDP. They never launch a browser themselves.

- Requirements: the dev server on `http://127.0.0.1:5173/` (`APP_URL`) and an **isolated** Chrome with `--remote-debugging-port=9228` (`CDP_PORT`) and a throwaway `--user-data-dir`. Headless (`--headless=new`) works.
- `test:planet-interaction` and `test:planet-storage-content` attach to an existing page on the app origin. Open one first (e.g. `curl -X PUT "http://127.0.0.1:9228/json/new?http://127.0.0.1:5173/"`). `test:planet-cross-tab` creates its own disposable browser contexts.
- Run them one at a time with `pnpm --filter @workspace/focus-galaxy run <suite>`. They share a browser and contain timing-sensitive checks.
  - `test:planet-interaction` — real hit-testing of planets across panels, audio, viewports, and ~130 s of orbiting (`ORBIT_WAIT_MS`). About 3.5 min.
  - `test:planet-storage-content` — validation and recovery, quota failure and retry, completion and restoration, deletion confirmations, mobile viewports.
  - `test:planet-cross-tab` — revision-checked multi-tab saves, Web Locks queuing, fail-closed paths, conflict UI at 390×844 and 844×390.
- Optional `QA_OUTPUT_DIR` saves screenshots and JSON results. **Create the directory first**: the storage-content suite does not `mkdir` it and fails with `ENOENT` otherwise.
- The suites only touch storage inside the isolated profile. Never point them at a personal Chrome profile.

## Stack

- pnpm workspaces, Node.js 24+, TypeScript 5.9.
- Focus Galaxy: React 19.1, Vite 7, Tailwind CSS 4 (`@tailwindcss/vite`), Framer Motion, Radix/shadcn UI primitives, wouter, lucide-react.
- Workspace infrastructure not used by Focus Galaxy at runtime: Express 5 API server, PostgreSQL + Drizzle, Orval/Zod API codegen, mockup sandbox.

## Where things live

- `artifacts/focus-galaxy/src/App.tsx` — priority model, scoring, galaxy rendering and hit layer, panels, Manage dialog, keyboard shortcuts, storage hydration and validation, persistence banners.
- `artifacts/focus-galaxy/src/hooks/use-priority-persistence.ts` — revision-checked, Web Locks–coordinated localStorage writes.
- `artifacts/focus-galaxy/src/components/planet-focus-mode.tsx` — full-screen Focus Mode for one planet.
- `artifacts/focus-galaxy/src/components/planet-content-composer.tsx` — notes and tasks: compose, edit, complete, delete with confirmation.
- `artifacts/focus-galaxy/src/index.css` — visual system, responsive layout, motion.
- `artifacts/focus-galaxy/scripts/*.mjs` — CDP regression suites.
- `wrangler.jsonc` (repo root) — Worker `focus-galaxy`, static assets from `artifacts/focus-galaxy/dist/public`, SPA fallback.
- `docs/` — product positioning, articles, asset inventory, screenshots.

## Product

- Six seeded priorities (Job Search, Learning, Consulting, SignalBoard, Family, Health) on first run. Reset restores them after confirmation.
- Visual mapping is deterministic: importance → size, urgency → distance from center, energy → activity. The Focus Score is rule-based, 0–100, with no AI or external service.
- Selecting a planet (click, tap, or `[` / `]` / arrow keys) opens the detail panel to rename and adjust importance, urgency, and energy. On mobile this is a bottom sheet.
- Focus Signal / insight dock (`F`), Zen mode (`Z`), Manage dialog with Active and Completed tabs, and add priority.
- Notes and tasks per planet. Legacy single `notes` strings migrate once into entries.
- Focus Mode: an immersive single-planet workspace for notes and tasks. Escape cancels a pending delete confirmation before it closes Focus Mode.
- Completion moves a priority to Completed and keeps all its entries. Restore brings it back with its previous content intact.
- Deleting a priority, note, or task requires confirmation.
- Built-in focus audio. Optional Spotify integration.

## Architecture decisions

- **Frontend-only, localStorage persistence** under `focus-galaxy-priorities-v2`. No account or server sync.
- **Validation on load**: invalid priorities and entries are dropped. Duplicate IDs are de-suffixed without collisions. Rejected or malformed raw data is backed up byte-for-byte to `focus-galaxy-priorities-v2.corrupt[-N]` before anything replaces it.
- **Revision = exact stored bytes.** Each tab remembers the string it loaded or last wrote. There is no separate counter key that a quota error could leave out of sync with the data.
- **Cross-tab write coordination**: every write takes the `navigator.locks` exclusive lock `focus-galaxy-priorities-v2:write`, re-reads storage, and writes only if the bytes still match the tab's revision. The revision advances only after a successful `setItem`. Superseded queued writes are aborted. A hydration queued behind a newer writer never rewrites its old snapshot.
- **Conflicts fail safe**: a stale tab (detected via the `storage` event, focus, visibility, pageshow, or the in-lock check) stops writing. It shows a conflict banner offering **Download session copy** and a confirmed reload. Clearing storage externally also counts as a conflict.
- **Storage failures are surfaced, never silent**: quota or security errors show "Changes are not saved" with **Retry save**. Edits stay in memory and saved data is untouched. The warning stays visible until a retry actually persists. A failed initial read or failed recovery backup blocks writes for the session.
- **No Web Locks = no saving** (`'unavailable'`). The app never falls back to a localStorage spin-lock or an uncoordinated write. A rejected lock request is treated as a save error, not a fallback.

## Gotchas

- **Web Locks need a secure context.** `127.0.0.1`, `localhost`, and HTTPS (production) work. Opening the dev server over a LAN IP (`http://192.168.x.x:5173`, e.g. from a phone) disables saving and shows "Saving is unavailable in this browser". Verified on 2026-10-26. Test physical devices against HTTPS, such as production, a Workers preview, or an HTTPS tunnel.
- Browser support follows Web Locks: Chrome/Edge 69+, Firefox 96+, Safari/iOS 15.4+. Older browsers can use the app, but changes are memory-only with a download option.
- The vite build prints sourcemap warnings ("Can't resolve original location of error") for `components/ui/{tooltip,sheet,dropdown-menu}.tsx`. They come from the shadcn `'use client'` directives that Rollup strips. They don't affect the build.
- The JS bundle is about 597 kB minified (about 188 kB gzip), which trips Vite's 500 kB warning. React DOM and Framer Motion make up most of it. See "Known technical debt" below.
- `pnpm-workspace.yaml` overrides strip most non-linux-x64 native binaries (macOS binaries are kept, so local dev on a Mac works). Don't remove `minimumReleaseAge`.
- Deploying uploads whatever is in `dist/public`. The deploy script rebuilds first, so always deploy from a clean, verified commit.

## Known technical debt

- Bundle: `@tanstack/react-query` is mounted (`QueryClientProvider`) but unused (about 48 kB pre-minify). Candidates are removing it, lazy-loading rarely opened surfaces (Manage dialog, Spotify SDK), and evaluating Framer Motion `LazyMotion`/`m`.
- `App.tsx` is about 2.9k lines. Split it along the existing feature seams before large mobile UX work.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
