import { NextResponse, type NextRequest } from "next/server";

// PUT/DELETE /api/admin/settings/prompts/{key}
//
// Server-side proxy that injects X-Admin-Key from ADMIN_API_KEY before
// forwarding to the backend's /api/settings/prompts/{key}. Keeps the
// admin key out of the browser bundle. The backend whitelists editable
// keys server-side (report_map_cluster / report_reduce) — a bad key
// returns its 422 verbatim.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

type Ctx = { params: Promise<{ key: string }> };

function configError() {
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
  return null;
}

// Prompt keys are snake_case identifiers — reject anything else before
// it reaches the backend URL.
function validKey(key: string): boolean {
  return /^[a-z0-9_]{1,64}$/.test(key);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const err = configError();
  if (err) return err;

  const { key } = await ctx.params;
  if (!validKey(key)) {
    return NextResponse.json({ error: "invalid prompt key" }, { status: 400 });
  }

  const body = await req.text();
  const upstream = await fetch(`${API_URL}/api/settings/prompts/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_API_KEY!,
    },
    body,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const err = configError();
  if (err) return err;

  const { key } = await ctx.params;
  if (!validKey(key)) {
    return NextResponse.json({ error: "invalid prompt key" }, { status: 400 });
  }

  const upstream = await fetch(`${API_URL}/api/settings/prompts/${key}`, {
    method: "DELETE",
    headers: { "X-Admin-Key": ADMIN_API_KEY! },
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
