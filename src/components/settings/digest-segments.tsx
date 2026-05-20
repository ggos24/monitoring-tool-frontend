"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { ALL_ISO2, countryName, iso2ToFlagEmoji } from "@/lib/country";
import { cn } from "@/lib/utils";
import { KickerLabel } from "@/components/ui/kicker-label";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DigestDefinition,
  DigestDefinitionCreate,
  FramingLabel,
  SegmentCondition,
  SegmentField,
  SegmentOp,
  SegmentValue,
  StanceLabel,
  Topic,
} from "@/lib/types";
import { FRAMING_LABELS, SEGMENT_FIELDS, SEGMENT_OPS } from "@/lib/types";

const STANCE_LABELS: StanceLabel[] = [
  "supportive",
  "critical",
  "neutral",
  "mixed",
];

// Per-field operator whitelist — keeps the form aligned with what the
// backend will actually accept and saves the operator a 422 round-trip.
const OPS_BY_FIELD: Record<SegmentField, SegmentOp[]> = {
  topic_id: ["=", "!="],
  country: ["=", "!=", "in"],
  source_id: ["=", "!="],
  source_score: ["=", "!=", ">=", "<="],
  is_propaganda: ["=", "!="],
  language: ["=", "!=", "in"],
  stance_label: ["=", "!=", "in"],
  framing_label: ["=", "!=", "in"],
};

const FIELD_LABEL: Record<SegmentField, string> = {
  topic_id: "topic_id",
  country: "country",
  source_id: "source_id",
  source_score: "source_score",
  is_propaganda: "is_propaganda",
  language: "language",
  stance_label: "stance_label",
  framing_label: "framing_label",
};

const FIELD_HELP: Record<SegmentField, string> = {
  topic_id: "Mention.topic_id (int)",
  country: "ISO-2 alpha (e.g. DE)",
  source_id: "Source row id (int)",
  source_score: "0–5",
  is_propaganda: "true / false",
  language: "Language code (en, uk, …)",
  stance_label: "supportive | critical | neutral | mixed",
  framing_label: "pro-ukraine | pro-russia | …",
};

