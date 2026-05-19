"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, RotateCcw, Save, Search } from "lucide-react";

import { ApiError, apiClient } from "@/lib/api";
import { ALL_ISO2, countryName, iso2ToFlagEmoji } from "@/lib/country";
import type { CountryAttribution } from "@/lib/types";
import { KickerLabel } from "@/components/ui/kicker-label";
import { cn } from "@/lib/utils";

type CountryOption = {
  iso2: string;
  name: string;
  flag: string;
};

function buildCountryOptions(): CountryOption[] {
  return ALL_ISO2.map((iso2) => ({
    iso2,
    name: countryName(iso2),
    flag: iso2ToFlagEmoji(iso2),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function normalizeDomain(raw: string): string {
  let v = raw.trim().toLowerCase();
  if (v.startsWith("http://")) v = v.slice(7);
  if (v.startsWith("https://")) v = v.slice(8);
  if (v.startsWith("www.")) v = v.slice(4);
  v = v.split("/")[0];
  return v;
}

export function DomainCountryOverride() {
  const queryClient = useQueryClient();
  const options = useMemo(buildCountryOptions, []);

  const [input, setInput] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<CountryOption | null>(
    null,
  );
  const [unresolvedChecked, setUnresolvedChecked] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const lookupQuery = useQuery({
    queryKey: ["domain-country", domain],
    queryFn: () => apiClient.domainCountry(domain!),
    enabled: domain !== null,
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 404) return false;
      return count < 1;
    },
  });

  // Initialise the combobox from the lookup result on first successful load.
  useEffect(() => {
    if (!lookupQuery.data) return;
    const iso = lookupQuery.data.country_iso2;
    if (iso) {
      const match = options.find((o) => o.iso2 === iso.toUpperCase()) ?? null;
      setSelectedOption(match);
      setUnresolvedChecked(false);
    } else {
      setSelectedOption(null);
      setUnresolvedChecked(false);
    }
    setFeedback(null);
  }, [lookupQuery.data, options]);

  const saveMutation = useMutation({
    mutationFn: (iso2: string | null) =>
      apiClient.patchDomainCountry(domain!, iso2),
    onSuccess: (data) => {
      setFeedback({
        kind: "success",
        text: data.country_iso2
          ? `Saved · ${data.country_iso2}`
          : "Saved · marked as Unknown",
      });
      queryClient.setQueryData(["domain-country", domain], data);
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["countries"] });
      queryClient.invalidateQueries({ queryKey: ["sources-count"] });
    },
    onError: (err) =>
      setFeedback({
        kind: "error",
        text: err instanceof Error ? err.message : "Save failed",
      }),
  });

  const reresolveMutation = useMutation({
    mutationFn: () => apiClient.deleteDomainCountry(domain!),
    onSuccess: () => {
      setFeedback({
        kind: "success",
        text: "Cache cleared · will re-resolve on next ingestion",
      });
      queryClient.invalidateQueries({ queryKey: ["domain-country", domain] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["countries"] });
      queryClient.invalidateQueries({ queryKey: ["sources-count"] });
    },
    onError: (err) =>
      setFeedback({
        kind: "error",
        text: err instanceof Error ? err.message : "Re-resolve failed",
      }),
  });

  const submitLookup = () => {
    const norm = normalizeDomain(input);
    if (!norm) {
      setFeedback({ kind: "error", text: "Enter a domain." });
      return;
    }
    if (!DOMAIN_RE.test(norm)) {
      setFeedback({
        kind: "error",
        text: "Not a valid domain (e.g. pravda.com.ua).",
      });
      return;
    }
    setFeedback(null);
    setDomain(norm);
    if (norm !== input) setInput(norm);
  };

  const onSave = () => {
    if (!domain) return;
    const next = unresolvedChecked ? null : (selectedOption?.iso2 ?? null);
    saveMutation.mutate(next);
  };

  const onReresolve = () => {
    if (!domain) return;
    reresolveMutation.mutate();
  };

  const result = lookupQuery.data;
  const isWorking = saveMutation.isPending || reresolveMutation.isPending;

  return (
    <section className="border border-zinc-800 bg-zinc-950 p-5">
      <KickerLabel>Domain country override</KickerLabel>
      <p className="mt-2 text-xs text-zinc-500">
        Look up a domain and override its country attribution. Useful when
        automatic resolution (GDELT, Wikidata, ccTLD) is wrong.
      </p>

      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitLookup();
        }}
      >
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. pravda.com.ua"
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "h-8 w-full border border-zinc-800 bg-zinc-950 pr-2 pl-7",
              "font-mono text-[11px] text-zinc-50 placeholder:text-zinc-700",
              "outline-none transition-colors hover:border-zinc-700 focus:border-zinc-700",
            )}
          />
        </div>
        <button
          type="submit"
          className={cn(
            "h-8 border border-zinc-700 bg-zinc-900 px-3",
            "font-mono text-[11px] text-zinc-100 transition-colors",
            "hover:border-zinc-600 hover:bg-zinc-800",
          )}
        >
          Look up
        </button>
      </form>

      {domain && lookupQuery.isLoading && (
        <div className="mt-4 font-mono text-[11px] text-zinc-500">
          Loading {domain}…
        </div>
      )}

      {domain && lookupQuery.error && (
        <div className="mt-4 font-mono text-[11px] text-red-400">
          {lookupQuery.error instanceof ApiError &&
          lookupQuery.error.status === 404
            ? `No attribution data for ${domain} yet — you can still set one below.`
            : lookupQuery.error instanceof Error
              ? lookupQuery.error.message
              : "Lookup failed."}
        </div>
      )}

      {result && (
        <div className="mt-4 border-t border-zinc-900 pt-4">
          <CurrentAttribution data={result} />

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <CountryPicker
              options={options}
              value={selectedOption}
              disabled={unresolvedChecked}
              onChange={setSelectedOption}
            />

            <button
              type="button"
              onClick={onSave}
              disabled={isWorking || (!selectedOption && !unresolvedChecked)}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 border border-emerald-700 bg-emerald-900/40 px-3",
                "font-mono text-[11px] text-emerald-50 transition-colors",
                "hover:border-emerald-600 hover:bg-emerald-900/60",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Save className="size-3.5" />
              {saveMutation.isPending ? "Saving…" : "Save override"}
            </button>

            <button
              type="button"
              onClick={onReresolve}
              disabled={isWorking}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 border border-zinc-700 bg-zinc-900 px-3",
                "font-mono text-[11px] text-zinc-300 transition-colors",
                "hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-50",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <RotateCcw className="size-3.5" />
              {reresolveMutation.isPending ? "Clearing…" : "Force re-resolve"}
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 font-mono text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={unresolvedChecked}
              onChange={(e) => {
                setUnresolvedChecked(e.target.checked);
                if (e.target.checked) setSelectedOption(null);
              }}
              className="size-3 accent-emerald-600"
            />
            Save as <span className="text-zinc-300">Unknown</span> (force
            unresolved bucket)
          </label>

          {feedback && (
            <div
              className={cn(
                "mt-3 font-mono text-[11px]",
                feedback.kind === "success"
                  ? "text-emerald-400"
                  : "text-red-400",
              )}
            >
              {feedback.text}
            </div>
          )}

          <p className="mt-4 border-t border-zinc-900 pt-3 font-mono text-[10px] leading-relaxed text-zinc-600">
            Manual overrides are stored as <code>provider=manual_admin</code>{" "}
            and may be replaced by the next ingestion tick if GDELT also
            returns attribution for this domain. For a permanent fix, contact
            engineering to add the domain to{" "}
            <code>domain_country_overrides.csv</code>.
          </p>
        </div>
      )}
    </section>
  );
}

