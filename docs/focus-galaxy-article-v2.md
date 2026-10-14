# Building Focus Galaxy: From Event Demo to Ongoing Experiment

## Article V2

At a Replit event a few weeks ago, I had free credits and room to experiment. I was thinking about how people perceive the many things competing for their attention. A list can order them; what if a spatial view could show how they relate to the person choosing what matters now?

That question became Focus Galaxy. The person sits at the center, marked **YOU / NOW**; priorities orbit around them. The idea was quick to prototype. Understanding whether it was useful would take longer.

[VISUAL — Replit event photo, pending selection and publication approval]

*Editorial note: Supplied event photographs are documented in FOCUS_GALAXY_STORY_EVIDENCE.md. Select an authentic frame from that inventory after Ahmed approves the source and permission for identifiable attendees is confirmed. Event photographs are not verified first-prototype screenshots.*

## Start with the moment of choice

A list is good at capturing work, showing sequence, and supporting execution. Yet when several worthwhile commitments compete, a long queue may make their relative importance, urgency, and expected effort harder to compare at a glance.

I was interested in that moment before execution: when someone has to pause, compare what is pulling at them, and choose what deserves attention now. A spatial map felt like a way to make those relationships visible. That was a design hypothesis, not a claim about how everyone thinks or a conclusion from research.

## Make the question tangible

The galaxy metaphor gave the question a form. The person becomes the reference point; priorities occupy a shared space around them. In Focus Galaxy, importance, urgency, and the current **Energy / Effort** input inform a priority’s visual representation through cues such as size, distance, and activity. A deterministic **Focus Score** offers a rule-based signal. The map is meant to show selected information in relation to the person’s current moment, then leave the choice to that person.

By my account, I had a working prototype in about forty minutes. The prototype made the idea tangible enough to demonstrate at the event, including a visual presentation with music. The time matters here because it shortened the distance between a question and something people could respond to. It does not describe the work needed to make the product useful.

[VISUAL — original prototype capture, pending source]

*Editorial note: No genuine screenshot or recording of the original prototype has been found. The synthetic SVG in `docs/assets/focus-galaxy-synthetic.svg` is concept art, not a historical screen or event capture; do not use it as the prototype or as “before” evidence.*

## Interest is a signal, not validation

The event response was positive, and the prototype led to conversations. That encouraged me to keep thinking about it. A striking visual can catch attention; positive reactions and conversations suggest early interest. Product validation would require evidence from actual use.

The demo was not structured user research. It did not establish that people understood the map in ordinary use, made better decisions with it, returned to it, or wanted a defined product in this category. Those outcomes remain unproven.

## Return to the idea

Several weeks later, I came back to Focus Galaxy. The more useful question had shifted from whether I could build the scene to what would need to be true for someone to use it. That meant taking the event prototype as a starting point and working through the everyday decisions around it.

The first trade-off was the job of the product. Focus Galaxy is a **visual priority map** for people balancing competing commitments. It is designed to help them compare priorities and choose what to focus on next. Lists, calendars, and project tools remain strong for sequencing, deadlines, dependencies, and execution. The map should complement those tools, not claim to replace them.

The second trade-off was how much the galaxy should explain. Size, distance, and activity can make selected attributes visible, but space and motion can also add visual noise. Labels, controls, and the Focus Score need to stay understandable. A ranked view can support scanning; the open question is how it should work alongside the spatial view, including for people who prefer a more linear way to compare work.

## Product decisions become implementation

The current documented product is a browser-based visual priority map. People can edit priorities and save them locally. The current implementation uses React, Vite, and TypeScript; those choices support the interactive map and its editing flows, while keeping the first version in the browser.

Local saving keeps setup simple, but it does not provide account-based access or sync across devices. A rule-based score is easier to inspect than an unexplained recommendation, but any score can appear more authoritative than its inputs deserve. The Focus Score is a cue based on importance, urgency, and Energy / Effort—not a verdict about what someone should value.

These are product choices with costs as well as benefits. A spatial overview can make relationships easier to inspect for some people, but that advantage has not been demonstrated. A focused product can stay clear of becoming an all-purpose project-management suite, but it still has to give people enough information to act on the priorities they choose. The current feature set is a working answer to those tensions, not a finished model.

The development history shows continued implementation after the prototype; it does not show that each change was user-tested. One genuine desktop capture in the workspace documents an intermediate product view associated with September 28. Later changes followed, so that image is useful as a dated step in the evolution, not as a picture of the current interface.

[VISUAL — September 28 product state]

