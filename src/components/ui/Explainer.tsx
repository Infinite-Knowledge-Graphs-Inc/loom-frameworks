"use client"

import { useEffect, useId, useRef, useState } from "react"

/**
 * An explainer paragraph: one line by default, the rest behind a quiet chevron.
 *
 * Loom had too much explaining standing open at the top of every station
 * (request to the agent, 2026-10-29: each explainer should show one line by
 * default, the rest under a discreet dropdown, the same pattern across all of
 * them). This is that pattern in one place, so a station does not invent its
 * own.
 *
 * How it works
 *   - Collapsed, the text is `nowrap` + ellipsis — the first line is the real
 *     first line at the width the paragraph is given, not a hand-cut "summary"
 *     that could drift from the full text.
 *   - The chevron is rendered only when the text actually overflows. An
 *     explainer that already fits on one line gets no control at all.
 *     Overflow is re-measured on resize (ResizeObserver), because the width is
 *     the content box of the station, not the viewport (contracts.md §2c-iii).
 *   - While open, the chevron is kept even if widening the window would make
 *     the text fit on one line, so the control cannot vanish under the pointer.
 *
 * `className` / `style` land on the WRAPPER, not the `<p>`, so the existing
 * rules that style these paragraphs (`.tasksub`, `.card .hint`, `.yourwork
 * .hint`, `.info-dialog .info-note` …) keep applying unchanged — margin,
 * max-width, size and colour. The inner `<p>` inherits all of it.
 *
 * Not for: errors, loading/status lines, or a consequence warning in front of a
 * destructive action. Those must be read; this hides things.
 */
export default function Explainer({
  className,
  style,
  children,
}: {
  /** The class the bare `<p>` used to carry — `tasksub`, `hint`, `info-note`… */
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const textId = useId()

  // Measure only while collapsed: open, the text wraps and nothing overflows.
  // Re-measures on resize (the observer) and when the text changes (`children`
  // is a new element each render, so this re-runs per render — cheap, and
  // setState with an unchanged value bails out, so it cannot loop).
  useEffect(() => {
    const el = textRef.current
    if (!el || open) return
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, children])

  const showToggle = overflows || open

  return (
    <div
      className={["explainer", open ? "open" : "", className ?? ""].filter(Boolean).join(" ")}
      style={style}
    >
      <p className="explainer-text" id={textId} ref={textRef}>
        {children}
      </p>
      {showToggle ? (
        <button
          type="button"
          className="explainer-toggle"
          aria-expanded={open}
          aria-controls={textId}
          aria-label={open ? "Show less" : "Show more"}
          title={open ? "Show less" : "Show more"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
