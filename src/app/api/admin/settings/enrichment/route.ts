import { NextResponse, type NextRequest } from "next/server";

// PATCH /api/admin/settings/enrichment
//
// Server-side proxy that injects X-Admin-Key from ADMIN_API_KEY before
// forwarding to the backend's PATCH /api/settings/enrichment. Keeps the
// admin key out of the browser bundle.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export async function PATCH(req: NextRequest) {
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
  const upstream = await fetch(`${API_URL}/api/settings/enrichment`, {
    method: "PATCH",
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
