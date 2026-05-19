"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, Globe, Search } from "lucide-react";

import { apiClient } from "@/lib/api";
import { countryName, iso2ToFlagEmoji } from "@/lib/country";
import { cn } from "@/lib/utils";

type CountryItem = {
  iso2: string;
  name: string;
  flag: string;
  count: number;
};

export function CountryFilter({
  topicId,
  days,
  value,
  onChange,
}: {
  topicId: number | null;
  days: number;
  value: string | null;
  onChange: (iso2: string | null) => void;
}) {
  const enabled = topicId !== null;
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["countries", topicId, days],
    queryFn: () => apiClient.countries(topicId!, days, 100),
    enabled,
    staleTime: 60_000,
  });

  const items = useMemo<CountryItem[]>(
    () =>
      (data ?? [])
        .filter((c): c is { iso2: string; count: number } => c.iso2 !== null)
        .map((c) => ({
          iso2: c.iso2,
          name: countryName(c.iso2),
          flag: iso2ToFlagEmoji(c.iso2),
          count: c.count,
        })),
    [data],
  );

  const selectedItem = useMemo(
    () => (value ? (items.find((it) => it.iso2 === value) ?? null) : null),
    [items, value],
  );

  const selectedFlag = value ? iso2ToFlagEmoji(value) : "";
  const selectedName = value ? countryName(value) : "";

  return (
    <Combobox.Root<CountryItem>
      items={items}
      value={selectedItem}
      onValueChange={(item) => {
        if (item) onChange(item.iso2);
      }}
      open={open}
      onOpenChange={setOpen}
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
        disabled={!enabled}
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 border border-zinc-800 bg-zinc-950 px-2",
              "font-mono text-[11px] text-zinc-300 transition-colors",
              "hover:border-zinc-700 hover:text-zinc-50",
              "data-[popup-open]:border-zinc-700 data-[popup-open]:text-zinc-50",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {value ? (
              <>
                <span aria-hidden className="text-[14px] leading-none">
                  {selectedFlag}
                </span>
                <span className="text-zinc-500">{value}</span>
                <span className="max-w-32 truncate">{selectedName}</span>
              </>
            ) : (
              <>
                <Globe className="size-3.5 text-zinc-500" />
                <span>All countries</span>
              </>
            )}
            <ChevronDown className="size-3 text-zinc-600" />
          </button>
        }
      />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} align="end" side="bottom" className="z-[100]">
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

            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 border-b border-zinc-900 px-2 py-1.5 text-left",
                "font-mono text-[11px] transition-colors hover:bg-zinc-900",
                value === null ? "text-zinc-50" : "text-zinc-300",
              )}
            >
              <Globe className="size-3.5 text-zinc-500" />
              <span className="flex-1">All countries</span>
            </button>

            {isLoading ? (
              <div className="px-2 py-2 font-mono text-[11px] text-zinc-500">
                Loading…
              </div>
            ) : error ? (
              <div className="px-2 py-2 font-mono text-[11px] text-zinc-400">
                Failed to load countries
              </div>
            ) : items.length === 0 ? (
              <div className="px-2 py-2 font-mono text-[11px] text-zinc-500">
                No country data for this topic.
              </div>
            ) : (
              <>
                <Combobox.List className="max-h-60 overflow-y-auto">
                  {(item: CountryItem) => (
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
                      <span className="tabular-nums text-zinc-500">
                        {item.count}
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
                <Combobox.Empty className="px-2 py-2 font-mono text-[11px] text-zinc-500">
                  No match.
                </Combobox.Empty>
              </>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
