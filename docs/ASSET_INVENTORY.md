# Focus Galaxy visual asset inventory

**Reviewed:** 4 October 2026  
**Scope:** Local Focus Galaxy checkout, its available Git history and refs, hidden project files, generated build output, and the sibling `/Users/ayosry/work/replit/consulting` workspace folder. Existing assets were inspected in place and left unchanged. No screenshots or other media were created.

## Expanded evidence update — 4 October 2026

The canonical record is now [FOCUS_GALAXY_STORY_EVIDENCE.md](FOCUS_GALAXY_STORY_EVIDENCE.md). It includes the two supplied `replit_photo_*` folders and the invitation screenshot, verifies event photographs and a short room video, records duplicate relationships and publication risks, and updates the provisional event date to 12 September 2026 based on the invite plus Ahmed’s account. The repository-only statements below that no event media was found describe the earlier, narrower search and are superseded for the expanded sources. The first-prototype screenshot, demo recording, original soundtrack, and current product screenshot remain unverified or missing.

## Evidence notes

- **First-pass-only finding, superseded for event media:** The repository-only pass found two genuine product screenshots, one explicitly synthetic SVG, and a basic favicon (also copied to generated build output), with no event photos/video in that limited source set. The expanded folders contain event photos and a short video; see the canonical record above.
- The first recorded Focus Galaxy project commit is `50bacd6` on 12 September 2026. It includes the original written Replit build prompt. This is a repository date, not proof of the event date or the exact time spent building.
- The article and positioning drafts describe a roughly 40-minute prototype and an event demo. The original prompt describes a one-hour MVP scope. Treat “about 40 minutes” as Ahmed's account unless a contemporaneous timer, event post, or recording supports greater precision.
- The SVG preview was added on 14 September and explicitly identifies itself as synthetic. It is not a capture of the prototype.
- The two genuine screenshots were added in commit `e356896` on 28 September. The README identifies them as live-app captures at 1440×900 and 390×844. The commit date is the available date evidence; it does not establish the precise capture time.
- Product changes continued after those captures, including commits dated 2–4 October. The screenshots therefore document a September 28 version, not the current October 4 interface.
- `docs/focus-galaxy-article-v1.md` and `docs/product-positioning-brief.md` are local working drafts currently outside Git history. Do not assume they are present in the GitHub repository.

## Asset register

### ORIGIN

**`.conversation/attached_assets/Pasted-Build-Focus-Galaxy-Build-a-visually-striking-interactiv_1789213578551.txt`**

- **Approx. date:** 12 September 2026, based on its first project commit.
- **What it shows:** The original written build brief: priorities orbiting “YOU / NOW,” the importance/urgency/effort model, the visual direction, local-first constraints, and the rapid-prototype goal.
- **Storytelling value:** Strongest available primary source for the initial product idea and intended prototype scope. It is text, not a photo or screen capture.
- **Recommended use:** Source a short, faithful excerpt for the “idea” beat or a future designed quote card. Keep the original file as provenance.
- **Publication-ready:** No as a standalone public asset; useful as internal source material.
- **Crop/edit/redaction:** No crop. Review the example priority names (including Job Search, Consulting, and SignalBoard) before reproducing the prompt publicly.

**`docs/focus-galaxy-article-v1.md`**

- **Approx. date:** Local draft modified 4 October 2026; no Git commit date is available.
- **What it shows:** Article draft, hooks, a LinkedIn excerpt, and suggested visual placements. It recounts the event, roughly 40-minute build, demo, and subsequent product work.
- **Storytelling value:** The most complete written narrative and a useful shot list. Its event and timing statements are author-reported copy, not independent visual evidence.
- **Recommended use:** Editorial source for the article and social posts after source/claim review and after the missing historical images are supplied.
- **Publication-ready:** No; it is labelled v1 and still calls for event and prototype imagery.
- **Crop/edit/redaction:** No crop. Verify event/date/timing language and any permissions for event imagery or music before publication.

