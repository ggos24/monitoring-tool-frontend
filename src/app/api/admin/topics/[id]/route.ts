import { NextResponse, type NextRequest } from "next/server";

// PATCH /api/admin/topics/[id]
//
// Server-side proxy that injects X-Admin-Key before forwarding to the
// backend's PATCH /api/topics/{id}. The UI may only rename a narrative or
// pause/resume it, so the body is cut down to an allowlist: every other
// key is dropped here. In particular `query` / `queries` never reach the
// backend — on a topic with rules they write a GDELT override that skips
// the compiled query.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!API_URL) {
    return NextResponse.json(
      { error: "API_URL / NEXT_PUBLIC_API_URL not configured" },
      { status: 500 },
    );
  }
  if (!ADMIN_API_KEY) {
    return NextResponse.json(
      { error: "ADMIN_API_KEY not configured on the frontend server" },
      { status: 500 },
    );
  }

  const { id } = await context.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "invalid topic id" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: "body must be a JSON object" }, { status: 400 });
  }
  const input = raw as Record<string, unknown>;
  const patch: { name?: unknown; is_active?: unknown } = {};
  if ("name" in input) patch.name = input.name;
  if ("is_active" in input) patch.is_active = input.is_active;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "nothing to change: send name and/or is_active" },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_URL}/api/topics/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_API_KEY,
    },
    body: JSON.stringify(patch),
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
