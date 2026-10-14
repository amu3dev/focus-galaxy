# A Galaxy for What Competes for Our Attention

*A product-builder case study about taking a quick prototype seriously enough to keep asking questions.*

## The question that took shape

A few weeks ago, I was at a Replit event with free credits and time to experiment. I did not want to spend that time making another conventional demo just because it was quick to build. I kept thinking about a more basic problem: our attention is pulled in several directions at once, while many planning tools present work as a sequence of rows.

A list is useful for recording, scanning, and sequencing work. For some prioritization moments, though, a linear view can make it harder to compare how the things I have recorded relate to one another, or which of them seems to be pulling hardest right now.

The question that took shape was simple: what if I could see those competing demands around me, instead of reading them only from top to bottom?

## Why a galaxy?

The galaxy metaphor gave me a way to make that question visible. The person sits at the center. Tasks, projects, ideas, and other priorities occupy orbits around them. The image suggests a field of competing forces, with the person as a reference point for comparing what feels more or less important, urgent, or demanding right now.

That mattered because I did not want to put stars behind a normal to-do list and call the result different. The spatial arrangement needed to carry meaning. In the product as it has evolved, importance, urgency, and energy or effort influence how a priority appears and how it is scored. The details are still a set of design choices to examine, but the intent is to let the visual system help answer a question the list leaves open: *what deserves attention now?*

The metaphor also came with a risk. A galaxy can be memorable and still be a distraction. If someone has to decode the scene before they can decide what to do, the visual language has added work instead of reducing it. I wanted to see whether the idea could be made interactive quickly enough to put in front of people.

## Forty minutes to make the idea tangible

The first working version took about forty minutes to create. That was enough to turn the central image into something people could see and interact with: a person at the center, priorities in orbit, and a visual presentation with music around the demo.

A first version in forty minutes made the idea concrete. I could show the metaphor and notice what people did with it. The product work would come later.

I demonstrated it during the Replit event. The response was positive, and it led to conversations. That was encouraging. It was also a very early signal: reactions to a short demo do not establish that a product is useful, that people will return to it, or that the visual map helps them make better decisions. They told me the premise had enough resonance to start a conversation. The rest still needed to be learned.

## Coming back to the prototype

It would have been easy to leave Focus Galaxy as an event prototype: a strong visual, a story that fits into a demo, and a few memorable minutes. Several weeks later, I returned to it with a different question: *what would need to be true for someone to use it?*

That changed the work. A prototype can get away with a single path through a presentation. A product has to handle ordinary actions: adding something, changing its importance as circumstances shift, finding it again, and deciding what to do next. It has to make sense on a phone as well as on a large screen. The map has to stay understandable as it fills up. And its score should not pretend to know more than the information behind it.

I began treating the project as an evolving product, with the demo as its starting point. The current version is a local-first web app. People can add, edit, remove, and revisit priorities; the data is saved in the browser. A rule-based Focus Score and short Focus Signal summary offer one way to interpret the map. Select a priority and the interface provides more detail; go one level deeper and that priority can hold notes and small tasks of its own. The map's intended job is the prioritization moment; sequencing and execution can remain in tools built for those jobs.

Those are product decisions as much as implementation details. Keeping priority data in the browser makes the first experience simpler, but it also means the current version does not provide account-based sync across devices. A score makes the map easier to scan, but it can create false precision if its rules are hidden or treated as objective truth. A detailed panel adds context, but it can compete with the galaxy for attention.

## From overview to detail

The current implementation uses React, Vite, and TypeScript. It supports an interactive central map, editable priorities, a ranked view, and a closer view for notes and tasks. On smaller screens, the interface adapts how those supporting details appear to fit the available space.

The product currently gives different kinds of concerns a common shape: a named priority with importance, urgency, and energy or effort. Whether tasks, projects, and ideas should share that shape remains an open information-model question. For now, a priority can hold smaller tasks and notes, while the galaxy stays focused on the broader set of things competing for attention.

