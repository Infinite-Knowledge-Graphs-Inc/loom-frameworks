/**
 * What the CI database needs that no other seed supplies.
 *
 * seed:sources registers the readings and seed:demo builds the cohort, but both
 * start from "a course exists" — seed:demo says so and stops
 * ("No course exists — create one on /admin/courses first") — and three specs
 * need the shape of a real course, not just its readings:
 *
 *  - a COURSE, with the id `course-foundations-studio`.
 *    tests/admin-course-param.spec.ts expects the oldest course to carry that
 *    id (the app falls back to the oldest course).
 *  - WEEKS on the course's readings. tests/course-switch.spec.ts looks for a
 *    "Week N" heading on the shelf; with every reading unscheduled the shelf
 *    only says "unscheduled" and the spec cannot find one.
 *  - a LEARNER OUTSIDE EVERY SECTION who holds a concept of their own.
 *    tests/journey-admin.spec.ts ("choosing a section narrows the cohort map")
 *    needs the whole cohort's map to be larger than Section 1's. In seed:demo
 *    everyone who holds concepts is in Section 1 (B and the two-course learner,
 *    who are outside it, hold none), so the two maps came out the same size:
 *    68 nodes and 68 nodes, measured 2026-10-29 on the ci branch.
 *
 * Until 2026-10-29 the CI database got all three from being a copy of a
 * populated branch. A fresh branch gets none of them, so this makes them
 * reproducible from empty.
 *
 * Order: after seed:sources (it links those rows), before or after seed:demo —
 * seed:demo only wipes the accounts it names, and this one is not among them.
 * Idempotent: every write is an upsert or a delete-then-insert of rows this
 * script owns.
 *
 * It refuses to run without LOOM_CI_FIXTURE=1. It writes a course, weeks and a
 * demo account, which is right for the CI database and wrong for any other.
 */
import { db } from "../src/db"
import { users, courses, courseSources, courseMemberships, concepts, sources } from "../src/db/schema"
import { eq, and, inArray } from "drizzle-orm"

const COURSE = {
  id: "course-foundations-studio",
  slug: "design-frameworks-test-0729",
  name: "Design Frameworks Test 0729",
  term: "Fall 2026",
  description: "DES INV 200",
  // Older than "Second Course (e2e)", which test-login creates at run time, so
  // the oldest-course fallbacks keep landing here.
  createdAt: new Date("2026-07-07T04:31:59.655Z"),
}

// seedKey → the week it sits in. The practice reading is on the shelf but not
// scheduled (it is not a course reading — see seed-sources.ts).
const SHELF: { seedKey: string; week: number | null; position: number }[] = [
  { seedKey: "object-worlds", week: 1, position: 0 },
  { seedKey: "communities-of-practice", week: 2, position: 0 },
  { seedKey: "boundary-objects", week: 3, position: 0 },
  { seedKey: "practice-loom-reading", week: null, position: 1 },
]

const OUTSIDER = { email: "test-outsider@loom.local", name: "Test Outsider" }
const OUTSIDER_CONCEPT = {
  label: "a concept only the outsider holds",
  def: "Held by a learner who is in no section, so a section's map leaves it out.",
}

async function main() {
  if (process.env.LOOM_CI_FIXTURE !== "1") {
    throw new Error("Refusing to run: this writes a course, weeks and a demo account. Set LOOM_CI_FIXTURE=1 on the CI database only.")
  }

  await db.insert(courses).values(COURSE).onConflictDoNothing({ target: courses.id })

  const rows = await db
    .select({ id: sources.id, seedKey: sources.seedKey })
    .from(sources)
    .where(inArray(sources.seedKey, SHELF.map((s) => s.seedKey)))
  for (const entry of SHELF) {
    const row = rows.find((r) => r.seedKey === entry.seedKey)
    if (!row) throw new Error(`No reading with seedKey "${entry.seedKey}" — run \`npm run seed:sources\` first.`)
    await db
      .insert(courseSources)
      .values({ courseId: COURSE.id, sourceId: row.id, isVisible: true, isCore: true, week: entry.week, position: entry.position })
      .onConflictDoUpdate({
        target: [courseSources.courseId, courseSources.sourceId],
        set: { week: entry.week, position: entry.position },
      })
  }

  const [existing] = await db.select().from(users).where(eq(users.email, OUTSIDER.email)).limit(1)
  const outsider = existing ?? (await db.insert(users).values({ ...OUTSIDER, role: "USER" }).returning())[0]
  if (!outsider.email.endsWith("@loom.local")) throw new Error(`Refusing to touch non-demo account ${outsider.email}`)

  await db
    .insert(courseMemberships)
    .values({ courseId: COURSE.id, userId: outsider.id, sectionId: null, role: "LEARNER" })
    .onConflictDoUpdate({
      target: [courseMemberships.courseId, courseMemberships.userId],
      set: { sectionId: null, role: "LEARNER", removedAt: null },
    })
  await db.delete(concepts).where(and(eq(concepts.userId, outsider.id), eq(concepts.courseId, COURSE.id)))
  await db.insert(concepts).values({ userId: outsider.id, courseId: COURSE.id, ...OUTSIDER_CONCEPT })

  console.log(`[seed-ci-fixture] course "${COURSE.name}", ${SHELF.length} readings on its shelf (weeks ${SHELF.map((s) => s.week ?? "–").join("/")}), ${OUTSIDER.email} outside every section with 1 concept`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-ci-fixture] failed:", err)
    process.exit(1)
  })
