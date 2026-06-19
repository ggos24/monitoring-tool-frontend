"use client";

import { X } from "lucide-react";

import { ALL_ISO2, countryName, iso2ToFlagEmoji } from "@/lib/country";
import { cn } from "@/lib/utils";
import type {
  FramingLabel,
  SegmentCondition,
  SegmentField,
  SegmentOp,
  SegmentValue,
  StanceLabel,
} from "@/lib/types";
import { FRAMING_LABELS, SEGMENT_FIELDS } from "@/lib/types";

// Shared condition-builder for the two report surfaces: the ad-hoc
// generate form ("Generate now") and the scheduled-report create form
// ("Save as scheduled"). Extracted from the old settings
// digest-segments editor so both stay aligned with the backend's
// ALLOWED_SEGMENT_FIELDS whitelist by construction.

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

export function defaultCondition(): SegmentCondition {
  return { field: "country", op: "=", value: "DE" };
}

export function SegmentFilterBuilder({
  conditions,
  onChange,
  addLabel = "+ Add filter",
  excludeFields = [],
}: {
  conditions: SegmentCondition[];
  onChange: (next: SegmentCondition[]) => void;
  addLabel?: string;
  // Fields handled by a dedicated control elsewhere (e.g. `country` via
  // the report form's country multi-select) — omitted from the generic
  // field dropdown so there's one source of truth per field.
  excludeFields?: SegmentField[];
}) {
  const fieldChoices = SEGMENT_FIELDS.filter((f) => !excludeFields.includes(f));
  const addField = (fieldChoices[0] ?? "source_score") as SegmentField;
  function updateCondition(index: number, patch: Partial<SegmentCondition>) {
    onChange(
      conditions.map((c, i) => {
        if (i !== index) return c;
        // When the field changes, reset op + value to safe defaults for
        // the new field so we never send an invalid combination.
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

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-tertiary">
          Filters · joined with AND
        </span>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...conditions,
              {
                field: addField,
                op: defaultOp(addField),
                value: defaultValue(addField),
              },
            ])
          }
          className="cursor-pointer border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-text-tertiary hover:border-strong hover:text-foreground"
        >
          {addLabel}
        </button>
      </div>
      {conditions.length === 0 ? (
        <p className="mt-2 font-mono text-xs italic text-text-tertiary">
          No filters — covers all enriched mentions in the date range.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {conditions.map((c, i) => (
            <ConditionRow
              key={i}
              condition={c}
              fieldChoices={fieldChoices}
              onChange={(patch) => updateCondition(i, patch)}
              onRemove={() =>
                onChange(conditions.filter((_, idx) => idx !== i))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ConditionChip({ condition }: { condition: SegmentCondition }) {
  const valueRepr = formatValue(condition.field, condition.value);
  return (
    <span className="border border-border bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
      {condition.field} {condition.op} {valueRepr}
    </span>
  );
}

// ---------- internals ----------

function ConditionRow({
  condition,
  fieldChoices,
  onChange,
  onRemove,
}: {
  condition: SegmentCondition;
  fieldChoices: readonly SegmentField[];
  onChange: (patch: Partial<SegmentCondition>) => void;
  onRemove: () => void;
}) {
  const ops = OPS_BY_FIELD[condition.field];
  // Keep the current field selectable even if excluded (e.g. a prefilled
  // condition), so the dropdown never shows a blank value.
  const options = fieldChoices.includes(condition.field)
    ? fieldChoices
    : [condition.field, ...fieldChoices];
  return (
    <div className="grid grid-cols-[1fr_auto_2fr_auto] items-center gap-2">
      <select
        value={condition.field}
        onChange={(e) => onChange({ field: e.target.value as SegmentField })}
        className={inputClass()}
        title={FIELD_HELP[condition.field]}
      >
        {options.map((f) => (
          <option key={f} value={f} className="bg-card">
            {f}
          </option>
        ))}
      </select>

      <select
        value={condition.op}
        onChange={(e) => {
          const nextOp = e.target.value as SegmentOp;
          // If switching to/from "in" the value shape changes — coerce.
          if (nextOp === "in" && !Array.isArray(condition.value)) {
            const v = scalarOrEmpty(condition.value);
            const item = typeof v === "boolean" ? String(v) : v;
            onChange({ op: nextOp, value: [item] });
          } else if (nextOp !== "in" && Array.isArray(condition.value)) {
            onChange({ op: nextOp, value: scalarOrEmpty(condition.value[0]) });
          } else {
            onChange({ op: nextOp });
          }
        }}
        className={inputClass()}
      >
        {ops.map((op) => (
          <option key={op} value={op} className="bg-card">
            {op}
          </option>
        ))}
        {!ops.includes(condition.op) && (
          <option value={condition.op} className="bg-card">
            {condition.op}
          </option>
        )}
      </select>

      <ValueInput condition={condition} onChange={onChange} />

      <button
        type="button"
        onClick={onRemove}
        title="Remove filter"
        className="cursor-pointer border border-border bg-card p-1.5 text-text-tertiary hover:border-red-900 hover:text-red-400"
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
          const coerced: (string | number)[] = parts.map((p) => {
            const v = coerceScalar(field, p);
            return typeof v === "boolean" ? String(v) : v;
          });
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
          <option key={iso} value={iso} className="bg-card">
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
          <option key={n} value={n} className="bg-card">
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
        <option value="true" className="bg-card">
          true
        </option>
        <option value="false" className="bg-card">
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
          <option key={s} value={s} className="bg-card">
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
        onChange={(e) => onChange({ value: e.target.value as FramingLabel })}
        className={inputClass()}
      >
        {FRAMING_LABELS.map((f) => (
          <option key={f} value={f} className="bg-card">
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
  if (
    field === "topic_id" ||
    field === "source_id" ||
    field === "source_score"
  ) {
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
    "h-8 w-full border border-border bg-card px-2",
    "font-mono text-[11px] text-foreground placeholder:text-text-tertiary",
    "outline-none transition-colors hover:border-strong focus:border-strong",
  );
}
