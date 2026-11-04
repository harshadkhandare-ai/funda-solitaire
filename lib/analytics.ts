// Client analytics queue for Funda Solitaire. Batches up to 20 events with the
// session's running activeSeconds and posts them to the Funda activity events
// endpoint, which identifies the player from the Bearer token.
export const eventTypes = [
  'session_started',
  'session_paused',
  'session_resumed',
  'session_ended',
  'game_started',
  'game_resumed',
  'game_completed',
  'game_abandoned',
  'hint_used',
  'undo_used',
  'auto_finish_used',
  'play_again_clicked',
] as const;
export type EventType = (typeof eventTypes)[number];

const ENDPOINT =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
    .env?.VITE_FUNDA_EVENTS_URL ||
  'https://apip-preprod.classplusapp.com/funda/api/activity/events';
const APP = 'solitaire';
const TOKEN_KEY = 'funda-token';
const BATCH_SIZE = 20;
const MAX_QUEUE = 200;
const FLUSH_MS = 5_000;
const HEARTBEAT_MS = 30_000;

// The endpoint stores only eventId, type and a flat payload of strings and
// numbers; it sets occurredAt itself and drops unknown fields.
type Payload = Record<string, string | number>;
type QueuedEvent = { eventId: string; type: EventType; payload?: Payload };

let token: string | null = null;
let session: { sessionId: string } | null = null;
let lastSentAt = 0;
let activeSeconds = 0;
let queue: QueuedEvent[] = [];
let sending = false;
let started = false;

export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// The host app opens the webview with #token=<Funda JWT> (older builds used
// ?token=). The token is remembered so in-game reloads keep reporting for the
// same player.
function resolveToken(): string | null {
  try {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const pick = (k: string) => hash.get(k) || url.searchParams.get(k) || null;
    const fromUrl = pick('token')?.trim();
    if (fromUrl) {
      localStorage.setItem(TOKEN_KEY, fromUrl);
      return fromUrl;
    }
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function startSession() {
  session = { sessionId: newId() };
  activeSeconds = 0;
  track('session_started');
}

export function track(
  type: EventType,
  options: { matchId?: string | null; metadata?: Record<string, unknown> } = {},
) {
  if (!token || !session) return;
  // Game events are meaningless without the hand they belong to.
  if ((type.startsWith('game_') || type.endsWith('_used')) && !options.matchId)
    return;
  const payload: Payload = {};
  if (options.matchId) payload.matchId = options.matchId;
  for (const [key, value] of Object.entries(options.metadata ?? {})) {
    if (typeof value === 'string' || typeof value === 'number')
      payload[key] = value;
    else if (typeof value === 'boolean') payload[key] = value ? 1 : 0;
  }
  queue.push({
    eventId: newId(),
    type,
    ...(Object.keys(payload).length ? { payload } : {}),
  });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= BATCH_SIZE) void flush();
}

// Events carry UUIDs, so a resend after an unknown failure is safe. keepalive
// lets the last batch finish while the page is hidden or unloading; sendBeacon
// cannot carry the Authorization header.
export async function flush() {
  if (!token || !session || sending) return;
  sending = true;
  try {
    do {
      const events = queue.slice(0, BATCH_SIZE);
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          app: APP,
          session: { ...session, activeSeconds },
          events,
        }),
        keepalive: true,
      });
      // 4xx means the batch itself is rejected; drop it instead of retrying.
      if (response.status >= 500) break;
      if (response.status === 401) token = null;
      lastSentAt = Date.now();
      queue = queue.slice(events.length);
    } while (queue.length && token);
  } catch {
    // Offline or blocked: keep the queue for the next heartbeat.
  } finally {
    sending = false;
  }
}

export function initAnalytics() {
  if (started || typeof window === 'undefined') return;
  started = true;
  token = resolveToken();
  if (!token) {
    console.info('Solitaire analytics off: no token in the URL.');
    return;
  }
  startSession();
  void flush();
  setInterval(() => {
    if (!document.hidden) activeSeconds++;
  }, 1000);
  // Send queued events every few seconds; an empty batch is the heartbeat.
  setInterval(() => {
    if (queue.length || Date.now() - lastSentAt >= HEARTBEAT_MS) void flush();
  }, FLUSH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      track('session_paused');
      void flush();
    } else {
      track('session_resumed');
      void flush();
    }
  });
  window.addEventListener('pagehide', () => {
    track('session_ended');
    void flush();
  });
  window.addEventListener('pageshow', (e) => {
    // Restored from the back-forward cache after session_ended.
    if (e.persisted) {
      startSession();
      void flush();
    }
  });
}
