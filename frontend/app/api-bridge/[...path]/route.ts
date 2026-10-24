import type { NextRequest } from "next/server";

// In Compose this resolves to the backend service; local development falls back
// to the host API. Keep this server-side so internal addresses never reach browsers.
const backendBaseUrl = (
  process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// Incident analysis can take longer than ordinary API calls on a cold start.
export const maxDuration = 300;

async function forward(request: NextRequest, path: string[]) {
  const target = new URL(`${backendBaseUrl}/${path.map(encodeURIComponent).join("/")}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of ["accept", "authorization", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(240_000),
    });
    const responseHeaders = new Headers();
    const contentType = response.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { detail: "Backend API is unreachable. Check that it is running and BACKEND_INTERNAL_URL points to it." },
      { status: 502 },
    );
  }
}

type RouteContext = { params: { path: string[] } };

export const GET = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
export const POST = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
export const PUT = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
export const PATCH = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
export const DELETE = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
