"use client"

// 05 · Projections across readings (beta). Choose readings, see every concept they evidence,
// and sort those concepts on the same three-tier board as 03 · Knowledge Graph.
//
// The scope is the URL (`/span` or `/span/<id>/<id>/…`). LoomProvider reads
// that path through `spanScopeKey` and the board is MapTab, so a tier, a drag
// and a one-line are the same map row 03 writes. One reading is that
// reading's own projections (`scopeOf` of one id is the id). Two or more are
// a different scope key — sorted ids, comma-joined — and a projection of
// their own.

import Explainer from "@/components/ui/Explainer"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useLoom } from "@/components/providers/LoomProvider"
import { useReadings, type ReadingMeta } from "@/components/providers/ReadingsProvider"
import JourneyNav from "@/components/ui/JourneyNav"
import Identity from "@/components/ui/Identity"
import SignedOutWelcome from "@/components/ui/SignedOutWelcome"
import ConceptCard from "@/components/cards/ConceptCard"
import MapTab from "@/components/tabs/MapTab"
import ThrowTab from "@/components/tabs/ThrowTab"
import { scopeOf, scopeFromKey, spanIdsFromPath, spanPath, readingsOf } from "@/lib/scope"
import { listSetNames, setSetName } from "@/actions/loom"
import { sortedByLabel } from "@/lib/utils"
import type { Passage } from "@/lib/types"
import styles from "./SpanStation.module.css"