### PROTOTYPE

**`docs/assets/focus-galaxy-synthetic.svg`**

- **Approx. date:** Added to Git 14 September 2026; SVG viewBox is 1600×900.
- **What it shows:** A designed, synthetic productivity interface with a sidebar, four sample priorities, a score, and a selected-priority panel. Its embedded title and description call it synthetic.
- **Storytelling value:** It can illustrate the general product idea, but it does not document what the original prototype or event demo looked like. Its dashboard layout also differs from the real galaxy UI.
- **Recommended use:** Omit from the historical sequence. If used elsewhere, label it prominently as a synthetic concept illustration, never as a screenshot or “before” image.
- **Publication-ready:** No as documentary evidence; conditional only as clearly labelled concept art.
- **Crop/edit/redaction:** No crop required. Preserve or strengthen the synthetic/concept label if shown.

**Early source states in Git (`artifacts/focus-galaxy/src/App.tsx`, `src/index.css`; commits 50bacd6 through 16 September)**

- **Approx. date:** 12–16 September 2026, based on commit dates.
- **What it shows:** Versioned source for the early app and its first visual/interaction refinements. No contemporaneous rendered screenshots were found for these states.
- **Storytelling value:** Supports a factual development timeline, but source code is not proof of what an event audience saw.
- **Recommended use:** Use commit references in an appendix or a carefully sourced timeline. A later render from an old commit must be captioned as a historical re-render, not an original event capture.
- **Publication-ready:** No as a visual asset; suitable as technical source.
- **Crop/edit/redaction:** No crop. Do not convert a reconstructed render into a purported historical screenshot.

### EARLY PRODUCT

No genuine early-product screenshot or recording was found. The early code history above is available; the only early visual file is the synthetic SVG, which should not be used as proof of the prototype.

### CURRENT PRODUCT

**`docs/assets/focus-galaxy-desktop.jpg`**

- **Approx. date:** Added to Git 28 September 2026; 1440×900. README describes it as a live browser capture with six seeded sample priorities.
- **What it shows:** Desktop galaxy, Focus Signal, insight panel, and selected-priority controls.
- **Storytelling value:** Strongest existing real product image and a useful intermediate milestone between the original prototype and current product.
- **Recommended use:** README or article as a dated September 28 view; do not present it as the October 4 current screen. A dated version can also appear in the iteration beat.
- **Publication-ready:** Conditional. The capture is legible and full-frame, but it predates the October 2–4 changes.
- **Crop/edit/redaction:** No crop for README/article. Before public use, review or replace visible sample names such as Job Search, SignalBoard, and Consulting. Recapture for a current-product claim.

**`docs/assets/focus-galaxy-mobile.jpg`**

- **Approx. date:** Added to Git 28 September 2026; 390×844. README describes it as a live browser capture with the same seeded priorities.
- **What it shows:** A phone-sized galaxy view with the selected Job Search detail sheet expanded.
- **Storytelling value:** Provides mobile coverage, but the detail panel obscures much of the galaxy and a priority label remains visible behind/at the panel edge. It is weaker than the desktop capture for a polished public story.
- **Recommended use:** Keep as a dated archive of the September 28 layout. Prefer a fresh current mobile capture for public materials.
- **Publication-ready:** No without a retake or careful review; the visible overlap and sample names distract.
- **Crop/edit/redaction:** Cropping will not resolve the overlap. Retake with neutral sample data and a clean selected state; redact personal labels if reusing this file.

**Current rendered interface:** No October 4 desktop or mobile screenshot was found. The current source includes newer work such as Planet Focus Mode, notes/tasks, and mobile Insights, but those features are not represented by the September 28 images.

