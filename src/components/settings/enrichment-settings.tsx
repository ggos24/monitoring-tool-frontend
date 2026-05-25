"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  EnrichmentSettings,
  EnrichmentSettingsPatch,
} from "@/lib/types";

const STANCE_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
const SUMMARY_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

const SCORE_HELP: Record<number, string> = {
  0: "all sources (incl. propaganda)",
  1: "untrusted+",
  2: "suspect+",
  3: "trusted_low+ (default)",
  4: "trusted_mid+",
  5: "trusted_top only",
};

export function EnrichmentSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["enrichment-settings"],
    queryFn: apiClient.enrichmentSettings,
  });

  // Local working copy + last-saved baseline.
  const [origin, setOrigin] = useState<EnrichmentSettings | null>(null);
  const [draft, setDraft] = useState<EnrichmentSettings | null>(null);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    if (data) {
      setOrigin(data);
      setDraft(data);
    }
  }, [data]);

  useEffect(() => {
    if (status.kind !== "saved") return;
    const t = setTimeout(() => setStatus({ kind: "idle" }), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const patch = useMemo<EnrichmentSettingsPatch>(() => {
    if (!origin || !draft) return {};
    return diffPatch(origin, draft);
  }, [origin, draft]);

  const dirty = Object.keys(patch).length > 0;

  const saveMutation = useMutation({
    mutationFn: (p: EnrichmentSettingsPatch) =>
      apiClient.updateEnrichmentSettings(p),
    onSuccess: (next) => {
      setOrigin(next);
      setDraft(next);
      queryClient.invalidateQueries({ queryKey: ["enrichment-settings"] });
      setStatus({ kind: "saved" });
    },
    onError: (err) => {
      const message =
        err instanceof ApiError ? err.message : "Save failed — try again.";
      setStatus({ kind: "error", message });
    },
  });

  function handleSave() {
    if (!dirty) return;
    setStatus({ kind: "idle" });
    saveMutation.mutate(patch);
  }

  function handleReset() {
    if (!origin) return;
    setDraft(origin);
    setStatus({ kind: "idle" });
  }

  return (
    <section className="bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <KickerLabel>Enrichment pipeline</KickerLabel>
          <p className="mt-1 text-xs text-text-tertiary">
            Runtime config for nightly stance classification and per-segment
            digests.
          </p>
        </div>
        {origin && (
          <span className="font-mono text-[10px] text-muted-foreground">
            updated {formatUpdated(origin.updated_at)} · {origin.updated_by}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 border border-border bg-elevated/30 px-3 py-2 text-xs leading-relaxed text-text-tertiary">
        <Info className="mt-0.5 size-3.5 shrink-0 text-sky-400" aria-hidden />
        <span>
          All changes take effect on the next cron tick — no redeploy needed.
        </span>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-20 w-full bg-elevated" />
          <Skeleton className="h-20 w-full bg-elevated" />
        </div>
      ) : error || !draft ? (
        <div className="mt-4 flex items-center gap-3 font-mono text-[11px] text-text-tertiary">
          <span>Failed to load enrichment settings.</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="cursor-pointer border border-border bg-elevated px-2 py-0.5 text-text-secondary hover:border-strong hover:text-foreground"
          >
            retry
          </button>
        </div>
      ) : (
        <>
          {/* Phase 2 — per-article stance */}
          <SubSection title="Phase 2 — per-article stance">
            <ToggleField
              label="Enable nightly stance pipeline"
              help="Master kill switch. When off, the 22:00/07:00 UTC cron does nothing."
              checked={draft.stance_enabled}
              onChange={(v) => setDraft({ ...draft, stance_enabled: v })}
            />
            <ToggleField
              label="Dry run only"
              help="When on, scheduler logs what it would submit but never calls Gemini. Use to validate gates before paying for tokens."
              checked={draft.stance_dry_run}
              onChange={(v) => setDraft({ ...draft, stance_dry_run: v })}
            />

            <SelectField
              label="Minimum source score"
              help={`${SCORE_HELP[draft.min_source_score] ?? "—"} (0–5)`}
              value={String(draft.min_source_score)}
              options={[0, 1, 2, 3, 4, 5].map((n) => ({
                value: String(n),
                label: `${n} · ${SCORE_HELP[n]}`,
              }))}
              onChange={(v) =>
                setDraft({ ...draft, min_source_score: Number(v) })
              }
            />

            <NumberField
              label="Look-back window (hours)"
              help="How far back to scan unprocessed mentions. 1–720."
              value={draft.published_window_hours}
              min={1}
              max={720}
              onChange={(v) =>
                setDraft({ ...draft, published_window_hours: v })
              }
            />

            <SelectField
              label="Stance model"
              help="Gemini model used for per-article stance/framing. flash-lite is ~3× cheaper than flash."
              value={draft.stance_model}
              options={STANCE_MODELS.map((m) => ({ value: m, label: m }))}
              onChange={(v) => setDraft({ ...draft, stance_model: v })}
            />

            <TimeField
              label="Submit time (UTC)"
              help="When the nightly batch is submitted to Gemini."
              hour={draft.stance_submit_hour}
              minute={draft.stance_submit_minute}
              onChange={(h, m) =>
                setDraft({
                  ...draft,
                  stance_submit_hour: h,
                  stance_submit_minute: m,
                })
              }
            />
            <TimeField
              label="Retrieve time (UTC)"
              help="When the batch is polled and results persisted. Should be after submit + a few hours."
              hour={draft.stance_retrieve_hour}
              minute={draft.stance_retrieve_minute}
              onChange={(h, m) =>
                setDraft({
                  ...draft,
                  stance_retrieve_hour: h,
                  stance_retrieve_minute: m,
                })
              }
            />
          </SubSection>

          {/* Phase 3 — per-segment digest */}
          <SubSection title="Phase 3 — per-segment digest">
            <ToggleField
              label="Enable nightly digest pipeline"
              help="Master kill switch for per-segment narrative summaries."
              checked={draft.digest_enabled}
              onChange={(v) => setDraft({ ...draft, digest_enabled: v })}
            />
            <ToggleField
              label="Dry run only"
              help="Logs the work-plan but skips the LLM call."
              checked={draft.digest_dry_run}
              onChange={(v) => setDraft({ ...draft, digest_dry_run: v })}
            />

            <SelectField
              label="Summary model"
              help="Gemini model used for aggregate narrative."
              value={draft.summary_model}
              options={SUMMARY_MODELS.map((m) => ({ value: m, label: m }))}
              onChange={(v) => setDraft({ ...draft, summary_model: v })}
            />

            <TimeField
              label="Submit time (UTC)"
              hour={draft.digest_submit_hour}
              minute={draft.digest_submit_minute}
              onChange={(h, m) =>
                setDraft({
                  ...draft,
                  digest_submit_hour: h,
                  digest_submit_minute: m,
                })
              }
            />
            <TimeField
              label="Retrieve time (UTC)"
              hour={draft.digest_retrieve_hour}
              minute={draft.digest_retrieve_minute}
              onChange={(h, m) =>
                setDraft({
                  ...draft,
                  digest_retrieve_hour: h,
                  digest_retrieve_minute: m,
                })
              }
            />
          </SubSection>

          <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="font-mono text-[11px]">
              {status.kind === "saved" && (
                <span className="text-emerald-400">Saved ✓</span>
              )}
              {status.kind === "error" && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="size-3" /> {status.message}
                </span>
              )}
              {status.kind === "idle" && dirty && (
                <span className="text-amber-500">
                  {Object.keys(patch).length} unsaved change
                  {Object.keys(patch).length === 1 ? "" : "s"}
                </span>
              )}
              {status.kind === "idle" && !dirty && (
                <span className="text-muted-foreground">No changes</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={!dirty || saveMutation.isPending}
                className={cn(
                  "border px-3 py-1 font-mono text-[11px] transition-colors",
                  !dirty || saveMutation.isPending
                    ? "cursor-not-allowed border-border bg-card text-text-tertiary"
                    : "cursor-pointer border-border bg-card text-text-tertiary hover:border-strong hover:text-foreground",
                )}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saveMutation.isPending}
                className={cn(
                  "border px-3 py-1 font-mono text-[11px] transition-colors",
                  !dirty || saveMutation.isPending
                    ? "cursor-not-allowed border-border bg-card text-text-tertiary"
                    : "cursor-pointer border-strong bg-foreground text-primary-foreground hover:bg-text-secondary",
                )}
              >
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

function diffPatch(
  origin: EnrichmentSettings,
  draft: EnrichmentSettings,
): EnrichmentSettingsPatch {
  const patch: EnrichmentSettingsPatch = {};
  (Object.keys(draft) as (keyof EnrichmentSettings)[]).forEach((key) => {
    if (key === "updated_at" || key === "updated_by") return;
    if (origin[key] !== draft[key]) {
      // narrow assignment — TS can't infer the union match across keys
      (patch as Record<string, unknown>)[key] = draft[key];
    }
  });
  return patch;
}

function formatUpdated(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return iso;
  }
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <KickerLabel className="text-text-tertiary">{title}</KickerLabel>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

function ToggleField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border border-border bg-card px-3 py-2">
      <div className="min-w-0">
        <div className="text-[12px] text-foreground">{label}</div>
        {help && (
          <div className="mt-0.5 font-mono text-[10px] leading-snug text-muted-foreground">
            {help}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={cn(
          "mt-0.5 shrink-0 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
          checked
            ? "border-emerald-900 bg-emerald-950 text-emerald-400 hover:border-emerald-800"
            : "border-border bg-elevated text-text-tertiary hover:border-strong hover:text-text-secondary",
        )}
      >
        {checked ? "On" : "Off"}
      </button>
    </div>
  );
}

function SelectField({
  label,
  help,
  value,
  options,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block border border-border bg-card px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-1 h-8 w-full border border-border bg-card px-2",
          "font-mono text-[11px] text-foreground",
          "outline-none transition-colors hover:border-strong focus:border-strong",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card">
            {o.label}
          </option>
        ))}
      </select>
      {help && (
        <span className="mt-1 block font-mono text-[10px] leading-snug text-muted-foreground">
          {help}
        </span>
      )}
    </label>
  );
}

function NumberField({
  label,
  help,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block border border-border bg-card px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className={cn(
          "mt-1 h-8 w-full border border-border bg-card px-2",
          "font-mono text-[11px] tabular-nums text-foreground",
          "outline-none transition-colors hover:border-strong focus:border-strong",
        )}
      />
      {help && (
        <span className="mt-1 block font-mono text-[10px] leading-snug text-muted-foreground">
          {help}
        </span>
      )}
    </label>
  );
}

function TimeField({
  label,
  help,
  hour,
  minute,
  onChange,
}: {
  label: string;
  help?: string;
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
}) {
  // Native <input type="time"> emits "HH:MM" — bidirectional friendly.
  const value = `${pad2(hour)}:${pad2(minute)}`;
  return (
    <label className="block border border-border bg-card px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
        {label}
      </span>
      <input
        type="time"
        value={value}
        step={60}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map(Number);
          if (
            Number.isFinite(h) &&
            Number.isFinite(m) &&
            h >= 0 &&
            h <= 23 &&
            m >= 0 &&
            m <= 59
          ) {
            onChange(h, m);
          }
        }}
        className={cn(
          "mt-1 h-8 w-full border border-border bg-card px-2",
          "font-mono text-[11px] tabular-nums text-foreground",
          "outline-none transition-colors hover:border-strong focus:border-strong",
          "[color-scheme:dark]",
        )}
      />
      {help && (
        <span className="mt-1 block font-mono text-[10px] leading-snug text-muted-foreground">
          {help}
        </span>
      )}
    </label>
  );
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
