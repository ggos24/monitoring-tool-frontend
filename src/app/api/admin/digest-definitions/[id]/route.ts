import { NextResponse, type NextRequest } from "next/server";

// PATCH/DELETE /api/admin/digest-definitions/{id}
//
// Server-side proxy that injects X-Admin-Key from ADMIN_API_KEY before
// forwarding to the backend's /api/digest-definitions/{id}. Keeps the
// admin key out of the browser bundle.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

type Ctx = { params: Promise<{ id: string }> };

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

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const err = configError();
  if (err) return err;

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "id must be numeric" }, { status: 400 });
  }

  const body = await req.text();
  const upstream = await fetch(`${API_URL}/api/digest-definitions/${id}`, {
    method: "PATCH",
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

  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "id must be numeric" }, { status: 400 });
  }

  const upstream = await fetch(`${API_URL}/api/digest-definitions/${id}`, {
    method: "DELETE",
    headers: { "X-Admin-Key": ADMIN_API_KEY! },
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