- **Approx. date:** Current code/history through 4 October 2026.
- **What it shows:** Current product behavior in source only; there is no corresponding image or recording in the workspace.
- **Storytelling value:** Essential for accurately presenting the current product and distinguishing it from the early demo.
- **Recommended use:** Capture genuine desktop and mobile views from the current app when preparing publication assets.
- **Publication-ready:** No visual exists yet.
- **Crop/edit/redaction:** Capture with neutral demo priorities; keep the full interaction legible and remove account/browser details if visible.

### DEVELOPMENT

**Local Git history (`git log --all`)**

- **Approx. date:** 12 September–4 October 2026.
- **What it shows:** First project record on 12 September; visual and interaction work on 13–16 September; synthetic preview on 14 September; real README captures on 28 September; deployment documentation on 29 September; Spotify/mobile work on 2 October; Planet Focus Mode and notes/tasks on 3 October; Insights and content-control work on 3–4 October.
- **Storytelling value:** Strong dated evidence that the repository continued to evolve after the event prototype. Commit dates show code history, not audience response or exact build duration.
- **Recommended use:** Source a compact, accurately dated iteration timeline; link to commits in technical material. Do not imply that each commit corresponds to a user-tested milestone.
- **Publication-ready:** Source data is usable; no timeline graphic is present.
- **Crop/edit/redaction:** No crop. Check branch/remote availability before publishing commit links; the local history is the evidence reviewed here.

**`artifacts/focus-galaxy/src/App.tsx`, `artifacts/focus-galaxy/src/index.css`, `artifacts/focus-galaxy/src/components/planet-focus-mode.tsx`, `artifacts/focus-galaxy/src/components/planet-content-composer.tsx`**

- **Approx. date:** Current checkout includes work through 4 October 2026.
- **What it shows:** Product behavior and visual implementation, including the galaxy, focus mode, and priority details.
- **Storytelling value:** Useful for accurate product-demo planning and technical explanations; not a substitute for a rendered capture.
- **Recommended use:** Use as the source of truth for choosing current interactions to record.
- **Publication-ready:** No as public visual material; source code is technical reference.
- **Crop/edit/redaction:** No visual treatment. Avoid code screenshots unless a specific implementation detail is relevant and secrets/account data are excluded.

### EVENT

No event photographs, audience/demo stills, venue shots, presentation deck, or event-specific Replit screenshots were found in the project or the sibling workspace folder.

- **Approx. date:** Unknown from local media. The drafts say “a few weeks ago”; the first repository commit is 12 September, which does not independently establish the event date.
- **Storytelling value:** These are the missing visual proof for the origin and live-demo beats.
- **Recommended use:** Ahmed should supply original event photos, a frame from the actual demo, and the event name/date/location if available.
- **Publication-ready:** No event visual is available.
- **Crop/edit/redaction:** Review consent for identifiable attendees and any visible private information before public use.

### VIDEO

No video, screen recording, exported audio/music file, or presentation recording was found. The product documentation describes built-in generated focus music and optional Spotify playback, but these are product capabilities, not source recordings of the event soundtrack or demo.

- **Approx. date:** None available.
- **What it shows:** No video/audio asset is present.
- **Storytelling value:** A genuine original demo recording would establish the early product interaction and music context; a fresh product walkthrough can show current behavior.
- **Recommended use:** Supply the original event recording or an unedited source clip if available. Record a separate current walkthrough for the product story.
- **Publication-ready:** No source footage/audio is available.
- **Crop/edit/redaction:** Not applicable yet. Retain an unedited original; create channel-specific crops only from a verified source. Confirm music rights before public use.

### SOCIAL

**`docs/focus-galaxy-article-v1.md` (LinkedIn excerpt and opening hooks)**

- **Approx. date:** Local draft modified 4 October 2026; not in Git history.
- **What it shows:** One proposed LinkedIn excerpt and several hooks, embedded in the article draft; no separate final post or social creative is present.
- **Storytelling value:** Gives a starting point for a post about the prototype-to-product journey.
- **Recommended use:** Adapt only after confirming the origin/timing wording and pairing it with an authentic visual.
- **Publication-ready:** No; draft copy only.
- **Crop/edit/redaction:** No crop. Review factual claims and sample names; no LinkedIn-ready image or video is included.

