"use client"

import { useCallback } from "react"
import { useDialog } from "@/components/providers/DialogProvider"
import { useLoom } from "@/components/providers/LoomProvider"
import { conceptNameText } from "@/lib/conceptName"
import type { Concept } from "@/lib/types"

/**
 * DELETING A CONCEPT, ASKED ONCE AND WORDED ONCE.
 *
 * 04 · Vocabulary had the only door (TJ, 2026-08-17: "delete concept should
 * only be in vocabulary"). 02 · Linking gained the same + on 2026-08-18, so
 * a concept coined there had no remove on the page that coined it. Both
 * doors call this. It is one act — loom-wide, not "take it off this
 * reading" — and the dialog says so: passages stay, unlabeled, and a
 * concept woven into a thread is refused. The server refuses that too
 * (`deleteConcept` in src/actions/loom.ts).
 */
export function useRemoveConcept() {
  const { confirm, notify } = useDialog()
  const { state, removeConcept } = useLoom()

  return useCallback(
    async (concept: Concept) => {
      if (state.edges.some((e) => e.fromId === concept.id || e.toId === concept.id)) {
        await notify({
          title: "This concept is woven into a thread.",
          body: "Remove the thread on 02 · Linking first — deleting the concept now would take your thread with it.",
        })
        return
      }
      const passages = state.passages.filter((p) => p.conceptIds.includes(concept.id)).length
      const ok = await confirm({
        title: `Delete “${conceptNameText(concept)}”?`,
        body: passages
          ? `Its ${passages} captured passage${passages !== 1 ? "s" : ""} stay${passages !== 1 ? "" : "s"} in your work on ${passages !== 1 ? "their readings" : "its reading"}, under Unlabeled — file them under another concept whenever you like. Download your vocabulary first if you might want the concept itself back.`
          : "Download your vocabulary first if you might want this back.",
        confirmLabel: "Delete concept",
        danger: true,
      })
      if (ok) await removeConcept(concept.id)
    },
    [confirm, notify, state.edges, state.passages, removeConcept]
  )
}