export default function SpanStation({ isPreviewDeployment = false }: { isPreviewDeployment?: boolean }) {
  const { data: session, status } = useSession()
  const { readings, isLoading: loadingShelf, error: shelfError, refresh, titleOf } = useReadings()
  const { state, scopedState, scoped, isLoading, flash } = useLoom()
  const router = useRouter()
  const pathname = usePathname()
  const rawIds = spanIdsFromPath(pathname)
  const rawKey = scopeOf(rawIds).key

  const knownIds = useMemo(() => new Set(readings.map((r) => r.id)), [readings])
  // The shelf is not known yet while the session is still resolving OR the
  // provider says it is loading. Both matter: on a hard load (reload, bookmark,
  // a link) ReadingsProvider's `!session` branch sets `isLoading` false with
  // `readings = []` before the session arrives, so `loadingShelf` alone is
  // false at exactly the moment the shelf is empty because it has not been
  // asked for. Observed 2026-10-28 on the running app: a reload of
  // /span/<id>/<id> landed on /span with nothing chosen.
  const shelfPending = status === "loading" || loadingShelf
  const selected = useMemo(() => {
    const ids = scopeOf(rawKey ? rawKey.split(",") : []).sourceIds
    if (shelfPending) return ids
    return ids.filter((id) => knownIds.has(id))
  }, [rawKey, shelfPending, knownIds])

  // Drop an id that is not on this shelf, and rewrite an unsorted path to
  // `spanPath`'s order. `replace` so the cleanup is not its own history step.
  // Compared against `pathname`, not the scope key: `scopeOf` sorts, so
  // `/span/b/a` and `/span/a/b` are one key and would otherwise both stay.
  //
  // Not while the shelf failed to load: ReadingsProvider leaves `readings` as
  // [] on a first-load error (and says so in `error`), so every id would look
  // unknown and a bookmark like /span/a/b would be rewritten to /span by a
  // network blip. Read in ReadingsProvider.tsx; not reproduced in a browser.
  //
  // And not while the shelf is empty, for the reason on `shelfPending` above:
  // an empty list is "not asked yet" far more often than "nothing published".
  // The cost of waiting is that a bookmark to a course with truly no readings
  // keeps its ids in the address bar; with no shelf there is nothing it could
  // have been checked against, and the picker says so.
  useEffect(() => {
    if (shelfPending || shelfError || readings.length === 0) return
    const kept = scopeOf(rawKey ? rawKey.split(",") : []).sourceIds.filter((id) => knownIds.has(id))
    const next = spanPath(kept)
    if (pathname !== next) window.history.replaceState(null, "", next)
  }, [shelfPending, shelfError, readings.length, knownIds, rawKey, pathname, router])

  // The path changes through the History API, not `router.push`. A router
  // navigation to a different `/span/<ids>` is a different dynamic segment
  // value, and layout-router.js keys each segment's subtree by it
  // (`createRouterCacheKey` joins the param value in; the child renders under
  // `stateKey`), so the whole station remounted: the picker's own scroll went
  // back to week 1 and the page scrolled to the top (reported 2026-10-30: choose
  // a week 13 reading, it is chosen, the list jumps to week 1). Read from the
  // source, not reproduced in a browser: /span does not load in this dev server.
  // `usePathname` follows pushState, which is all the scope is read from.
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    window.history.pushState(null, "", spanPath(next))
  }

  const courseReadings = useMemo(() => readings.filter((s) => !s.isOwn), [readings])
  const ownReadings = useMemo(() => readings.filter((s) => s.isOwn), [readings])
  const byWeek = useMemo(() => {
    const groups = new Map<number | null, ReadingMeta[]>()
    courseReadings.forEach((s) => {
      const list = groups.get(s.week) ?? []
      list.push(s)
      groups.set(s.week, list)
    })
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === b) return 0
      if (a === null) return 1
      if (b === null) return -1
      return a - b
    })
  }, [courseReadings])

  // The sets this student has already made a projection of — the way back to
  // them after they leave the station, since a set otherwise lives only in the
  // address bar. A map row's key with a comma IS a set (the split search.ts
  // and createMap make). A set naming a reading no longer on the shelf is not
  // listed: the cleanup above would drop that id and open a different scope
  // than the one stored, which is worse than not offering it. Newest work
  // first; `updatedAt` moves on every tier, drag and rewrite (`updateMap`).
  const savedSets = useMemo(() => {
    const bySet = new Map<string, { key: string; ids: string[]; projections: number; at: number }>()
    for (const m of state.maps) {
      if (!m.scopeKey.includes(",")) continue
      const ids = scopeFromKey(m.scopeKey).sourceIds
      if (!ids.every((id) => knownIds.has(id))) continue
      const row = bySet.get(m.scopeKey) ?? { key: m.scopeKey, ids, projections: 0, at: 0 }
      row.projections += 1
      row.at = Math.max(row.at, m.updatedAt.getTime())
      bySet.set(m.scopeKey, row)
    }
    return [...bySet.values()].sort((a, b) => b.at - a.at)
  }, [state.maps, knownIds])

  // A set's name, when the student has given it one (`reading_set`, migration
  // 0031), keyed by scope key. Fetched on its own rather than carried in the loom
  // state: a database that lacks the table loses these names and nothing else.
  const [setNames, setSetNames] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!session) return
    let live = true
    listSetNames()
      .then((names) => { if (live) setSetNames(names) })
      .catch((e) => console.error("could not load set names", e))
    return () => { live = false }
  }, [session])

  // A set's readings in shelf order (week, then as the shelf lists them), not
  // in the id order the scope key sorts by — which reads as random.
  const shelfIndex = useMemo(() => new Map(readings.map((r, i) => [r.id, i])), [readings])
  const titlesOf = (ids: string[]) =>
    [...ids].sort((a, b) => (shelfIndex.get(a) ?? 0) - (shelfIndex.get(b) ?? 0)).map((id) => titleOf(id))
  // What an unnamed set is called: its first reading and how many more.
  const autoLabel = (titles: string[]) =>
    titles.length > 1 ? `${titles[0]} + ${titles.length - 1} more` : titles[0] ?? ""

  const [editingSet, setEditingSet] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const savingSet = useRef(false)
  const commitSetName = async (key: string) => {
    if (savingSet.current) return
    savingSet.current = true
    setEditingSet(null)
    const prev = setNames[key] ?? ""
    const next = draftName.replace(/\s+/g, " ").trim()
    if (next === prev) { savingSet.current = false; return }
    const put = (name: string) => setSetNames((cur) => {
      const copy = { ...cur }
      if (name) copy[key] = name
      else delete copy[key]
      return copy
    })
    put(next)
    try {
      put(await setSetName(key, next))
    } catch (e) {
      put(prev)
      flash(e instanceof Error ? e.message : "could not save the set's name")
    } finally {
      savingSet.current = false
    }
  }

  const across = selected.length >= 2
  const concepts = useMemo(() => sortedByLabel(scopedState.concepts), [scopedState.concepts])
  const [filter, setFilter] = useState("")
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const needle = filter.trim().toLowerCase()
  const visible = needle
    ? concepts.filter((c) =>
        c.label.toLowerCase().includes(needle) || (c.def ?? "").toLowerCase().includes(needle))
    : concepts

  const onGotoPassage = (passage: Passage) => {
    if (!passage.sourceId) return
    router.push(`/reading/${passage.sourceId}?passage=${passage.id}`)
  }

  if (status === "loading") {
    return (
      <>
        <JourneyNav active="span" />
        <main>
          <div className="empty" style={{ marginTop: "100px" }}>
            <h2>Loading your loom...</h2>
          </div>
        </main>
      </>
    )
  }

  if (!session) {
    return (
      <main>
        <SignedOutWelcome isPreviewDeployment={isPreviewDeployment} />
      </main>
    )
  }

  // One tile per reading, all the same size: a one-line title over a one-line
  // author, each cut with an ellipsis (the full text is on `title`). They used
  // to be chips as wide as their titles, so a shelf of 31 readings made ragged
  // rows with a week heading between each group (user request, 2026-10-29:
  // "each reading like item block is like right now short or long. There should
  // be a consistent width"). The button keeps `.chip` + aria-pressed: the spec
  // finds the picker by `main button.chip[aria-pressed]`.
  const tiles = (list: ReadingMeta[]) => (
    <div className={styles.grid}>
      {list.map((r) => {
        const on = selected.includes(r.id)
        return (
          <button
            key={r.id}
            type="button"
            className={`chip ${styles.pick}`}
            aria-pressed={on}
            title={r.author ? `${r.title} — ${r.author}` : r.title}
            onClick={() => toggle(r.id)}
          >
            <span className={styles.ptitle}>{r.title}</span>
            <span className={styles.pauthor}>{r.author || "\u00a0"}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <>
      <JourneyNav active="span" />
      <main className="station-work">
        <p className="tasktitle">Choose readings. See their concepts. Project them.</p>
        <Explainer className="tasksub">
          In beta. The list is every concept in the readings you choose — evidenced by a passage there,
          or named there before a passage existed — and the board sorts them into primary, secondary and
          tertiary the same way Knowledge Graph does. The lines are threads you have already thrown.
          With two or more readings you can also throw a thread between concepts of different
          readings. Nothing here places a card for you.
        </Explainer>

        {!loadingShelf && savedSets.length > 0 && (
          <>
            <h2 className="sectionhead">
              Sets you have worked on <span className="n">{savedSets.length}</span>
            </h2>
            <div className={styles.sets}>
              {savedSets.map((set) => {
                const href = spanPath(set.ids)
                const titles = titlesOf(set.ids)
                const name = setNames[set.key]
                const isOpen = pathname === href
                const isEditing = editingSet === set.key
                return (
                  <div key={set.key} className={`${styles.set}${isOpen ? ` ${styles.setopen}` : ""}`}>
                    <div className={styles.sethead}>
                      {isEditing ? (
                        <input
                          className={styles.setinput}
                          autoFocus
                          aria-label="Name this set"
                          value={draftName}
                          maxLength={80}
                          placeholder={autoLabel(titles)}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); void commitSetName(set.key) }
                            if (e.key === "Escape") { savingSet.current = true; setEditingSet(null); window.setTimeout(() => { savingSet.current = false }, 0) }
                          }}
                          onBlur={() => void commitSetName(set.key)}
                        />
                      ) : (
                        <Link
                          href={href}
                          className={styles.setlink}
                          aria-current={isOpen ? "page" : undefined}
                          title={`${name ? `${name}: ` : ""}${titles.join(" + ")} — ${set.projections} projection${set.projections === 1 ? "" : "s"}`}
                        >
                          <span className={name ? undefined : styles.setauto}>{name || autoLabel(titles)}</span>
                          <span className={styles.savedn}> · {set.projections}</span>
                        </Link>
                      )}
                      {!isEditing && (
                        <button
                          type="button"
                          className={styles.setedit}
                          aria-label={name ? `Rename ${name}` : `Name this set: ${autoLabel(titles)}`}
                          onClick={() => { setDraftName(name ?? ""); setEditingSet(set.key) }}
                        >
                          {name ? "rename" : "name this set"}
                        </button>
                      )}
                    </div>
                    {/* Every reading in the set, which the chip used to cut off.
                        One line, the rest behind the chevron. */}
                    <Explainer className={styles.setreads}>{titles.join(" · ")}</Explainer>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <h2 className="sectionhead">
          Readings <span className="n">
            {selected.length === 0
              ? "pick at least one"
              : `${selected.length} chosen`}
          </span>
        </h2>

        {loadingShelf && <p className="hint">Reading the shelf…</p>}
        {!loadingShelf && shelfError && readings.length === 0 && (
          <div className="empty" role="alert">
            <span className="cap">could not load your readings — {shelfError}</span>
            <button type="button" className="btn ghost mini" onClick={refresh}>try again</button>
          </div>
        )}
        {!loadingShelf && !shelfError && readings.length === 0 && (
          <div className="empty">
            <span className="cap">no readings published to your course yet</span>
          </div>
        )}

        {/* One scrollable box, so the picker costs a fixed slice of the page
            however long the shelf is. The week label sits in a narrow column
            beside its tiles rather than on a row of its own: with a heading row
            per week, a shelf of 11 weeks spent a third of the box on headings. */}
        <div role="group" aria-label="Readings in this projection" className={styles.picker}>
          {byWeek.map(([week, list]) => (
            <section key={week ?? "none"} className={styles.group}>
              <span className={`cap ${styles.grouplabel}`}>{week === null ? "unscheduled" : `week ${week}`}</span>
              {tiles(list)}
            </section>
          ))}
          {ownReadings.length > 0 && (
            <section className={styles.group}>
              <span className={`cap ${styles.grouplabel}`}>your own</span>
              {tiles(ownReadings)}
            </section>
          )}
        </div>

        {selected.length > 0 && (
          <>
            {/* Two or more readings: the concepts ARE the bench's warp, and the
                bench is where a thread is thrown between them. One reading
                keeps the plain list below, because linking inside one reading
                is 02's job and is not offered twice. */}
            {across && (
              <>
                <h2 className="sectionhead">
                  Link concepts across these readings <span className="n">
                    {isLoading ? "reading your loom" : `${concepts.length} concepts in ${selected.length} readings`}
                  </span>
                </h2>
                {isLoading
                  ? <div className="empty"><span className="cap">reading your loom…</span></div>
                  : <ThrowTab across onGotoPassage={onGotoPassage} />}
              </>
            )}
            {!across && (
              <>
            <h2 className="sectionhead">
              Concepts <span className="n">
                {isLoading
                  ? "reading your loom"
                  : `${concepts.length} in ${selected.length === 1 ? "this reading" : "these readings"}`}
              </span>
            </h2>
            {!isLoading && concepts.length > 0 && (
              <div className="quietrow" style={{ marginTop: 0, paddingTop: 0, borderTop: "none", marginBottom: 10 }}>
                <input
                  placeholder="filter these concepts…"
                  aria-label="Filter concepts"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
            )}
            <div className="scrollbox">
              {isLoading && (
                <div className="empty"><span className="cap">reading your loom…</span></div>
              )}
              {!isLoading && concepts.length === 0 && (
                <div className="empty">
                  <span className="cap">no concepts in the readings you chose</span>
                </div>
              )}
              {!isLoading && concepts.length > 0 && visible.length === 0 && (
                <p className="empty">No concept matches “{filter.trim()}”.</p>
              )}
              {!isLoading && visible.map((concept) => (
                <ConceptCard
                  key={concept.id}
                  concept={concept}
                  passages={scopedState.passages.filter((b) => b.conceptIds.includes(concept.id))}
                  allPassages={state.passages}
                  readings={readingsOf(concept.id, scopedState.passages).length}
                  evidenceSay={selected.length === 1 ? "— in this reading" : "— in the readings you chose"}
                  concepts={scopedState.concepts}
                  titleOf={titleOf}
                  mode="edit"
                  readOnly
                  onGotoPassage={onGotoPassage}
                  edit={{
                    isOpen: !!open[concept.id],
                    onToggle: () => setOpen((p) => ({ ...p, [concept.id]: !p[concept.id] })),
                    onEditDef: () => {},
                  }}
                />
              ))}
            </div>
              </>
            )}

            {selected.length === 1 && (
              <Explainer className="hint">
                One reading, so this board is that reading&apos;s Knowledge Graph — the same projections as on 03.
                Add a second reading and the projection belongs to the pair.
              </Explainer>
            )}

            {/* Nothing to sort with no concepts, and the list above already
                says so. MapTab's own empty line ("lay some warp on 01") is
                03's and is wrong here, so the board is simply not drawn. */}
            {!isLoading && concepts.length > 0 && <MapTab projectionOnly />}
          </>
        )}
      </main>
      <footer>
        <Identity />
        <span className="fr">
          <span className="foottitle">
            {selected.length === 0
              ? "No readings chosen"
              : selected.map((id) => titleOf(id)).join(" · ")}
          </span>
          {selected.length > 0 && !isLoading && (
            <span className="footmeta">
              {scoped.concepts.length} concept{scoped.concepts.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>
      </footer>
    </>
  )
}