export function DigestSegments() {
  const queryClient = useQueryClient();

  const topicsQuery = useQuery({
    queryKey: ["topics"],
    queryFn: apiClient.topics,
  });

  const definitionsQuery = useQuery({
    queryKey: ["digest-definitions"],
    queryFn: () => apiClient.digestDefinitions(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topics = topicsQuery.data ?? [];
  const definitions = definitionsQuery.data ?? [];

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiClient.updateDigestDefinition(id, { active }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["digest-definitions"] }),
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Update failed.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteDigestDefinition(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["digest-definitions"] }),
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    },
  });

  function handleDelete(def: DigestDefinition) {
    const ok = window.confirm(
      `Delete segment "${def.name}"? Existing digest_result rows are removed (CASCADE).`,
    );
    if (!ok) return;
    setError(null);
    deleteMutation.mutate(def.id);
  }

  return (
    <section className="bg-zinc-950 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <KickerLabel>Digest segments</KickerLabel>
          <p className="mt-1 text-xs text-zinc-500">
            Saved filters that aggregate enriched mentions into nightly
            narrative summaries. One row per report.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setError(null);
          }}
          disabled={topics.length === 0}
          className={cn(
            "flex items-center gap-1 border px-3 py-1 font-mono text-[11px] transition-colors",
            topics.length === 0
              ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-700"
              : "cursor-pointer border-zinc-700 bg-zinc-50 text-black hover:bg-zinc-200",
          )}
        >
          <Plus className="size-3" /> New segment
        </button>
      </div>

      {error && (
        <div className="mt-3 border border-red-900 bg-red-950/40 px-3 py-2 font-mono text-[11px] text-red-300">
          {error}
        </div>
      )}

      {showCreate && (
        <SegmentCreateForm
          topics={topics}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["digest-definitions"] });
          }}
          onError={setError}
        />
      )}

      <div className="mt-4">
        {definitionsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full bg-zinc-900" />
            ))}
          </div>
        ) : definitionsQuery.error ? (
          <div className="font-mono text-[11px] text-zinc-400">
            Failed to load segments.{" "}
            <button
              type="button"
              onClick={() => definitionsQuery.refetch()}
              className="cursor-pointer text-zinc-200 underline-offset-2 hover:underline"
            >
              retry
            </button>
          </div>
        ) : definitions.length === 0 ? (
          <div className="font-mono text-[11px] text-zinc-500">
            No segments configured yet. Use &ldquo;+ New segment&rdquo; to
            create one.
          </div>
        ) : (
          <ul>
            {definitions.map((def) => (
              <li
                key={def.id}
                className="flex items-start justify-between gap-3 border-b border-zinc-800 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 shrink-0",
                        def.active ? "bg-emerald-400" : "bg-zinc-700",
                      )}
                    />
                    <span className="text-sm text-zinc-50">{def.name}</span>
                    <span className="font-mono text-[10px] text-zinc-600">
                      #{def.id} · {topicName(def.topic_id, topics)} ·{" "}
                      {def.period_kind}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-3">
                    {def.segment.length === 0 ? (
                      <span className="font-mono text-[10px] text-zinc-600">
                        (no conditions)
                      </span>
                    ) : (
                      def.segment.map((c, i) => (
                        <ConditionChip key={i} condition={c} />
                      ))
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      toggleActiveMutation.mutate({
                        id: def.id,
                        active: !def.active,
                      })
                    }
                    disabled={toggleActiveMutation.isPending}
                    className={cn(
                      "border px-2 py-1 font-mono text-[11px] transition-colors",
                      def.active
                        ? "border-emerald-900 bg-emerald-950 text-emerald-400 hover:border-emerald-800"
                        : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
                    )}
                  >
                    {def.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(def)}
                    disabled={deleteMutation.isPending}
                    title="Delete segment"
                    className="cursor-pointer border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-500 hover:border-red-900 hover:text-red-400"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function topicName(id: number, topics: Topic[]): string {
  return topics.find((t) => t.id === id)?.name ?? `topic ${id}`;
}

function ConditionChip({ condition }: { condition: SegmentCondition }) {
  const valueRepr = formatValue(condition.field, condition.value);
  return (
    <span className="border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
      {condition.field} {condition.op} {valueRepr}
    </span>
  );
}

function formatValue(field: SegmentField, value: SegmentValue): string {
  if (Array.isArray(value)) {
    const inner = value.map((v) => formatScalar(field, v)).join(", ");
    return `[${inner}]`;
  }
  return formatScalar(field, value);
}

function formatScalar(
  field: SegmentField,
  v: string | number | boolean,
): string {
  if (field === "country" && typeof v === "string") {
    const flag = iso2ToFlagEmoji(v);
    return flag ? `${flag} ${v}` : v;
  }
  return String(v);
}

function SegmentCreateForm({
  topics,
  onClose,
  onSaved,
  onError,
}: {
  topics: Topic[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [topicId, setTopicId] = useState<number>(topics[0]?.id ?? 0);
  const [active, setActive] = useState(true);
  const [conditions, setConditions] = useState<SegmentCondition[]>([
    { field: "country", op: "=", value: "DE" },
  ]);

  const createMutation = useMutation({
    mutationFn: (body: DigestDefinitionCreate) =>
      apiClient.createDigestDefinition(body),
    onSuccess: onSaved,
    onError: (err) => {
      onError(err instanceof ApiError ? err.message : "Create failed.");
    },
  });

  function updateCondition(
    index: number,
    patch: Partial<SegmentCondition>,
  ): void {
    setConditions((conds) =>
      conds.map((c, i) => {
        if (i !== index) return c;
        // When the field changes, reset op + value to safe defaults
        // for the new field so we never send an invalid combination.
        if (patch.field && patch.field !== c.field) {
          const nextField = patch.field;
          return {
            field: nextField,
            op: defaultOp(nextField),
            value: defaultValue(nextField),
          };
        }
        return { ...c, ...patch } as SegmentCondition;
      }),
    );
  }

  function removeCondition(index: number) {
    setConditions((conds) => conds.filter((_, i) => i !== index));
  }

  function addCondition() {
    setConditions((conds) => [
      ...conds,
      { field: "source_score", op: ">=", value: 2 },
    ]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    const trimmed = name.trim();
    if (!trimmed) {
      onError("Name is required.");
      return;
    }
    if (conditions.length === 0) {
      onError("At least one condition is required.");
      return;
    }
    if (!topicId) {
      onError("Topic is required.");
      return;
    }
    createMutation.mutate({
      name: trimmed,
      topic_id: topicId,
      segment: conditions,
      active,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 border border-zinc-800 bg-zinc-950 p-4"
    >
      <div className="flex items-baseline justify-between">
        <KickerLabel className="text-zinc-500">New segment</KickerLabel>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer p-1 text-zinc-600 hover:text-zinc-300"
          aria-label="Close"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder='e.g. "Polish coverage"'
            className={cn(
              "mt-1 h-8 w-full border border-zinc-800 bg-zinc-950 px-2",
              "font-mono text-[11px] text-zinc-50 placeholder:text-zinc-700",
              "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
            )}
          />
        </label>

        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            Topic
          </span>
          <select
            value={topicId}
            onChange={(e) => setTopicId(Number(e.target.value))}
            className={cn(
              "mt-1 h-8 w-full border border-zinc-800 bg-zinc-950 px-2",
              "font-mono text-[11px] text-zinc-50",
              "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
            )}
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id} className="bg-zinc-950">
                {t.name} (#{t.id})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-500">
            Conditions · joined with AND
          </span>
          <button
            type="button"
            onClick={addCondition}
            className="cursor-pointer border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-50"
          >
            + Add condition
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {conditions.map((c, i) => (
            <ConditionRow
              key={i}
              condition={c}
              canRemove={conditions.length > 1}
              onChange={(patch) => updateCondition(i, patch)}
              onRemove={() => removeCondition(i)}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 font-mono text-[11px] text-zinc-300">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="size-3 accent-emerald-500"
          />
          Active immediately
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-[11px] text-zinc-400 hover:border-zinc-700 hover:text-zinc-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className={cn(
              "border px-3 py-1 font-mono text-[11px] transition-colors",
              createMutation.isPending
                ? "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-700"
                : "cursor-pointer border-zinc-700 bg-zinc-50 text-black hover:bg-zinc-200",
            )}
          >
            {createMutation.isPending ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </form>
  );
}

function ConditionRow({
  condition,
  canRemove,
  onChange,
  onRemove,
}: {
  condition: SegmentCondition;
  canRemove: boolean;
  onChange: (patch: Partial<SegmentCondition>) => void;
  onRemove: () => void;
}) {
  const ops = OPS_BY_FIELD[condition.field];
  return (
    <div className="grid grid-cols-[1fr_auto_2fr_auto] items-center gap-2">
      <select
        value={condition.field}
        onChange={(e) =>
          onChange({ field: e.target.value as SegmentField })
        }
        className={cn(
          "h-8 border border-zinc-800 bg-zinc-950 px-2",
          "font-mono text-[11px] text-zinc-50",
          "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
        )}
        title={FIELD_HELP[condition.field]}
      >
        {SEGMENT_FIELDS.map((f) => (
          <option key={f} value={f} className="bg-zinc-950">
            {FIELD_LABEL[f]}
          </option>
        ))}
      </select>

      <select
        value={condition.op}
        onChange={(e) => {
          const nextOp = e.target.value as SegmentOp;
          // If switching to/from "in" the value shape changes — coerce.
          if (nextOp === "in" && !Array.isArray(condition.value)) {
            onChange({ op: nextOp, value: [scalarOrEmpty(condition.value)] });
          } else if (nextOp !== "in" && Array.isArray(condition.value)) {
            onChange({
              op: nextOp,
              value: scalarOrEmpty(condition.value[0]),
            });
          } else {
            onChange({ op: nextOp });
          }
        }}
        className={cn(
          "h-8 border border-zinc-800 bg-zinc-950 px-2",
          "font-mono text-[11px] text-zinc-50",
          "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
        )}
      >
        {ops.map((op) => (
          <option key={op} value={op} className="bg-zinc-950">
            {op}
          </option>
        ))}
        {/* Allow keeping an existing op even if not in the per-field whitelist (defensive). */}
        {!ops.includes(condition.op) && (
          <option value={condition.op} className="bg-zinc-950">
            {condition.op}
          </option>
        )}
      </select>

      <ValueInput condition={condition} onChange={onChange} />

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title="Remove condition"
        className={cn(
          "border p-1.5 transition-colors",
          canRemove
            ? "cursor-pointer border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-red-900 hover:text-red-400"
            : "cursor-not-allowed border-zinc-800 bg-zinc-950 text-zinc-800",
        )}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function ValueInput({
  condition,
  onChange,
}: {
  condition: SegmentCondition;
  onChange: (patch: Partial<SegmentCondition>) => void;
}) {
  const { field, op, value } = condition;

  if (op === "in") {
    // Multi-value: comma-separated string -> array. Country, language,
    // stance_label, framing_label commonly use this.
    const stringValue = Array.isArray(value)
      ? value.map(String).join(", ")
      : String(value ?? "");
    return (
      <input
        type="text"
        value={stringValue}
        onChange={(e) => {
          const parts = e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          const coerced = parts.map((p) => coerceScalar(field, p));
          onChange({ value: coerced });
        }}
        placeholder={inListPlaceholder(field)}
        className={inputClass()}
      />
    );
  }

  if (field === "country") {
    return (
      <select
        value={String(value ?? "")}
        onChange={(e) => onChange({ value: e.target.value })}
        className={inputClass()}
      >
        {ALL_ISO2.map((iso) => (
          <option key={iso} value={iso} className="bg-zinc-950">
            {iso2ToFlagEmoji(iso)} {iso} · {countryName(iso)}
          </option>
        ))}
      </select>
    );
  }

  if (field === "source_score") {
    return (
      <select
        value={String(value ?? 0)}
        onChange={(e) => onChange({ value: Number(e.target.value) })}
        className={inputClass()}
      >
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n} className="bg-zinc-950">
            {n}
          </option>
        ))}
      </select>
    );
  }

  if (field === "is_propaganda") {
    return (
      <select
        value={value ? "true" : "false"}
        onChange={(e) => onChange({ value: e.target.value === "true" })}
        className={inputClass()}
      >
        <option value="true" className="bg-zinc-950">
          true
        </option>
        <option value="false" className="bg-zinc-950">
          false
        </option>
      </select>
    );
  }

  if (field === "stance_label") {
    return (
      <select
        value={String(value ?? STANCE_LABELS[0])}
        onChange={(e) => onChange({ value: e.target.value })}
        className={inputClass()}
      >
        {STANCE_LABELS.map((s) => (
          <option key={s} value={s} className="bg-zinc-950">
            {s}
          </option>
        ))}
      </select>
    );
  }

  if (field === "framing_label") {
    return (
      <select
        value={String(value ?? FRAMING_LABELS[0])}
        onChange={(e) =>
          onChange({ value: e.target.value as FramingLabel })
        }
        className={inputClass()}
      >
        {FRAMING_LABELS.map((f) => (
          <option key={f} value={f} className="bg-zinc-950">
            {f}
          </option>
        ))}
      </select>
    );
  }

  if (field === "topic_id" || field === "source_id") {
    return (
      <input
        type="number"
        min={1}
        value={Number(value ?? 0) || ""}
        onChange={(e) => onChange({ value: Number(e.target.value) })}
        placeholder={field === "topic_id" ? "Topic id" : "Source id"}
        className={inputClass()}
      />
    );
  }

  // language and anything else falls back to free text
  return (
    <input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder={FIELD_HELP[field]}
      className={inputClass()}
    />
  );
}

function defaultOp(field: SegmentField): SegmentOp {
  return OPS_BY_FIELD[field][0] ?? "=";
}

function defaultValue(field: SegmentField): SegmentValue {
  switch (field) {
    case "topic_id":
    case "source_id":
      return 1;
    case "country":
      return "DE";
    case "source_score":
      return 2;
    case "is_propaganda":
      return false;
    case "language":
      return "en";
    case "stance_label":
      return STANCE_LABELS[0];
    case "framing_label":
      return FRAMING_LABELS[0];
  }
}

function coerceScalar(
  field: SegmentField,
  raw: string,
): string | number | boolean {
  if (field === "topic_id" || field === "source_id" || field === "source_score") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (field === "is_propaganda") {
    return raw === "true";
  }
  if (field === "country") {
    return raw.toUpperCase();
  }
  return raw;
}

function scalarOrEmpty(
  v: SegmentValue | undefined,
): string | number | boolean {
  if (v === undefined) return "";
  if (Array.isArray(v)) return v[0] ?? "";
  return v;
}

function inListPlaceholder(field: SegmentField): string {
  switch (field) {
    case "country":
      return "DE, PL, AT";
    case "language":
      return "en, uk, de";
    case "stance_label":
      return "supportive, critical";
    case "framing_label":
      return "pro-ukraine, neutral-factual";
    case "topic_id":
    case "source_id":
    case "source_score":
      return "1, 2, 3";
    default:
      return "value1, value2";
  }
}

function inputClass(): string {
  return cn(
    "h-8 w-full border border-zinc-800 bg-zinc-950 px-2",
    "font-mono text-[11px] text-zinc-50 placeholder:text-zinc-700",
    "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
  );
}
