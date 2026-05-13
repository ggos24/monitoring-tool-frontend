import { NextResponse, type NextRequest } from "next/server";

// POST /api/admin/topics
//
// Server-side proxy that injects X-Admin-Key from the ADMIN_API_KEY env var
// before forwarding to the backend's POST /api/topics. Keeps the admin key
// out of the browser bundle. The upstream call takes ~10s (Gemini drafter +
// DataForSEO + composer + embedding), so this handler must not time out.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel function timeout — 60s headroom over the ~10s upstream call.
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
  const upstream = await fetch(`${API_URL}/api/topics`, {
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
