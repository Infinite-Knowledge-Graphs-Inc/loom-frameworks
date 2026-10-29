"use client"

import type { ReactNode, SVGProps } from "react"
import { DRAWING_GROUND } from "@/lib/svgExport"

/**
 * A linking word that still reads after the drawing leaves Loom.
 *
 * The cloth and the board used to knock the line out from behind a label
 * with one `<text>`: ink fill, a 4px stroke in the paper colour, and
 * `paint-order="stroke"` so the stroke sat behind the letters. A viewer
 * that ignores `paint-order` paints the stroke after the fill, and that
 * 4px stroke covers a 10px glyph completely — the word is in the file and
 * nothing shows. Rasterised from a serialized label (the same walk as
 * `serializeSvg`): with `paint-order` the word has ink; with it removed
 * the band is entirely this paper colour.
 *
 * Two copies. The lower one's fill and stroke are both the paper colour,
 * so the order between them does not matter. The upper one has no stroke,
 * so nothing can cover the letters. The lower copy is `aria-hidden` and
 * takes no hits; the upper one keeps the caller's pointer behaviour.
 */
type TextProps = Omit<SVGProps<SVGTextElement>, "fill" | "stroke" | "strokeWidth" | "x" | "children">

export default function HaloText({
  lines,
  x,
  fill,
  lineHeight = 11,
  ...rest
}: TextProps & {
  lines: string[]
  x: number
  fill: string
  /** Pixels between wrapped lines. A single line never uses it. */
  lineHeight?: number
}) {
  // Called twice on purpose. One set of `<tspan>` elements cannot sit in
  // two parents; each call builds its own.
  const content = (): ReactNode =>
    lines.map((ln, i) => (
      <tspan key={i} x={x} dy={i ? lineHeight : 0}>{ln}</tspan>
    ))
  return (
    <>
      <text
        {...rest}
        x={x}
        fill={DRAWING_GROUND}
        stroke={DRAWING_GROUND}
        strokeWidth={4}
        pointerEvents="none"
        aria-hidden="true"
      >
        {content()}
      </text>
      <text {...rest} x={x} fill={fill}>
        {content()}
      </text>
    </>
  )
}
