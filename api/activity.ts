// Server-side proxy for the activity API. The bearer token stays here and never
// reaches the browser. Kept self-contained so Vercel can run it as-is.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_TYPES = new Set([
  'session_started',
  'session_paused',
  'session_resumed',
  'session_ended',
  'game_started',
  'game_ended',
  'play_again_clicked',
]);
const MAX_BODY = 100_000;

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function POST(request: Request): Promise<Response> {
  const base = process.env.ACTIVITY_API_BASE_URL;
  const token = process.env.ACTIVITY_API_TOKEN;
  if (!base || !token)
    return reply(500, { success: false, message: 'Tracking not configured' });

  const text = await request.text();
  if (text.length > MAX_BODY)
    return reply(413, { success: false, message: 'Body too large' });

  let input: any;
  try {
    input = JSON.parse(text);
  } catch {
    return reply(400, { success: false, message: 'Invalid JSON' });
  }

  const sessionId = input?.session?.sessionId;
  const seconds = input?.session?.activeSeconds ?? 0;
  const events = input?.events;
  if (
    typeof sessionId !== 'string' ||
    !UUID.test(sessionId) ||
    !Number.isInteger(seconds) ||
    !Array.isArray(events) ||
    events.length > 20
  )
    return reply(400, { success: false, message: 'Invalid request' });

  const clean = [];
  for (const e of events) {
    if (
      typeof e?.eventId !== 'string' ||
      !UUID.test(e.eventId) ||
      !EVENT_TYPES.has(e.type) ||
      (e.matchId !== undefined &&
        (typeof e.matchId !== 'string' || !UUID.test(e.matchId)))
    )
      return reply(400, { success: false, message: 'Invalid event' });
    clean.push({
      eventId: e.eventId,
      type: e.type,
      ...(e.matchId ? { matchId: e.matchId } : {}),
      ...(e.payload && typeof e.payload === 'object'
        ? { payload: e.payload }
        : {}),
    });
  }

  try {
    const upstream = await fetch(`${base}/funda/api/activity/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // The app name is fixed here so the public route cannot post as another game.
      body: JSON.stringify({
        app: 'solitaire',
        session: { sessionId, activeSeconds: seconds },
        events: clean,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return reply(502, { success: false, message: 'Upstream unreachable' });
  }
}
