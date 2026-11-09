import { NextResponse, type NextRequest } from "next/server";

// POST /api/admin/reports/segment
//
// Server-side proxy that injects X-Admin-Key before forwarding to the
// backend's POST /api/reports/segment ("Generate now"). The backend
// protects it because a report over enriched rows spends Gemini money.
// Small scopes run inline upstream, so allow the same headroom as topic
// create.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export async function POST(req: NextRequest) {
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

  const body = await req.text();
  const upstream = await fetch(`${API_URL}/api/reports/segment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_API_KEY,
    },
    body,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
