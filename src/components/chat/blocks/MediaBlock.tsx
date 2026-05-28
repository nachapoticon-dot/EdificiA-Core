"use client";

import { DraftingCompass, Image as ImageIcon, Camera, Calendar, MapPin, Maximize2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { MediaItem, MediaSpec } from "@/lib/validators/blocks";
import { BlockShell, MonoLabel } from "./BlockShell";

// ─────────────────────────────────────────────────────────────────────────────
// MediaBlock — legajo gráfico: planos, renders, inspecciones de obra.
// Layout: 1 hero (aspect 4/3) + 3 thumbs verticales (aspect 16/9).
// Si el item trae `thumbnailUrl` lo renderizamos con next/image; si no,
// caemos a un SVG schemático determinístico (PlanoArt / RenderArt / ObraArt).
// ─────────────────────────────────────────────────────────────────────────────

const KIND_META: Record<MediaItem["kind"], { label: string; icon: LucideIcon; color: string }> = {
  plano:  { label: "PLANO",      icon: DraftingCompass, color: "var(--cyan)" },
  render: { label: "RENDER",     icon: ImageIcon,       color: "var(--primary)" },
  obra:   { label: "INSPECCIÓN", icon: Camera,          color: "var(--green)" },
};

export function MediaBlock({
  spec,
  accentVar,
}: {
  spec: MediaSpec;
  accentVar?: string;
}) {
  const [hero, ...rest] = spec.items as [MediaItem, ...MediaItem[]];
  return (
    <BlockShell
      icon={DraftingCompass}
      fig="FIG. 03 · MEDIA"
      title={spec.title}
      meta={`${spec.items.length} adjuntos`}
      accentVar={accentVar}
      dense
      footer={
        <MonoLabel>
          legajo · <span className="text-foreground">{spec.obra}</span> · sync {spec.synced ?? "hace 4m"}
        </MonoLabel>
      }
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.35fr_1fr]">
        <MediaTile item={hero} hero />
        <div className="grid gap-2 sm:grid-rows-3">
          {rest.slice(0, 3).map((it, i) => (
            <MediaTile key={i} item={it} />
          ))}
        </div>
      </div>
      {rest.length > 3 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rest.slice(3).map((it, i) => (
            <MediaTile key={`${it.title}-${i}`} item={it} />
          ))}
        </div>
      )}
    </BlockShell>
  );
}

function MediaTile({ item, hero }: { item: MediaItem; hero?: boolean }) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[8px] border border-border bg-muted/30",
        "cursor-zoom-in transition-colors hover:border-border/80",
        hero && "row-span-3"
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          hero ? "aspect-[4/3]" : "aspect-video min-h-[64px]"
        )}
        style={{ color: meta.color }}
        data-kind={item.kind}
      >
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            sizes={hero ? "(max-width:640px) 100vw, 380px" : "200px"}
            className="object-cover"
            loading="lazy"
          />
        ) : item.kind === "plano" ? (
          <PlanoArt seed={item.seed ?? 1} />
        ) : item.kind === "render" ? (
          <RenderArt seed={item.seed ?? 1} />
        ) : (
          <ObraArt seed={item.seed ?? 1} />
        )}
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        />
      </div>
      <div className="flex flex-col gap-1 px-2.5 pb-2 pt-1.5">
        <span
          className="inline-flex w-fit items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em]"
          style={{
            color: meta.color,
            borderColor: meta.color,
            backgroundColor: `color-mix(in oklch, ${meta.color} 10%, transparent)`,
          }}
        >
          <Icon className="h-2.5 w-2.5" strokeWidth={1.5} /> {meta.label}
        </span>
        <div className={cn("leading-tight text-foreground", hero ? "text-[13px] font-semibold" : "text-[11.5px] font-medium")}>
          {item.title}
        </div>
        <div className="flex flex-wrap gap-2.5 font-mono text-[9.5px] text-muted-foreground">
          {item.date && (
            <span className="inline-flex items-center gap-1"><Calendar className="h-2.5 w-2.5" strokeWidth={1.5} /> {item.date}</span>
          )}
          {item.location && (
            <span className="inline-flex items-center gap-1"><MapPin className="h-2.5 w-2.5" strokeWidth={1.5} /> {item.location}</span>
          )}
          {item.ext && <span className="uppercase tracking-[0.06em]">{item.ext}</span>}
        </div>
      </div>
      <button
        type="button"
        title="Ampliar"
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-[6px] border border-border bg-background/85 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100"
      >
        <Maximize2 className="h-3 w-3" strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ── Schematic SVG placeholders ────────────────────────────────────────────────
