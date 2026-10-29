# Projections across readings — proposal

**Status: proposal — built as a beta on the owner's direction; questions not individually answered.** Written against the
`prototype/05-span` branch so that a ruling exists on what it *is*. Under
AGENTS.md nothing here ships while the questions stand; the station is
labelled "(beta)" in the nav as a courtesy to whoever opens it, which is not
a ruling and does not lift the gate (the tag was asked for in chat on
2026-10-28; nothing in that exchange was a ruling by TJ).

**Owner direction, 2026-10-28.** The project owner said in chat that TJ is no
longer on the project and asked to "just make this work" without interfering
with the other tabs, with persistence. That is direction to build; it is not
an answer to the nine questions below, none of which was put to them one by
one. What the build does about each, so the choices are visible:

- Q1, Q2, Q4, Q3 (name): built as the recommendations say — a chosen set,
  never "all"; a Projection scoped to a set of Readings (`map.scopeKey`); a
  sixth station; the model's word "Projection" in the label.
- Q5 (Capture Log), Q6 (reset), Q7 (search), Q8, Q9: **left as found.** Each
  would change what another tab shows or does, which the direction rules out.
- The model (`loom-model-build.md`) is **not amended**. Where this build and
  §1–§3 disagree, the model still reads as written; amending it is the
  owner's call and has not been made.

## The problem

A student reading in three Readings has three Knowledge Graphs and no place to
look at the concepts those Readings share, or to sort them into one Projection.
Station 03 is per-Reading by design; the only wider view was the whole weave,
which was removed. So "what do these two readings evidence together, and how
would I rank it?" has no surface.

## What the branch contains

A station `05` (`/span`, `/span/<id>/<id>/…`; key `span`) that:

1. Lets the student choose any number of Readings from their shelf.
2. Lists every Concept those Readings evidence (a Passage there, or named
   there before a Passage existed), using the ordinary Concept card, read-only.
3. Draws 03's own board — `MapTab` with `projectionOnly`, so no Cloth and no
   Capture Log — over that set, with Projections stored per set.

Nothing new is stored: a Projection's scope is already `map.scopeKey`, a
sorted, comma-joined list of source ids (`scopeOf` in `src/lib/scope.ts`).
One Reading's key is its id, which is why a single chosen Reading gives
exactly that Reading's 03. **No migration.** The server refuses a set that
names a Reading the caller cannot open (`createMap`, this branch).

## Where it sits in the model

- [loom-model-build.md](../loom-model-build.md) §2 *Reading · Cloth ·
  Projection*: "Cloth = … one Reading + … + Projections". A Projection
  belongs to a Cloth and a Cloth has exactly one Reading
  ([cloth-cardinality.md](../cloth-cardinality.md)). **A Projection over two
  Readings belongs to no Cloth.** This is the real model delta; see Q2.
- §1: the whole weave is "removed from the app 2026-08-11 … Reintroduce only
  with a definition." A picker that can select every Reading is a way to
  assemble something that looks like it. See Q1.
- §3 is titled "five stations". This would be a sixth, beta or not. See Q4.
- §2 *Projection*: "Nothing in the UI is called a 'Map'". See Q3.
- The Quilt proposal ([quilt.md](quilt.md), held) is the nearest relative: it
  also widens a Projection's scope, across people rather than across
  Readings, and its Q3 ("what is a quilt's occasion?") is this proposal's Q2.
  The two should be answered together or the second will contradict the first.

## Rulings that constrain it

- Weave removal — TJ, 2026-08-11, quoted in §1.
- Capture Log is "specific to that reading, not all readings" — TJ,
  2026-08-10, quoted in `src/lib/logScope.ts`. Relevant to Q5.
- A fresh Projection opens unsorted; nothing seeds its Tiers (§2, ratified
  2026-08-07). The station honours this: it places no card for the student.
- Red lines 1–7 and 5 ("download at the object, by object"): not crossed by
  anything here to my reading, but not independently audited.

## Non-goals

- No other person's work appears. A set is the **caller's own** passages in
  several Readings; this is not a Quilt.
- No "all readings" shortcut, no weekly or course-wide grouping, nothing that
  chooses the set for the student.
- No new object, no migration, no change to Cloths.
- No automatic carry-over of Tiers from a Reading's Projection into a set's.

## Observed behaviour worth a ruling

