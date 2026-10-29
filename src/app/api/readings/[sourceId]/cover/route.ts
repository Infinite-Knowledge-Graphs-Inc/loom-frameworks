import { NextResponse } from "next/server"
import { getSourceForCover } from "@/actions/sources"
import { readingStorage } from "@/lib/storage"
import { getSourceCoverKey, renderPdfCoverImage } from "@/lib/pdfCover"
import { logWarn } from "@/lib/log"

const MIN_COVER_BYTES = 2048

function renderCoverFallbackSvg(title: string) {
  const safeTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="600" viewBox="0 0 420 600" role="img" aria-label="${safeTitle}">
      <defs>
        <linearGradient id="loom-cover-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f3f4f6" />
          <stop offset="100%" stop-color="#e6e8ec" />
        </linearGradient>
      </defs>
      <rect width="420" height="600" fill="url(#loom-cover-bg)" />
      <rect x="28" y="28" width="364" height="544" fill="none" stroke="#c0c4cc" stroke-width="2" />
      <text x="42" y="88" fill="#8c5a12" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600">Loom library</text>
      <foreignObject x="42" y="126" width="336" height="360">
        <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;height:100%;align-items:flex-start;color:#16181d;font-family:ui-sans-serif, system-ui, sans-serif;font-size:32px;line-height:1.2;font-weight:600;">
          <div>${safeTitle}</div>
        </div>
      </foreignObject>
      <text x="42" y="548" fill="#525868" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14">Preview unavailable</text>
    </svg>
  `
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params

  try {
    // Authorization only — the cached cover is a few tens of KB, and fetching
    // the whole PDF up front made every cover request download the reading
    // (the library page fires one of these per card). The passages are fetched
    // below, only when a re-render is actually needed.
    const { source } = await getSourceForCover(sourceId)
    const coverKey = getSourceCoverKey(source.id)

    try {
      const coverBuffer = await readingStorage.get(coverKey)
      if (coverBuffer.length < MIN_COVER_BYTES) {
        throw new Error("Cached cover image is too small to be usable")
      }
      return new NextResponse(new Uint8Array(coverBuffer), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=3600",
        },
      })
    } catch {
      try {
        const buffer = await readingStorage.get(source.storageKey!)
        const coverBuffer = await renderPdfCoverImage(buffer)

        try {
          await readingStorage.put(coverKey, coverBuffer)
        } catch (error) {
          logWarn("cover.persist-failed", { cause: error })
        }

        return new NextResponse(new Uint8Array(coverBuffer), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=3600",
          },
        })
      } catch (error) {
        logWarn("cover.render-failed", { cause: error })
        return new NextResponse(renderCoverFallbackSvg(source.title), {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            // Never cache the fallback: it's only served on a transient render
            // failure, so caching it would pin "preview unavailable" in the
            // browser even after a real cover becomes available.
            "Cache-Control": "no-store",
          },
        })
      }
    }
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
}