**`artifacts/focus-galaxy/index.html` social metadata**

- **Approx. date:** Current project source.
- **What it shows:** Page title and description metadata, but no Open Graph/social preview image was found.
- **Storytelling value:** Provides basic link-preview copy only.
- **Recommended use:** A future landing page/share card still needs an approved image built from genuine product captures.
- **Publication-ready:** Partial; metadata exists, social image does not.
- **Crop/edit/redaction:** No crop. Add an image only after selecting an approved, current screenshot.

### TECHNICAL

**`README.md`**

- **Approx. date:** Current project documentation; screenshots were added 28 September.
- **What it shows:** Product summary, stack, local-first behavior, run/deploy instructions, Spotify setup, and links to the two real screenshots.
- **Storytelling value:** Ready source for the GitHub project overview and technical fact-checking.
- **Recommended use:** Keep it as the technical home; when updating visuals, date the captures or replace them with current, verified screens.
- **Publication-ready:** Partially. The project copy is useful, but the visuals describe an older state and the file has no visible capture-date captions.
- **Crop/edit/redaction:** No crop for README. Review the screenshots' sample names; do not change the originals during this inventory.

**`docs/product-positioning-brief.md`**

- **Approx. date:** Dated 4 October 2026; local working draft, not in Git history.
- **What it shows:** Positioning, audience hypotheses, product claims, limitations, and recommended language for future article/site/social work.
- **Storytelling value:** Useful guardrails for accurate landing-page and LinkedIn copy; it explicitly separates demonstrated behavior from unvalidated outcomes.
- **Recommended use:** Internal copy source. It is not a landing-page design or visual asset.
- **Publication-ready:** No; internal working brief.
- **Crop/edit/redaction:** No crop. Keep the evidence boundaries if adapting any language for public copy.

**`replit.md` and `.replit-artifact/artifact.toml`**

- **Approx. date:** Project configuration; initial project files date to 12 September.
- **What it shows:** Replit app identity, run/build instructions, stack, and app paths.
- **Storytelling value:** Supports the technical provenance of the Replit project, but does not show the Replit editor or the event environment.
- **Recommended use:** Technical background only; it cannot replace a Replit workspace screenshot.
- **Publication-ready:** No as a standalone visual.
- **Crop/edit/redaction:** No crop; remove environment/account details if making a separate workspace capture.

**`artifacts/focus-galaxy/public/favicon.svg` and generated `artifacts/focus-galaxy/dist/public/favicon.svg`**

- **Approx. date:** Present in the first project commit; the build output is generated.
- **What it shows:** A plain orange rounded square, not the current galaxy wordmark treatment.
- **Storytelling value:** Very low; not a suitable identity or hero visual for the story.
- **Recommended use:** Do not use in article, landing-page, README, or social creative.
- **Publication-ready:** No for this campaign.
- **Crop/edit/redaction:** No crop; an approved brand mark would need to be supplied if required.

## Missing assets Ahmed should provide

1. **Origin and event:** Event name, date, venue/city, and any original photos of the idea/prototype being shown. Include consent context for identifiable people.
2. **The real 40-minute prototype:** The earliest genuine Replit preview screenshot or screen recording, preferably with the original file timestamp or export metadata. A Replit workspace/project capture can help establish provenance, but hide account details and secrets.
3. **The event demo:** An unedited clip or still showing what attendees actually saw, plus the original audio/music source if it is intended for the cinematic cut.
4. **Early iterations:** Any screenshots or exports from 13–16 September. Local code history exists, but no original UI captures from those dates were found.
5. **Current product:** A genuine desktop and mobile capture of the October 4 product state, or approval to capture those states later. Use neutral sample priorities and remove browser/account details.
6. **Before/after:** The original prototype capture is required before a credible comparison can be made. Do not use the synthetic SVG as the “before.”
7. **Brand/social:** Any approved logo/wordmark, brand colors/fonts, landing-page art direction, and preferred LinkedIn image ratio. No social card or custom Open Graph image is present.
8. **Timing confirmation:** If “40 minutes” must be stated precisely, provide a contemporaneous record. The written sources currently pair an approximately 40-minute account with a one-hour-scoped prompt.

