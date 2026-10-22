import type { NextRequest } from "next/server";

// This bridge keeps the running local demo connected to its documented host backend.
const backendBaseUrl = "http://127.0.0.1:5000";

async function forward(request: NextRequest, path: string[]) {
  const target = new URL(`${backendBaseUrl}/${path.map(encodeURIComponent).join("/")}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of ["accept", "authorization", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const response = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: "no-store",
  });
  const responseHeaders = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);
  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

type RouteContext = { params: { path: string[] } };

export const GET = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
export const POST = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
export const PUT = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
export const PATCH = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
export const DELETE = (request: NextRequest, context: RouteContext) => forward(request, context.params.path);
