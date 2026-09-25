import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { DOT_COLORS, PRESETS } from "../presets";
import type {
  DitherMode,
  FitMode,
  ProcessSettings,
  ResolutionKey,
  ViewMode,
} from "../types";
import { IconChevron, IconInvert } from "./Icons";

interface ControlsProps {
  settings: ProcessSettings;
  onChange: (next: ProcessSettings) => void;
  activePreset: string | null;
  onPreset: (id: string) => void;
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  fit: FitMode;
  onFit: (f: FitMode) => void;
  mirror: boolean;
  onMirror: (v: boolean) => void;
  showFps: boolean;
  onShowFps: (v: boolean) => void;
  showPip: boolean;
  onShowPip: (v: boolean) => void;
  onReset: () => void;
}

function fillPct(value: number, min: number, max: number): string {
  return `${((value - min) / (max - min)) * 100}%`;
}

function SliderRow({
  label,
  tooltip,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  tooltip?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500" title={tooltip}>
          {label}
        </span>
        <span className="font-mono text-[10px] text-neutral-300">
          {format ? format(value) : value.toFixed(step < 1 ? 2 : 0)}
        </span>
      </span>
      <input
        className="dv-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--dv-fill" as string]: fillPct(value, min, max) }}
        aria-label={label}
      />
    </label>
  );
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/6">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
          {title}
        </span>
        <IconChevron
          size={14}
          className={cn("text-neutral-500 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </div>
  );
}

const DITHERS: { id: DitherMode; label: string }[] = [
  { id: "halftone", label: "Halftone" },
  { id: "ordered", label: "Ordered" },
  { id: "floyd", label: "Floyd" },
  { id: "threshold", label: "Threshold" },
  { id: "stipple", label: "Stipple" },
];

const RESOLUTIONS: { id: ResolutionKey; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Med" },
  { id: "high", label: "High" },
  { id: "ultra", label: "Ultra" },
];

