// Vercel adds the visitor's country; the API sits elsewhere and can't see it.
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return Response.json(
    { country: request.headers.get('x-vercel-ip-country') },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