function PlanoArt({ seed }: { seed: number }) {
  const off = seed * 6;
  return (
    <svg viewBox="0 0 240 160" className="block h-full w-full">
      <defs>
        <pattern id={`hatch${seed}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6L6 0" stroke="currentColor" strokeWidth=".4" opacity=".25" />
        </pattern>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".85">
        <rect x="14" y="14" width="212" height="132" rx="1" />
        <line x1="14" y1={64 + (off % 18)} x2="138" y2={64 + (off % 18)} />
        <line x1="138" y1={64 + (off % 18)} x2="138" y2="146" />
        <line x1="170" y1="14" x2="170" y2="92" />
        <line x1="170" y1="92" x2="226" y2="92" />
        <line x1="60" y1="14" x2="60" y2={64 + (off % 18)} />
      </g>
      <g stroke="currentColor" strokeWidth=".7" opacity=".4">
        <line x1="20" y1="20" x2="220" y2="20" strokeDasharray="2 2" />
        <line x1="20" y1="140" x2="220" y2="140" strokeDasharray="2 2" />
        <text x="120" y="10" fontSize="6" textAnchor="middle" fontFamily="ui-monospace,monospace">12.40m</text>
      </g>
      <rect x="14" y="14" width="212" height="132" fill={`url(#hatch${seed})`} />
    </svg>
  );
}

function RenderArt({ seed }: { seed: number }) {
  const hue = 30 + seed * 8;
  return (
    <svg viewBox="0 0 240 160" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sky${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`oklch(0.62 0.04 ${hue})`} />
          <stop offset="1" stopColor={`oklch(0.42 0.05 ${hue + 20})`} />
        </linearGradient>
      </defs>
      <rect width="240" height="160" fill={`url(#sky${seed})`} />
      <g opacity=".9">
        <rect x="30" y="60" width="56" height="92" fill="oklch(0.30 0.02 40)" />
        <rect x="92" y="38" width="60" height="114" fill="oklch(0.38 0.025 38)" />
        <rect x="160" y="74" width="56" height="78" fill="oklch(0.32 0.02 42)" />
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2].map((c) => (
            <rect
              key={`a${r}${c}`}
              x={36 + c * 16}
              y={66 + r * 18}
              width="10"
              height="10"
              fill="oklch(0.72 0.10 70)"
              opacity={(r + c + seed) % 2 ? 0.9 : 0.4}
            />
          ))
        )}
      </g>
      <rect x="0" y="148" width="240" height="12" fill="oklch(0.2 0.01 30)" />
    </svg>
  );
}

function ObraArt({ seed }: { seed: number }) {
  return (
    <svg viewBox="0 0 240 160" className="block h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="240" height="160" fill="oklch(0.32 0.02 70)" />
      <rect width="240" height="80" fill="oklch(0.48 0.03 220)" />
      <g stroke="oklch(0.78 0.14 70)" strokeWidth="1.5" fill="none">
        <line x1={40 + seed * 3} y1="20" x2={40 + seed * 3} y2="120" />
        <line x1={40 + seed * 3} y1="30" x2="180" y2="30" />
        <line x1="120" y1="30" x2="120" y2="62" />
        <rect x="113" y="62" width="14" height="10" fill="oklch(0.78 0.14 70)" />
      </g>
      <g stroke="oklch(0.55 0.03 50)" strokeWidth="1" fill="oklch(0.42 0.02 50)" opacity=".95">
        <rect x="60" y="70" width="160" height="80" />
        {[0, 1, 2].map((r) => (
          <line key={r} x1="60" y1={90 + r * 20} x2="220" y2={90 + r * 20} />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
          <line key={c} x1={60 + c * 20} y1="70" x2={60 + c * 20} y2="150" />
        ))}
      </g>
      <path d="M0 150 L240 145 L240 160 L0 160 Z" fill="oklch(0.30 0.04 55)" />
    </svg>
  );
}