function CurrentAttribution({ data }: { data: CountryAttribution }) {
  const iso = data.country_iso2;
  const flag = iso ? iso2ToFlagEmoji(iso) : "";
  const name = iso ? countryName(iso) : "Unknown";

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <div className="font-mono text-[13px] text-zinc-50">{data.domain}</div>
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400">
        <span className="text-zinc-600">Current:</span>
        {iso ? (
          <>
            <span aria-hidden className="text-[14px] leading-none">
              {flag}
            </span>
            <span className="text-zinc-100">{iso.toUpperCase()}</span>
            <span className="text-zinc-500">·</span>
            <span>{name}</span>
          </>
        ) : (
          <span className="text-zinc-500">— Unknown</span>
        )}
        <span className="text-zinc-700">·</span>
        <span className="text-zinc-500">
          {data.provider ?? "no provider"}
          {data.confidence ? ` · ${data.confidence}` : ""}
        </span>
      </div>
    </div>
  );
}

function CountryPicker({
  options,
  value,
  disabled,
  onChange,
}: {
  options: CountryOption[];
  value: CountryOption | null;
  disabled: boolean;
  onChange: (next: CountryOption | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Combobox.Root<CountryOption>
      items={options}
      value={value}
      onValueChange={(item) => {
        if (item) onChange(item);
      }}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
      itemToStringLabel={(it) => `${it.iso2} ${it.name}`}
      isItemEqualToValue={(a, b) => a.iso2 === b.iso2}
      filter={(item, query) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          item.iso2.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q)
        );
      }}
    >
      <Combobox.Trigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-8 w-full items-center gap-1.5 border border-zinc-800 bg-zinc-950 px-2",
              "font-mono text-[11px] text-zinc-300 transition-colors",
              "hover:border-zinc-700 hover:text-zinc-50",
              "data-[popup-open]:border-zinc-700 data-[popup-open]:text-zinc-50",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {value ? (
              <>
                <span aria-hidden className="text-[14px] leading-none">
                  {value.flag}
                </span>
                <span className="text-zinc-500">{value.iso2}</span>
                <span className="flex-1 truncate text-left">{value.name}</span>
              </>
            ) : (
              <span className="flex-1 text-left text-zinc-500">
                Select country…
              </span>
            )}
            <ChevronDown className="size-3 text-zinc-600" />
          </button>
        }
      />
      <Combobox.Portal>
        <Combobox.Positioner
          sideOffset={4}
          align="start"
          side="bottom"
          className="z-[100]"
        >
          <Combobox.Popup
            className={cn(
              "w-72 overflow-hidden border border-zinc-800 bg-zinc-950 outline-none",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 duration-100",
            )}
          >
            <Combobox.InputGroup className="relative border-b border-zinc-800 p-1.5">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-zinc-600" />
              <Combobox.Input
                placeholder="Search ISO or name…"
                className={cn(
                  "h-7 w-full border-0 bg-zinc-950 pr-2 pl-7",
                  "font-mono text-[11px] text-zinc-50 placeholder:text-zinc-700 outline-none",
                )}
              />
            </Combobox.InputGroup>

            <Combobox.List className="max-h-60 overflow-y-auto">
              {(item: CountryOption) => (
                <Combobox.Item
                  key={item.iso2}
                  value={item}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-2 py-1.5",
                    "font-mono text-[11px] text-zinc-300",
                    "data-[highlighted]:bg-zinc-900 data-[highlighted]:text-zinc-50",
                    "data-[selected]:text-zinc-50",
                  )}
                >
                  <span aria-hidden className="text-[14px] leading-none">
                    {item.flag}
                  </span>
                  <span className="w-6 text-zinc-500">{item.iso2}</span>
                  <span className="flex-1 truncate">{item.name}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty className="px-2 py-2 font-mono text-[11px] text-zinc-500">
              No match.
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