I am still exploring where the boundary should sit between the overview and the detail. What belongs in orbit? What should appear only after selecting a planet? When does a ranked list make the map clearer, and when does it simply repeat the same information? On mobile, how much of the spatial experience can remain without making basic actions awkward?

The scoring model raises its own questions. The current Focus Score is deterministic and rule-based: importance contributes 45%, urgency 40%, and energy 15%. Because the score is deterministic, its rules can be inspected and changed. The weights remain working assumptions that need evidence before they can support broader claims.

## What remains unresolved

A visually interesting galaxy is easy to notice. The question that matters is whether the spatial view helps someone notice a useful relationship, make a decision with less friction, or return to the tool when their priorities change. I do not yet have evidence to claim that it does. People balancing several commitments who prefer a visual overview may be a useful place to start learning; the audience is still a hypothesis, not one established by use.

There are practical questions too. Is “priority” flexible enough to represent the mix of tasks, projects, ideas, and responsibilities people bring? How much structure should sit inside each orbit? Should the first experience begin with sample priorities or a blank sky? How should a visual score explain itself without becoming another dashboard to maintain? And what should happen when someone moves between devices?

These questions give the next iterations direction. The useful next step is the one that makes the product easier to understand and gives better evidence about whether its central idea is working.

## What I want to learn by building it

The immediate value I want from Focus Galaxy is proof of work. Revenue is not its primary goal right now. I want it to be a project people can inspect as it moves through observation, hypothesis, prototype, interaction design, implementation, feedback, iteration, and productization.

I want readers to see the decisions and their limits alongside the polished screen. Event reactions gave me encouragement; validation would require evidence from observed use and return. The implementation shows what I chose to build; whether those interactions solve the right problem has to be learned from use. The current product is useful because it makes the next questions more specific.

Rapid prototyping lowers the cost of making an idea visible. Product quality still depends on deciding what to keep, what to change, and whether the result helps anyone. Forty minutes was enough to make Focus Galaxy tangible. The product work starts in the weeks and iterations that follow.

---

## A. Possible article titles

1. **A Galaxy for What Competes for Our Attention**
2. **From a Forty-Minute Prototype to a Product Question**
3. **Why I Put Priorities in Orbit**
4. **A Prototype Is a Question You Can Interact With**
5. **Building Focus Galaxy: From Event Demo to Ongoing Experiment**

## B. Opening hooks

1. **A few weeks ago, I had free Replit credits, about forty minutes, and a question: what if the things competing for our attention were arranged around us instead of stacked in a list?**
2. **A to-do list records what is waiting. I wanted to explore whether a visual map could also show what was pulling hardest right now.**
3. **Focus Galaxy began as a short event demo. The more interesting work started weeks later, when I came back to ask what would make it useful beyond the demo.**

## C. LinkedIn excerpt

Focus Galaxy began as a roughly forty-minute prototype at a Replit event: a way to picture tasks and priorities orbiting around the person trying to make sense of them. A few weeks later, I returned to turn the demo into an evolving product—and to test whether spatial comparison can help people choose what deserves attention.

## D. Screenshot and photo placement suggestions

1. **After the opening:** Use one strong screenshot of the current galaxy as the visual anchor. Keep the event context in the caption so readers can tell the current product view from the original prototype.
2. **After “Forty minutes to make the idea tangible”:** Place an event photo or the earliest Replit prototype capture. If available, use a frame that shows the visual presentation and music setup; caption it clearly as the event demo.
3. **At “Coming back to the prototype”:** Use a simple side-by-side comparison of the earliest prototype and a current screen. Caption the comparison as an ongoing evolution.
4. **After “From overview to detail”:** Show the desktop galaxy beside the mobile view, then a selected-priority or Planet Focus view. These images can illustrate how the overview and supporting detail now fit together.
5. **Near the closing reflection:** If there is a useful process photo, such as a sketch, early screen, or event notes, use it to return the reader to the experiment behind the interface. Keep captions factual and date any “before and after” images where possible.
