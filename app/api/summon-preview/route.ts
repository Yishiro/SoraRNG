export async function POST() {
  return Response.json(
    { error: 'Les boosters gratuits ont été retirés.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
