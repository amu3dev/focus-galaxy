# Focus Galaxy — Geometry and control-obstruction verification

**Assessment: VERIFIED — READY FOR DEVICE RETEST**

Repository: `/Users/ayosry/work/replit/focus-galaxy`  
Branch: `feat/focus-galaxy-commercial-mobile-ux`  
HEAD: `3bd813812108e55c1aca51511d65c009654522e5`  
Production baseline / unchanged local main: `3ea26677f2dc69eb5d06aa869ebbe51ec790a5c7`

## A. Root cause analysis

### Central sphere

The actual sphere is `.core-body`, inside `LivingCore`'s `.core-container` in `artifacts/focus-galaxy/src/App.tsx:2038–2064`. Its stable coordinate reference is the local 50%/50% origin of `.orbital-plane`, projected through the existing scene transforms. A zero-size, pointer-transparent test probe measures that origin; no planets or scene styles are repositioned by the test.

The same Motion element originally used CSS `transform: translate(-50%, -50%)` in `src/index.css` and Motion `whileHover` / `whileTap` scaling. Motion's generated inline transform replaced—not composed with—the CSS centering. On phones the computed translation changed from `(-66, -66)` to zero; on desktop/landscape, from `(-75, -75)` to zero. A tap could leave inline `transform: none` after release. The sphere therefore moved down/right independently of its orbital reference.

Runtime samples capture bounding rectangles, inline/computed transforms, transform origins, selection, scene/layer/reference transforms, and DOM identity before interaction, after down/release, in subsequent animation frames, and through panel changes. The core remains the same DOM node. Parent parallax, responsive scene translation, planet drift, breathing/pulse animation, and panel transitions are distinct from the lost centering translation. No remount, selection-induced scene relocation, percentage-size change, or viewport resize is needed to reproduce the defect.

### Notification obstruction and lifecycle

The original `.focus-toast-viewport` (`src/index.css:148`) started at 14px from the desktop top, above the toolbar's stacking level. At 1440×900 the toast occupied `(1004,14)–(1424,82.5)`. Browser `elementFromPoint` returned toast text/body/close-icon descendants at the brightness, Manage and Reset control centers. This was verified input interception, not an inference from screenshots. At 960×600, additional wrapped toolbar controls were also covered. Original mobile top-toolbar controls did not have that same overlap.

A later repeat-reset check exposed a second, real lifecycle defect: Radix's provider-level paused-dismissal flag could survive replacement of the single toast. Event instrumentation recorded a pause before dismissal, no resume, and a replacement still open after ten seconds despite document focus, body focus, and no toast hover. The provider now keys its lifecycle to the active notification ID (`src/components/ui/toaster.tsx:15–19`), so a replacement cannot inherit a stale paused timer. This does not add a second timer or remove normal accessibility pauses.

### Obstructive saving warning

The old warning was a fixed bottom-left, z-index 110 card (`src/index.css`, original warning rules). It was 143px tall at 844/430 widths and 157.5px tall at 390/360 widths, intersecting the selected mobile sheet. The expected missing-Web-Locks state was not the bug; presentation and stacking were.

## B. Geometry correction and measurements

Motion now owns centering as well as interaction scale: `style={{ x: '-50%', y: '-50%' }}` (`src/App.tsx:2040–2041`). The competing CSS transform was removed from `.core-container` (`src/index.css:479`). The orbital scene, planet placement, visual-size/urgency/energy calculations, and production planet hit handlers are unchanged. There are no compensating offsets or delays.

Maximum radial displacement relative to the projected orbital origin, in CSS pixels:

| Viewport / motion | Before | After |
|---|---:|---:|
| 1440x900 | 106.171 | 0.350021 |
| 844x390 | 106.066 | 0.000031 |
| 430x932 | 93.338 | 0.000048 |
| 390x844 | 93.338 | 0.000048 |
| 360x780 | 93.338 | 0.000031 |
| 1440x900-reduced | 106.066 | 0.000000 |
| 390x844-reduced | 93.338 | 0.000017 |

The final geometry run contains **1848 samples** and a maximum deviation of **0.350021 CSS px**, below the 2px threshold. Small desktop differences reflect perspective-projected bounding-box centers during breathing/interaction scaling and parallax; mobile residuals are floating-point/layout precision. The baseline regression fails on the original transform loss.

Each viewport exercises three center activations, highest-priority selection, close/deselect, visible moving-planet selection, reopened/closed detail panels, and subsequent orbital phases. Both desktop and phone reduced-motion cases are included. Reference-relative measurement allows legitimate parent parallax without mistaking it for independent center displacement.

## C. Notification correction