Each of these is what the code does today, found by reading it; none was run
against a database (none on the machine this was written on).

- **Reset.** `resetReading(a)` clears maps whose `scopeKey` equals `a`
  exactly (`src/actions/loom.ts`, `eq(maps.scopeKey, scopeKey)`), so a set
  Projection over `a,b` survives resetting `a`. Q6.
- **Search.** `src/actions/search.ts` (around line 541) includes only maps with
  no comma in `scopeKey`, so set Projections are not search hits. That filter
  predates this branch and says single-reading only. Q7.
- **Capture Log.** Making a set Projection is recorded (`recordEvent` in
  `createMap`; editing's recording was not re-checked), but `eventBelongsToReading` matches a `scopeKey` payload
  only when it equals one Reading's id, so the act appears in no Reading's
  Capture Log and 05 hides the log. Recorded, not shown. Q5.
- **Dead ids.** The station drops any id not on the student's shelf from the
  address. A stored set that names a Reading no longer on the shelf therefore
  re-points to the remaining Readings' scope rather than opening as itself.
  Q8.
- **Cap.** `MAX_MAPS` (60) counts every Projection the student has, set or
  not. Q8.

## Open questions

1. **Is a chosen set of Readings the weave?** §1 reserves the word for a thing
   nobody has defined. Options: (a) no — a weave is the whole loom; a set is a
   deliberate choice of Readings and the picker never offers "all"; (b) yes —
   then this waits behind the definition, with Quilt Q6; (c) cap the set
   (two? three?) so it cannot approximate the whole. *Recommendation: (a).*
   The student chooses; the tool never gathers. If (c), the cap is a number
   only TJ can set; I have none to offer that is not a guess.
2. **What does a set Projection belong to?** Options: (a) several Cloths — the
   Projection's scope widens from one Cloth to the Cloths of the chosen
   Readings, Cloth cardinality untouched; (b) no Cloth — a Projection may
   belong to a set of Readings directly, and §2's formula changes; (c) a new
   kind of Cloth over several Readings, which contradicts cloth-cardinality
   and is listed only to be refused. *Recommendation: (a),* because it widens
   exactly one axis and the stored shape (`scopeKey`) already says it. This
   amends §2 and should be answered together with Quilt Q3.
3. **What is it called?** The requester's word was "maps"; the model forbids
   "Map" in the UI. The nav currently reads "Projections across readings
   (beta)", chosen to match §2, not decided by TJ. *Recommendation: keep the
   model's word; shorten if the nav needs it.* Open: would "Projections
   across Readings" capitalise Reading as §2 does?
4. **A station, or a switch inside 03?** §3 says of 03 "(Future: Quilts arrive
   in this same space.)" Options: (a) a sixth station (the branch);
   (b) a Reading-set switch on 03 itself, no new route; (c) neither.
   *Recommendation: (b) if Q2 is (a), because the board, its Projections and
   its downloads are 03's and one entry means one set of labels.* The branch
   built (a) because the request said "a new tab".
5. **Does a set Projection's activity belong in each member Reading's
   Capture Log?** Today it is recorded and shown nowhere. TJ's worry on
   2026-08-11 was "losing meaningful activities related to … building
   projections from a readings cloth". *Recommendation: yes, in every member
   Reading's log, marked as shared across the set.* The alternative is a log
   on 05. The log is append-only, so nothing is lost while this is open.
6. **What does resetting one Reading do to a set Projection that names it?**
   Today: nothing. Options: (a) leave it (Concepts, Links and Threads survive
   a Reading reset, so a set's Tiers still point at real Concepts); (b) clear
   the set; (c) ask. *Recommendation: (a),* but the reset dialog should then
   say a set Projection is kept.
7. **Do set Projections appear in search?** §2 *Search* lists "your
   Projections". *Recommendation: yes, labelled by the Readings they span.*
8. **Orphans and the cap.** What should a set Projection do once a Reading
   leaves the shelf, and should `MAX_MAPS` count sets? *Recommendation:
   keep the Projection and open it with the missing Reading shown as such;
   leave the cap as is until someone reaches it.*
9. **Does a set Projection's download name its Readings?** The projection and
   the concept-map kit still render on the board. Provenance header (§2
   *Download at the object*) says "student · course · when"; whether it should
   also list the Readings was not checked in the export code.

---
<!-- After the gate: Decisions, Plan, Tasks. Not written: nothing is answered. -->
