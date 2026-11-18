import { NextResponse, type NextRequest } from "next/server";

// /api/admin/review/*  →  backend /api/review/*
//
// Server-side proxy that adds X-Admin-Key to the Review page's writes and to
// the CSV export. Only these paths pass; anything else is a 404 here:
//   PUT  items/{id}/labels
//   PUT  boundary-questions/{id}/answer
//   PUT  favorability/items/{id}/label
//   GET  export.csv[?batch_id=N]
//   GET  favorability/export.csv
// Creating monthly batches stays a script / admin call, not a UI action.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

const PUT_PATHS = [
  /^items\/\d+\/labels$/,
  /^boundary-questions\/\d+\/answer$/,
  /^favorability\/items\/\d+\/label$/,
];

function config(): NextResponse | null {
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

type Ctx = { params: Promise<{ path: string[] }> };

export async function PUT(req: NextRequest, context: Ctx) {
  const bad = config();
  if (bad) return bad;
  const path = (await context.params).path.join("/");
  if (!PUT_PATHS.some((re) => re.test(path))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
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
  const upstream = await fetch(`${API_URL}/api/review/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Admin-Key": ADMIN_API_KEY! },
    body: JSON.stringify(raw),
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest, context: Ctx) {
  const bad = config();
  if (bad) return bad;
  const path = (await context.params).path.join("/");
  if (path !== "export.csv" && path !== "favorability/export.csv") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const batch = req.nextUrl.searchParams.get("batch_id");
  if (batch !== null && !/^\d+$/.test(batch)) {
    return NextResponse.json({ error: "invalid batch_id" }, { status: 400 });
  }
  const upstream = await fetch(
    `${API_URL}/api/review/${path}${batch && path === "export.csv" ? `?batch_id=${batch}` : ""}`,
    { headers: { "X-Admin-Key": ADMIN_API_KEY! } },
  );
  const headers = new Headers({
    "Content-Type": upstream.headers.get("Content-Type") ?? "text/csv; charset=utf-8",
  });
  const disposition = upstream.headers.get("Content-Disposition");
  if (disposition) headers.set("Content-Disposition", disposition);
  return new NextResponse(await upstream.text(), { status: upstream.status, headers });
}
