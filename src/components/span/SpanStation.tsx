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

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useLoom } from "@/components/providers/LoomProvider"
import { useReadings, type ReadingMeta } from "@/components/providers/ReadingsProvider"
import JourneyNav from "@/components/ui/JourneyNav"
import Identity from "@/components/ui/Identity"
import SignedOutWelcome from "@/components/ui/SignedOutWelcome"
import ConceptCard from "@/components/cards/ConceptCard"
import MapTab from "@/components/tabs/MapTab"
import ThrowTab from "@/components/tabs/ThrowTab"
import { scopeOf, scopeFromKey, spanPath, readingsOf } from "@/lib/scope"
import { sortedByLabel } from "@/lib/utils"
import type { Passage } from "@/lib/types"
import styles from "./SpanStation.module.css"

function idsFromParam(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string" && raw) return [raw]
  return []
}

export default function SpanStation({ isPreviewDeployment = false }: { isPreviewDeployment?: boolean }) {
  const { data: session, status } = useSession()
  const { readings, isLoading: loadingShelf, error: shelfError, refresh, titleOf } = useReadings()
  const { state, scopedState, scoped, isLoading } = useLoom()
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ sourceIds?: string | string[] }>()
  const rawIds = idsFromParam(params?.sourceIds)
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
    if (pathname !== next) router.replace(next)
  }, [shelfPending, shelfError, readings.length, knownIds, rawKey, pathname, router])

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    router.push(spanPath(next))
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
    const bySet = new Map<string, { ids: string[]; projections: number; at: number }>()
    for (const m of state.maps) {
      if (!m.scopeKey.includes(",")) continue
      const ids = scopeFromKey(m.scopeKey).sourceIds
      if (!ids.every((id) => knownIds.has(id))) continue
      const row = bySet.get(m.scopeKey) ?? { ids, projections: 0, at: 0 }
      row.projections += 1
      row.at = Math.max(row.at, m.updatedAt.getTime())
      bySet.set(m.scopeKey, row)
    }
    return [...bySet.values()].sort((a, b) => b.at - a.at)
  }, [state.maps, knownIds])

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

  const picker = (list: ReadingMeta[]) => (
    <div className="chips" style={{ marginBottom: 14 }}>
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
            {r.title}
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
        <p className="tasksub">
          In beta. The list is every concept in the readings you choose — evidenced by a passage there,
          or named there before a passage existed — and the board sorts them into primary, secondary and
          tertiary the same way Knowledge Graph does. The lines are threads you have already thrown.
          With two or more readings you can also throw a thread between concepts of different
          readings. Nothing here places a card for you.
        </p>

        {!loadingShelf && savedSets.length > 0 && (
          <>
            <h2 className="sectionhead">
              Sets you have worked on <span className="n">{savedSets.length}</span>
            </h2>
            <div className="chips" style={{ marginBottom: 14 }}>
              {savedSets.map((set) => {
                const href = spanPath(set.ids)
                const names = set.ids.map((id) => titleOf(id))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`chip ${styles.saved}`}
                    aria-current={pathname === href ? "page" : undefined}
                    title={`${names.join(" + ")} — ${set.projections} projection${set.projections === 1 ? "" : "s"}`}
                  >
                    {names.join(" + ")}
                    <span className={styles.savedn}> · {set.projections}</span>
                  </Link>
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

        <div role="group" aria-label="Readings in this projection">
          {byWeek.map(([week, list]) => (
            <section key={week ?? "none"}>
              <div className="weekhead">
                <span className="cap">{week === null ? "unscheduled" : `week ${week}`}</span>
                <span className="weekrule" />
              </div>
              {picker(list)}
            </section>
          ))}
          {ownReadings.length > 0 && (
            <section>
              <div className="weekhead">
                <span className="cap">your own readings</span>
                <span className="weekrule" />
              </div>
              {picker(ownReadings)}
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
              <p className="hint">
                One reading, so this board is that reading&apos;s Knowledge Graph — the same projections as on 03.
                Add a second reading and the projection belongs to the pair.
              </p>
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