`Toaster` is now inside the application header (`src/App.tsx:2624`). Its viewport is positioned below the header's actual flow height, including wrapping or the unsaved-state strip, rather than using a guessed desktop toolbar height. Header controls/dropdowns occupy the higher sibling layer. The viewport and noninteractive toast body are pointer-transparent; the explicit, named 44×44px dismissal button remains interactive. Success is announced politely; destructive feedback retains foreground announcement semantics.

The existing single-toast limit, 4600ms duration, manual dismissal, and 650ms state-removal delay remain. Duplicate feedback does not accumulate, and toast state does not survive a page reload. Normal hover/focus/background pauses remain intentional; the timeout test clears those conditions before measuring.

Final notification results: **7/7 passed**, with measured unpaused dismissal waits of **4123–4408 ms** after test setup. Coverage includes mouse, touch, keyboard activation, actual toolbar hit-testing, repeated resets, explicit dismissal, automatic dismissal, no focus stealing, polite live-region content, and reload behavior.

A separate real Chrome zoom check changed the isolated profile's native default zoom through Chrome Settings—not CSS `zoom` or a smaller viewport approximation. At 100%, 125% and 150%, layout viewports were respectively 1440×900, 1152×720 and 960×600, with DPR 1, 1.25 and 1.5. Toolbar hit targets stayed reachable, toast intersections were zero, and Manage opened/closed while feedback was present. Exit code: 0. Zoom was restored afterward.

## D. Compact mobile warning and data safety

The persistent warning is now a **44px in-flow strip**: “Changes are not saved” plus “Details & export.” It remains visible without covering the selected sheet. Explanatory text, Retry save when applicable, session-copy export, recovery guidance and confirmed conflict reload remain in an explicitly opened native nonmodal popover. It can be closed explicitly, with Escape, or by light dismissal. Focus/Manage place the same compact indicator in their own content flow.

Review-found integration issues were fixed and protected with 20 checks: hidden popover buttons are excluded from Manage's focus trap (`src/App.tsx:1027`); root capture handles popover Escape before the outer view, including React portals (`src/App.tsx:2533`); reload hides the top-layer popover and captures the visible indicator as the confirmation's return-focus target (`src/App.tsx:2477`). Cancel preserves session edits and returns visible focus.

| Touch viewport | Persistent warning height | Sheet intersection |
|---|---:|---:|
| 844x390 | 44px | 0 CSS px² |
| 430x932 | 44px | 0 CSS px² |
| 390x844 | 44px | 0 CSS px² |
| 360x780 | 44px | 0 CSS px² |

The persistence hook and its lock/revision protocol are unchanged. Storage/content and cross-tab regressions verify locked writes, exact content revisions, stale-write/conflict protection, failed-read/recovery safeguards, retry coordination, cancellation, and no unsafe fallback. Missing-lock touch checks make a memory-only note, perform two real downloads, verify downloaded JSON bytes, and assert zero canonical storage writes. Export names now include the full millisecond UTC timestamp and a per-session sequence (`src/App.tsx:2466`), rather than only the date.

An additional browser check used an ordinary insecure HTTP hostname mapped to loopback in an isolated Chrome profile: `isSecureContext=false`, `navigator.locks` absent. Metric changes remained in memory, canonical storage stayed unchanged, and the session download contained those changes. Exit code: 0. The exact LAN URL `http://192.168.25.192:5173/` could not be reached from this execution environment: navigation and direct HTTP connection timed out. This is not physical Android verification.

## E. Separate visual audit / subsequent Commercial UX milestone

- Focus Signal and selected desktop panels still cover orbiting planets and labels; Family and SignalBoard are observable examples. Panel hierarchy was not redesigned.
- After correcting the core, the audited 1440×900 Job Search, Family and Consulting captures show no core-body/panel rectangle intersection. This does not promise that arbitrary orbiting planets never cover the core.
- The audited document width equals the viewport at all five requested sizes. Oversized, transformed orbit artwork—and some phone labels—extend beyond the scene and are clipped by its existing `overflow-hidden`. This is real scene clipping, not page-level horizontal overflow or a compensating scene translation. Historical screenshots cannot all be attributed without their original uncropped files.
- Mobile hover-status/badge text can still extend toward the right edge. Expanded sheets, scene density, label clipping, and desktop panel placement belong to the subsequent visual-hierarchy milestone.
- Screenshots intentionally show different orbital phases. Their evidence of center stability is the measured origin-relative geometry, not identical planet pixels.

## F. Verification and evidence

Final matrix, using isolated Chrome profiles and disposable contexts for the new suites:

