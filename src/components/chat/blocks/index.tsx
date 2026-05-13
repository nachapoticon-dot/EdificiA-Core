"use client";

import type { BlockSpec, BlockKind } from "@/lib/validators/blocks";
import { MetricsBlock } from "./MetricsBlock";
import { MediaBlock } from "./MediaBlock";
import { ComparisonBlock } from "./ComparisonBlock";
import { TimelineBlock } from "./TimelineBlock";
import {
  MetricsSkeleton,
  MediaSkeleton,
  ComparisonSkeleton,
  TimelineSkeleton,
} from "./skeletons";

// ─────────────────────────────────────────────────────────────────────────────
// ResponseBlock — único punto de entrada para renderizar bloques en el chat.
// Si `loading=true`, dibuja el Skeleton correspondiente al `kind`.
// Si recibe `spec`, renderiza el bloque real.
// ─────────────────────────────────────────────────────────────────────────────
type Props =
  | { kind: BlockKind; loading: true; spec?: undefined; accentVar?: string }
  | { kind?: undefined; loading?: false; spec: BlockSpec; accentVar?: string };

export function ResponseBlock(props: Props) {
  if (props.loading) {
    switch (props.kind) {
      case "metrics":    return <MetricsSkeleton />;
      case "media":      return <MediaSkeleton />;
      case "comparison": return <ComparisonSkeleton />;
      case "timeline":   return <TimelineSkeleton />;
      default: return null;
    }
  }

  const { spec, accentVar } = props;
  switch (spec.kind) {
    case "metrics":    return <MetricsBlock    spec={spec} accentVar={accentVar} />;
    case "media":      return <MediaBlock      spec={spec} accentVar={accentVar} />;
    case "comparison": return <ComparisonBlock spec={spec} accentVar={accentVar} />;
    case "timeline":   return <TimelineBlock   spec={spec} accentVar={accentVar} />;
    default: return null;
  }
}

// Re-exports
export { MetricsBlock, MediaBlock, ComparisonBlock, TimelineBlock };
export { MetricsSkeleton, MediaSkeleton, ComparisonSkeleton, TimelineSkeleton };
export { BlockShell } from "./BlockShell";
