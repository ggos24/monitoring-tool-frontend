"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cleanEditorName, readEditor, writeEditor } from "@/lib/review";

/** The editor's name, typed once and kept in this browser. */
export function useEditorName(): [string | null, (name: string | null) => void, boolean] {
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setName(readEditor(typeof window === "undefined" ? undefined : window.localStorage));
    setReady(true);
  }, []);
  const update = (next: string | null) => {
    writeEditor(typeof window === "undefined" ? undefined : window.localStorage, next);
    setName(next);
  };
  return [name, update, ready];
}

export function EditorGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");
  const cleaned = cleanEditorName(value);
  return (
    <section className="max-w-md border border-border bg-card p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-foreground">
        Who is labelling?
      </h2>
      <p className="mt-2 text-xs text-text-tertiary">
        Type your name once. It is saved in this browser and stored with every
        label, so we can tell editors apart and compare their choices.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (cleaned) onSubmit(cleaned);
        }}
      >
        <input
          autoFocus
          value={value}
          maxLength={64}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
          className="h-9 flex-1 border border-strong bg-background px-3 font-mono text-xs text-foreground outline-none focus:border-text-tertiary"
        />
        <Button type="submit" disabled={!cleaned} className="h-9">
          Start
        </Button>
      </form>
    </section>
  );
}

export function EditorBadge({ name, onChange }: { name: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs text-text-tertiary">
      <span>
        Editor: <span className="text-foreground">{name}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        change
      </button>
    </div>
  );
}
