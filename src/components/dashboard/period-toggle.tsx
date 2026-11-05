"use client";

import { useState } from "react";

import { campaignPeriod } from "@/lib/campaign";
import { todayUtc, type Period } from "@/lib/period";
import { cn } from "@/lib/utils";

const PRESETS: { label: string; days: number }[] = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

// Backend caps an explicit range at 400 days.
const MAX_RANGE_DAYS = 400;

export function PeriodToggle({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const campaign = campaignPeriod();
  const isCustom = value.kind === "range" && !value.campaign;
  const [editing, setEditing] = useState(false);
  const showInputs = editing || isCustom;

  const [from, setFrom] = useState(value.kind === "range" ? value.from : "");
  const [to, setTo] = useState(value.kind === "range" ? value.to : todayUtc());
  const spanDays =
    from && to ? (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 + 1 : 0;
  const invalid = !from || !to || from > to || spanDays > MAX_RANGE_DAYS;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-0.5 border border-border bg-card p-0.5">
        {PRESETS.map((p) => (
          <Segment
            key={p.days}
            active={!showInputs && value.kind === "preset" && value.days === p.days}
            onClick={() => {
              setEditing(false);
              onChange({ kind: "preset", days: p.days });
            }}
          >
            {p.label}
          </Segment>
        ))}
        <Segment
          active={!showInputs && value.kind === "range" && !!value.campaign}
          disabled={campaign === null}
          title={
            campaign === null
              ? "Campaign dates not configured (NEXT_PUBLIC_CAMPAIGN_START)"
              : `${campaign.from} → ${campaign.to} (UTC)`
          }
          onClick={() => {
            if (!campaign) return;
            setEditing(false);
            onChange(campaign);
          }}
        >
          Campaign
        </Segment>
        <Segment active={showInputs} onClick={() => setEditing(true)}>
          Custom
        </Segment>
      </div>

      {showInputs && (
        <form
          className="inline-flex items-center gap-1 font-mono text-[11px]"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            setEditing(false);
            onChange({ kind: "range", from, to });
          }}
        >
          <DateInput label="From" value={from} max={to || todayUtc()} onChange={setFrom} />
          <span className="text-text-tertiary">→</span>
          <DateInput label="To" value={to} min={from} max={todayUtc()} onChange={setTo} />
          <button
            type="submit"
            disabled={invalid}
            title={spanDays > MAX_RANGE_DAYS ? `At most ${MAX_RANGE_DAYS} days` : undefined}
            className="h-7 border border-strong px-2 text-foreground transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  );
}

function Segment({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "px-2.5 py-1 font-mono text-[11px] leading-none transition-colors",
        active
          ? "bg-foreground text-primary-foreground"
          : "bg-transparent text-text-tertiary hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-tertiary",
      )}
    >
      {children}
    </button>
  );
}

function DateInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      aria-label={`${label} (UTC)`}
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 border border-border bg-card px-1.5 text-foreground [color-scheme:dark] outline-none hover:border-strong focus:border-strong"
    />
  );
}
