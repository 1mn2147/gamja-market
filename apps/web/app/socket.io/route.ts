import type { NextRequest } from 'next/server';

const internalApiOrigin = process.env.INTERNAL_API_ORIGIN
  ?? process.env.NEXT_PUBLIC_API_ORIGIN
  ?? 'http://localhost:4000';
const upstreamOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

async function proxy(request: NextRequest) {
  // Engine.IO's server path includes the trailing slash even though the public
  // Next.js route omits it to avoid an automatic 308 redirect.
  const target = new URL('/socket.io/', internalApiOrigin);
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.set('accept-encoding', 'identity');
  headers.set('origin', upstreamOrigin);

  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      ...(hasBody ? { body: await request.arrayBuffer() } : {}),
      redirect: 'manual',
      cache: 'no-store',
      signal: request.signal,
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-length');
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('connection');
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json({ code: 'SOCKET_UPSTREAM_UNAVAILABLE' }, { status: 503 });
  }
}

export const dynamic = 'force-dynamic';
export const GET = proxy;
export const POST = proxy;
