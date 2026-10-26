# Commercial Mobile UX — Phase Baseline

Branch: `feat/focus-galaxy-commercial-mobile-ux`
Baseline: `main` @ `3ea2667`. That is the reliability release `60fc777` plus a docs refresh, deployed to Cloudflare as version `4a9b2ebc-95ea-4c6d-a588-5947a83d2f78` on 2026-10-26.

The goal of this phase is a production-quality mobile experience that keeps the galaxy metaphor and the current visual identity. No redesign work is on this branch yet.

## Baseline evidence (2026-10-26)

| Check | Local dev | Production |
| --- | --- | --- |
| `test:planet-interaction` (8 steps, includes 390×844) | PASS | PASS |
| `test:planet-storage-content` (22 cases, 1440/390/844 widths) | PASS | PASS |
| `test:planet-cross-tab` (19 cases, includes 390×844 and 844×390) | PASS | PASS |

Mobile coverage so far comes only from **emulated viewports in headless Chrome 156**: `Emulation.setDeviceMetricsOverride` with `mobile: false` and mouse events. No physical devices, real touch input, Safari/WebKit, or mobile network throttling have been tested.

## What exists today

- Breakpoints: `≤767px`, short landscape (`≤1024px` wide and `≤560px` tall), `768–1279px`, `≥1280px`, `≤374px`.
- Mobile surfaces: bottom sheet for the selected planet (`.mobile-sheet-summary`), mobile galaxy controls menu (`#mobile-galaxy-controls-trigger`), overflow menu for destructive actions (`.selected-panel-more`).
- Touch groundwork: `touch-action` set on key controls, 44px tap targets on some controls, 44px range inputs, `viewport-fit=cover`, and `prefers-reduced-motion` support in both CSS and JS.
- Bundle: 597 kB JS / 188 kB gzip on initial load. React DOM and Framer Motion together are about 56% of rendered module size.

## Constraints to respect

- **Web Locks need a secure context.** Saving is disabled over `http://<LAN-IP>:5173`, so physical-device testing has to use HTTPS: production, a Workers preview, or an HTTPS tunnel.
- Keep the persistence contract unchanged: revision-checked writes under the lock, fail-closed behavior, and session-copy export. Rerun all three suites after any change.
- Keep the galaxy metaphor and visual mapping: size = importance, distance = urgency, activity = energy.

## Observations from the production smoke screenshots

- At 1440×900, the Focus Signal panel and the selected-planet panel cover orbiting planets (Family, SignalBoard). Their labels show through the glass. This is a visual hierarchy issue, not a hit-test regression: `test:planet-interaction` passes.
- The primary action that completes a *priority* is labeled "Complete Task" (`aria-label="Complete task"`). It is easy to confuse with the per-planet tasks in Focus Mode.
- At 390×844 the selected-planet bottom sheet fills about 55% of the viewport and hides most of the galaxy. A thin scrollbar is visible on its right edge.

## Priorities for investigation

1. **Touch-first planet interaction.** Hit-target size and spacing while planets orbit, tap vs. drag vs. scroll conflicts, and selection feedback without hover.
2. **Responsive layout and navigation.** Bottom-sheet states, safe-area insets, one-handed reach, and landscape on phones.
3. **Focus Mode on mobile.** Keyboard overlap with composers (`visualViewport`), scroll containment, and back-gesture or Escape parity.
4. **Accessibility.** Screen reader labels for moving planets, focus order inside sheets and dialogs, contrast on the starfield, and dynamic type.
5. **Visual hierarchy and readability.** Type scale at 360–430px and density of the detail panel and Focus Signal.
6. **Mobile performance.** Initial JS cost, animation frame budget on mid-range devices, battery impact of continuous orbits, and code-splitting candidates (see `replit.md` → Known technical debt).
7. **Commercial polish.** Consistent motion, empty, error, and conflict states on small screens, and installability (PWA manifest and icons).

## Recommended first milestone

**M1 — Mobile test harness and touch audit.** Ship no UI changes until this exists.

- Add a mobile-emulation mode to the CDP suites: `mobile: true`, `hasTouch`, and `Input.dispatchTouchEvent` taps instead of mouse clicks.
- Capture a screenshot baseline at 360×780, 390×844, 430×932, and 844×390.
- Run a touch audit of planet selection, the bottom sheet, Focus Mode composers, and confirmation dialogs. Record findings as issues.
- Do one real-device pass over HTTPS on at least one iOS Safari and one Android Chrome device, and log the results.
- Exit criteria: all suites pass in touch mode, and an audit report with prioritized defects exists.