| Command / check | Result | Exit |
|---|---|---:|
| `pnpm --filter @workspace/focus-galaxy run test:planet-interaction` | 8/8 passed | 0 |
| `pnpm --filter @workspace/focus-galaxy run test:planet-storage-content` | 22/22 passed | 0 |
| `pnpm --filter @workspace/focus-galaxy run test:planet-cross-tab` | 19/19 passed | 0 |
| `pnpm --filter @workspace/focus-galaxy run test:center-geometry` | 7/7 passed | 0 |
| `pnpm --filter @workspace/focus-galaxy run test:notification-obstruction` | 7/7 passed | 0 |
| `pnpm --filter @workspace/focus-galaxy run test:mobile-warning` | 4/4 passed | 0 |
| `pnpm --filter @workspace/focus-galaxy run test:storage-warning-accessibility` | 20/20 passed | 0 |
| `pnpm run typecheck` | Passed | 0 |
| `pnpm run build` | Passed | 0 |
| `git diff --check` | Passed | 0 |
| Native Chrome zoom 100/125/150% | 3 zoom levels passed | 0 |
| Real insecure-origin metric edit/export smoke | Passed; no fallback write | 0 |

The interaction suite retains its complete 130-second orbital observation. The configured screenshot directory was absent initially: recursive creation is now built into the storage/content screenshot helper, and the final suite successfully created its nested output directory. Runtime exceptions/console errors are asserted by the runners; missing cases fail their expected-count checks.

Pre-fix baseline results were not silently replaced: interaction was 5/8; the missing screenshot directory reproduced ENOENT; the frozen baseline storage suite stopped at a premature restoration-write assertion; cross-tab was 19/19; typecheck/build passed. Harness corrections now wait for actual locked persistence outcomes, keep CDP targets foregrounded, avoid moving hit-circle edges at press/release, open warning controls through their real disclosure, and wait for actual dialog/overlay transitions rather than trusting fixed sleeps. Failed/interrupted intermediate runs are retained in the evidence archive.

Build retains pre-existing sourcemap-location warnings in untouched UI modules and the large-bundle warning. No dependency, persistence-format, or animation-architecture rewrite was introduced. Independent source review found no blocking issues; the paused-timer follow-up has its own review record.

### Evidence locations

- Final exact commands, exit codes and stdout: `/Users/ayosry/.hermes/cache/scratch/focus-galaxy-ux/release-verification/manifest.json` and sibling `.log` files.
- Raw before/after frame measurements: `before/geometry.json` and the final `test:center-geometry/nested/geometry.json` under the evidence root.
- Notification rectangles/hit stacks/lifecycle: final `test:notification-obstruction/nested/notifications.json`.
- Mobile warning measurements/downloads: final `test:mobile-warning/nested/warning.json` and `focus-galaxy-ux-downloads/`.
- Keyboard/top-layer assertions and screenshots: final `test:storage-warning-accessibility/nested/`.
- Curated before/after screenshots, raw results, run histories, source diff and this report are included in the delivered ZIP.

### Remaining verification limits

No physical Android Chrome or iOS/Safari testing was performed. Retest the exact LAN URL on Android for the compact unsaved state, sheet expansion/collapse, repeated center taps, controls and export; use HTTPS for real safe-saving tests and cross-tab/retry checks. Verify TalkBack/VoiceOver announcements, browser chrome/keyboard resizing, native popover behavior and low-end-device animation timing separately. The insecure-origin probe also observes `crypto.randomUUID` unavailable; creation paths using it were not changed or certified for insecure HTTP. Metric editing/export was the actual insecure-origin workflow exercised.

## G. Repository state

No new commit was created. No merge, push or deployment was performed. `main` remains at the stated baseline. Changes are uncommitted on the requested branch; no temporary Git worktree was created.

```text
 M artifacts/focus-galaxy/package.json
 M artifacts/focus-galaxy/scripts/planet-cross-tab-regression.mjs
 M artifacts/focus-galaxy/scripts/planet-interaction-regression.mjs
 M artifacts/focus-galaxy/scripts/planet-storage-content-regression.mjs
 M artifacts/focus-galaxy/src/App.tsx
 M artifacts/focus-galaxy/src/components/ui/toaster.tsx
 M artifacts/focus-galaxy/src/index.css
?? artifacts/focus-galaxy/scripts/cdp-harness.mjs
?? artifacts/focus-galaxy/scripts/galaxy-ux-regression.mjs
?? artifacts/focus-galaxy/scripts/storage-warning-accessibility-regression.mjs
?? docs/geometry-control-obstruction-verification.md
```

The source hashes were checked before and after the final run. All 73 hashed app source, package and regression-script files were identical throughout the final complete run.

Owned test browsers were stopped after verification; the original development server was left running.

## H. Final assessment

**VERIFIED — READY FOR DEVICE RETEST**

The three reported defects are reproduced, corrected and covered by passing automated regressions. Remaining physical-device, assistive-technology and visual-hierarchy work is explicitly separated above; this is not a claim of physical-device verification or permission to deploy.
