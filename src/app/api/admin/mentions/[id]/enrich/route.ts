import { NextResponse, type NextRequest } from "next/server";

// POST /api/admin/mentions/{id}/enrich
//
// Server-side proxy that injects X-Admin-Key from ADMIN_API_KEY before
// forwarding to the backend's POST /api/mentions/{id}/enrich. The
// upstream call is a synchronous Gemini generateContent that typically
// returns in 2-5s; we set maxDuration headroom for the cold-tail case.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
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

  const upstream = await fetch(`${API_URL}/api/mentions/${id}/enrich`, {
    method: "POST",
    headers: { "X-Admin-Key": ADMIN_API_KEY },
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