*Editorial note: `docs/assets/focus-galaxy-desktop.jpg` is the genuine 1440×900 live-app capture in the workspace. It was added to Git on September 28; the exact capture timestamp is not established. Caption it as the September 28 view or clearly dated intermediate state, and do not present it as the current product. Review the sample priority names before public use.*

[VISUAL — current product capture, pending]

*Editorial note: No current desktop or mobile capture is available in the workspace. Capture the live product state at publication time with neutral sample priorities; this should show the current interface rather than reuse the September 28 image.*

## Questions still open

The central product hypothesis remains to be tested: for people who prefer visual over purely sequential planning, will a spatial map help them compare competing priorities and choose a next focus with greater clarity?

That leaves practical questions. Which people actually prefer this view, and in what planning moments? Can they read the visual encoding without explanation? Does the score help them understand a trade-off or create false precision? How should the map stay clear as priorities accumulate? How much detail belongs in the overview, and what should remain in a separate tool? What should happen when people move between devices?

The positioning brief suggests comparing the map with a list-based view using real prioritization tasks. That could make comprehension, time to a choice, confidence, and later return useful things to observe. Until that work happens, the product’s intended value remains a hypothesis. There is no evidence here of improved focus or productivity, retention, willingness to pay, or demand from a defined segment.

[VISUAL — before/after, only after authentic sources exist]

*Editorial note: A fair comparison requires a genuine original prototype capture and a genuine current product capture, with dates and viewports made clear. Neither the synthetic SVG nor a reconstruction from old code should be represented as the screen attendees saw.*

## The work continues

Focus Galaxy is still evolving. The immediate value I want from it is proof of work: an inspectable record of moving from observation to question, prototype, event reaction, product decisions, implementation, and further questions. That means being clear about what the build demonstrates and what only observed use could establish.

Rapid prototyping makes an idea visible quickly. Product quality comes from what happens afterward: the trade-offs, the implementation, the feedback, the iteration, and the evidence gathered along the way.

> Forty minutes was enough to make Focus Galaxy tangible.  
> The product work starts in the weeks and iterations that follow.

### Explore further

- Explore Focus Galaxy — link to confirm
- Read the technical/build notes — link to add
- View the repository — link to confirm

---

## Recommended primary title

**Building Focus Galaxy: From Event Demo to Ongoing Experiment**

This is the strongest fit because it names the project and keeps the emphasis on the longer product journey. The prototype is the beginning of the story, not the accomplishment the article asks readers to remember.

### Alternative titles

- **A Galaxy for What Competes for Our Attention**
- **From a Forty-Minute Prototype to a Product Question**
- **Why I Put Priorities in Orbit**
- **A Prototype Is a Question You Can Interact With**

## Final visual placement plan

1. **After the opening:** `[VISUAL — Replit event photo, pending selection and publication approval]` — select an authentic event image from the evidence inventory. Confirm the event/date caption and permission for identifiable people.
2. **After the prototype paragraph:** `[VISUAL — original prototype capture, pending source]` — request the genuine Replit preview, screenshot, or recording. No such visual is currently in the workspace. Never substitute the synthetic SVG.
3. **At the iteration transition:** `[VISUAL — September 28 product state]` — use `docs/assets/focus-galaxy-desktop.jpg` as an intermediate dated view. The repository addition date is September 28; the exact capture time is unknown, and the screenshot predates later product work.
4. **After current implementation:** `[VISUAL — current product capture, pending]` — take a genuine current desktop capture, and optionally a phone capture, with neutral sample data. Label the capture date so it cannot be mistaken for the September 28 screen.
5. **Near the unresolved questions:** `[VISUAL — before/after, only after authentic sources exist]` — pair the original prototype with the current product only when both genuine captures are available and their dates are clear. Do not use synthetic art or a historical re-render as the original event screen.

## Factual statements still requiring Ahmed’s confirmation

- The article attributes **about forty minutes** to Ahmed’s account. Confirm that this is the right first-person recollection to publish. Repository dates do not independently establish the duration; keep the wording approximate unless a contemporaneous timer, post, or recording is supplied.
- Confirm any more specific Replit event name, date, venue, or city before adding it. The article currently says only “a few weeks ago, at a Replit event.”
- Confirm that the event demonstration included the visual presentation and music, and that the response was positive and led to conversations. The copy intentionally reports these as Ahmed’s informal recollection, not structured research or measured demand.
- Confirm the timing of Ahmed’s return to the project if the “several weeks later” wording is made more precise.
- The available desktop image is genuine and was added to Git on September 28, but its exact capture timestamp is unknown. Confirm any stronger image-date claim before publication.
- Recheck current product behavior and terminology when the pending current capture is made. The interface may change between this draft and publication.
- Add or confirm the three navigation destinations before publishing the article.