## Recommended visual sequence: idea → 40-minute prototype → event demo → iteration → current Focus Galaxy

These are 12 recommended visual slots; several require source material that is not present. The existing assets are identified explicitly. A newly rendered old code state must be labelled a re-render, never presented as an original screenshot.

| # | Story beat | Recommended visual | Status and use |
|---:|---|---|---|
| 1 | Idea | A real event photo, notebook sketch, or whiteboard showing the question behind the galaxy. | **Missing.** Ahmed to provide; strongest human opening. |
| 2 | Idea | A short excerpt from the original Replit prompt, designed as a quote card around “YOU / NOW” and the orbiting-priorities idea. | **Text source found** in `.conversation/attached_assets/Pasted-Build-Focus-Galaxy-Build-a-visually-striking-interactiv_1789213578551.txt`; no designed card exists. Keep wording faithful; do not style it to look like a Replit screenshot. |
| 3 | 40-minute prototype | The first genuine working prototype screen at the end of the build, with its original timestamp if available. | **Missing.** Critical “before” image; provide the actual capture/export. |
| 4 | Event demo | An authentic event still or short frame sequence showing the prototype being demonstrated and the music setup. | **Missing.** Do not substitute a current screen for the event demo. |
| 5 | Iteration | A real early app screenshot from 13–16 September showing the first product refinements. | **Missing.** Git history can date code work but cannot establish what the event screen looked like. |
| 6 | Iteration | `docs/assets/focus-galaxy-desktop.jpg`, full 1440×900 September 28 capture. | **Available.** Strongest existing visual evidence; caption as a September 28 intermediate state and review visible sample names. |
| 7 | Iteration | A compact timeline based on the dated Git commits from September 12 to October 4. | **Source available; graphic absent.** Use commit dates and label it as development history, not user-validation evidence. |
| 8 | Current product | A genuine October 4 desktop capture with a selected planet and current focus/detail behavior. | **Missing.** Capture from the real app using neutral priorities. |
| 9 | Current product | A genuine October 4 phone capture showing the current Insights or Planet Focus interaction in a clean state. | **Missing.** Retake at a real phone viewport; avoid the panel/label overlap in the September 28 image. |
| 10 | Before/after | A side-by-side of the original prototype and current product, with dates and matching viewport where possible. | **Not yet possible.** Requires the original prototype and current capture; do not pair the synthetic SVG with a real screen. |
| 11 | Current product | An uninterrupted screen recording: choose a planet, open detail/notes/tasks, enter Planet Focus Mode, return to the galaxy. | **Missing.** Record the current app directly; keep a clean master before editing. |
| 12 | Cinematic/product video | A wide hero clip of the real galaxy interface moving through one meaningful interaction, with the original or cleared music source. | **Missing.** Build only from verified app footage and music with cleared rights; derive vertical crops from the approved master. |

## Channel readiness

- **Article:** Draft exists, but the event/demo and prototype visuals called for in its own placement notes are missing.
- **Landing page:** Product positioning and messaging guardrails exist; no dedicated landing-page copy, layout, or hero/social image was found. The app itself is not a story landing page.
- **LinkedIn:** One excerpt and hooks exist inside the article draft; no final post set or social creative exists.
- **Future video:** No event footage, screen recording, or source audio is present.
- **GitHub README:** The README and two genuine screenshots exist. The desktop image is usable as a dated September 28 view; the mobile image should be retaken for public use. Neither shows the October 2–4 updates.
- **Before/after:** A real desktop “after” exists only for September 28. The original prototype “before” is missing, so a truthful comparison cannot yet be assembled.