export function ControlsPanel(props: ControlsProps) {
  const s = props.settings;
  const patch = (partial: Partial<ProcessSettings>) =>
    props.onChange({ ...s, ...partial });

  const presetMatch = useMemo(() => {
    if (!props.activePreset) return null;
    return PRESETS.find((p) => p.id === props.activePreset)?.id ?? null;
  }, [props.activePreset]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="dv-scroll min-h-0 flex-1 overflow-y-auto">
        <Section title="Presets" defaultOpen>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => {
              const on = presetMatch === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={p.hint}
                  onClick={() => props.onPreset(p.id)}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left transition",
                    on
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/8 bg-white/[0.03] text-neutral-300 hover:border-white/16 hover:bg-white/[0.06]",
                  )}
                >
                  <div className="text-[11px] font-semibold leading-none">{p.name}</div>
                  <div className="mt-1 text-[10px] leading-tight text-neutral-500">{p.hint}</div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Dots" defaultOpen>
          <SliderRow
            label="Dot Size"
            tooltip="Global scale of every dot"
            value={s.dotSize}
            min={0.3}
            max={2.4}
            step={0.05}
            onChange={(v) => patch({ dotSize: v })}
          />
          <SliderRow
            label="Dot Spacing"
            tooltip="Distance between sample points"
            value={s.dotSpacing}
            min={2}
            max={16}
            step={0.5}
            onChange={(v) => patch({ dotSpacing: v })}
          />
          <SliderRow
            label="Dot Density"
            tooltip="How readily midtones produce dots"
            value={s.dotDensity}
            min={0.35}
            max={2.4}
            step={0.05}
            onChange={(v) => patch({ dotDensity: v })}
          />
          <SliderRow
            label="Dot Sharpness"
            tooltip="Hard vs soft size mapping"
            value={s.dotSharpness}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => patch({ dotSharpness: v })}
          />
          <SliderRow
            label="Minimum Dot Size"
            tooltip="Floor radius in dark areas"
            value={s.minDotSize}
            min={0}
            max={1.2}
            step={0.05}
            onChange={(v) => patch({ minDotSize: v })}
          />
          <SliderRow
            label="Maximum Dot Size"
            tooltip="Peak radius relative to spacing"
            value={s.maxDotSize}
            min={0.35}
            max={1.8}
            step={0.05}
            onChange={(v) => patch({ maxDotSize: v })}
          />
        </Section>

        <Section title="Image" defaultOpen>
          <SliderRow
            label="Brightness"
            value={s.brightness}
            min={-0.5}
            max={0.5}
            step={0.01}
            onChange={(v) => patch({ brightness: v })}
            format={(v) => v.toFixed(2)}
          />
          <SliderRow
            label="Contrast"
            value={s.contrast}
            min={0.5}
            max={2.4}
            step={0.02}
            onChange={(v) => patch({ contrast: v })}
          />
          <SliderRow
            label="Exposure"
            value={s.exposure}
            min={0.4}
            max={2.4}
            step={0.02}
            onChange={(v) => patch({ exposure: v })}
          />
          <SliderRow
            label="Threshold"
            tooltip="Black point — kills sensor noise below this luminance"
            value={s.threshold}
            min={0}
            max={0.55}
            step={0.005}
            onChange={(v) => patch({ threshold: v })}
            format={(v) => v.toFixed(3)}
          />
          <SliderRow
            label="Gamma"
            value={s.gamma}
            min={0.4}
            max={2.2}
            step={0.02}
            onChange={(v) => patch({ gamma: v })}
          />
          <button
            type="button"
            onClick={() => patch({ invert: !s.invert })}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition",
              s.invert
                ? "border-white/25 bg-white/10 text-white"
                : "border-white/8 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.06]",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <IconInvert size={14} />
              Invert
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              {s.invert ? "On" : "Off"}
            </span>
          </button>
        </Section>

        <Section title="Processing" defaultOpen={false}>
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Resolution
            </div>
            <div className="grid grid-cols-4 gap-1">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => patch({ resolution: r.id })}
                  className={cn(
                    "rounded-md border py-1.5 text-[10px] font-semibold uppercase tracking-wider transition",
                    s.resolution === r.id
                      ? "border-white/30 bg-white text-black"
                      : "border-white/8 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Dithering Mode
            </div>
            <div className="grid grid-cols-2 gap-1">
              {DITHERS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => patch({ ditherMode: d.id })}
                  className={cn(
                    "rounded-md border py-1.5 text-[10px] font-semibold uppercase tracking-wider transition",
                    s.ditherMode === d.id
                      ? "border-white/30 bg-white text-black"
                      : "border-white/8 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <SliderRow
            label="Smoothing"
            tooltip="Spatial blur plus temporal stability on live video"
            value={s.smoothing}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => patch({ smoothing: v })}
          />
          <SliderRow
            label="Edge Enhancement"
            tooltip="Boosts contours so silhouettes stay readable"
            value={s.edgeEnhance}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => patch({ edgeEnhance: v })}
          />
        </Section>

        <Section title="Color" defaultOpen={false}>
          <div className="flex flex-wrap items-center gap-1.5">
            {DOT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                aria-label={c.name}
                onClick={() => patch({ dotColor: c.value })}
                className={cn(
                  "h-7 w-7 rounded-full border transition",
                  s.dotColor.toLowerCase() === c.value
                    ? "border-white scale-110"
                    : "border-white/15 hover:border-white/40",
                )}
                style={{ background: c.value }}
              />
            ))}
            <input
              className="dv-color"
              type="color"
              value={s.dotColor}
              onChange={(e) => patch({ dotColor: e.target.value })}
              aria-label="Custom dot color"
              title="Custom color"
            />
          </div>
          <p className="text-[10px] leading-relaxed text-neutral-500">
            Default is white on black. Accent colors tint the dots only — the background stays pure black.
          </p>
        </Section>

        <Section title="Display" defaultOpen>
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              View
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ["processed", "Dotted"],
                  ["original", "Original"],
                  ["split", "Split"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => props.onViewMode(id)}
                  className={cn(
                    "rounded-md border py-1.5 text-[10px] font-semibold uppercase tracking-wider transition",
                    props.viewMode === id
                      ? "border-white/30 bg-white text-black"
                      : "border-white/8 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Fit
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(["contain", "cover"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => props.onFit(f)}
                  className={cn(
                    "rounded-md border py-1.5 text-[10px] font-semibold uppercase tracking-wider transition",
                    props.fit === f
                      ? "border-white/30 bg-white text-black"
                      : "border-white/8 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ToggleRow label="Mirror Camera" on={props.mirror} onChange={props.onMirror} />
          <ToggleRow label="Original Preview" on={props.showPip} onChange={props.onShowPip} />
          <ToggleRow label="Performance HUD" on={props.showFps} onChange={props.onShowFps} />
          <button
            type="button"
            onClick={props.onReset}
            className="w-full rounded-lg border border-white/10 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
          >
            Reset Settings
          </button>
        </Section>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between py-0.5 text-left"
    >
      <span className="text-[11px] text-neutral-300">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition",
          on ? "bg-white" : "bg-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition",
            on ? "left-4.5 bg-black" : "left-0.5 bg-white",
          )}
          style={{ left: on ? 18 : 2 }}
        />
      </span>
    </button>
  );
}
