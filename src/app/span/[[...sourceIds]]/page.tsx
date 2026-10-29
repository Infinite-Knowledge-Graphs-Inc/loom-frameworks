import SpanStation from "@/components/span/SpanStation"
import { isBranchPreview } from "@/lib/previewLogin"

/** 05 · Span. The path is the scope — see SpanStation and `spanScopeKey`. */
export default function SpanPage() {
  return <SpanStation isPreviewDeployment={isBranchPreview()} />
}
