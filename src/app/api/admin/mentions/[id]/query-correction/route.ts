import { NextResponse, type NextRequest } from "next/server";

// POST /api/admin/mentions/{id}/query-correction
//
// Server-side proxy that injects X-Admin-Key before forwarding to the
// backend's POST /api/mentions/{id}/query-correction: an editor moves the
// article to another query or removes it from one. The backend records the
// action with the algorithm's original verdict.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
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

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "id must be numeric" }, { status: 400 });
  }

  const upstream = await fetch(`${API_URL}/api/mentions/${id}/query-correction`, {
    method: "POST",
    headers: { "X-Admin-Key": ADMIN_API_KEY, "Content-Type": "application/json" },
    body: await req.text(),
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
