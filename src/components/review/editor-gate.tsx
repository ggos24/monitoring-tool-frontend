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
      <h2 className="text-base font-medium text-foreground">Welcome! What is your name?</h2>
      <p className="mt-2 text-sm text-text-secondary">
        We save your name with each answer, so we can see who labelled what.
        You type it only once: this browser remembers it.
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
          placeholder="For example: Olena Kovalenko"
          className="h-10 flex-1 border border-strong bg-background px-3 text-sm text-foreground outline-none focus:border-text-tertiary"
        />
        <Button type="submit" disabled={!cleaned} className="h-10 px-4">
          Continue
        </Button>
      </form>
    </section>
  );
}

export function EditorBadge({ name, onChange }: { name: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-text-tertiary">
      <span>
        Labelling as <span className="text-foreground">{name}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Not you?
      </button>
    </div>
  );
}
