"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export default function Home() {
  const { data: brands, isLoading, error } = useQuery({
    queryKey: ["brands"],
    queryFn: apiClient.brands,
  });

  return (
    <main className="min-h-screen bg-background text-foreground p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2 h-2 bg-emerald-400" />
          <h1 className="text-sm">u24-pulse</h1>
        </div>

        <div className="border border-zinc-900 bg-zinc-950 p-6">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
            Connection test
          </div>
          {isLoading && (
            <div className="text-zinc-400 text-sm">
              Loading brands from {process.env.NEXT_PUBLIC_API_URL}...
            </div>
          )}
          {error && (
            <div className="text-red-400 text-sm">
              Error: {(error as Error).message}
            </div>
          )}
          {brands && (
            <div className="space-y-2">
              <div className="text-zinc-400 text-sm">
                ✓ Connected to backend. Found {brands.length} brand(s):
              </div>
              {brands.map((b) => (
                <div key={b.id} className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-1.5 h-1.5 ${
                      b.is_active ? "bg-emerald-400" : "bg-zinc-700"
                    }`}
                  />
                  <span>{b.name}</span>
                  <span className="text-zinc-600">({b.mentions_count})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-xs text-zinc-600">
          Stage 1 complete · Next: implement DASHBOARD_DESIGN.md components
        </div>
      </div>
    </main>
  );
}
