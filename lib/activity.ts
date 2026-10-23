// Client activity tracker: queues events, flushes in batches to /api/activity.
type EventType =
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_ended'
  | 'game_started'
  | 'game_ended'
  | 'play_again_clicked';
type QueuedEvent = {
  eventId: string;
  type: EventType;
  matchId?: string;
  payload?: Record<string, string | number>;
};

const ENDPOINT = '/api/activity';
const FLUSH_MS = 3000;
const HEARTBEAT_MS = 30000;
const BATCH = 20;

let sessionId: string | null = null;
let activeSeconds = 0;
let queue: QueuedEvent[] = [];
let sending = false;
let lastSend = 0;
let timer: number | undefined;

export const newId = () => crypto.randomUUID();
export const sessionActive = () => sessionId !== null;

export function tick() {
  if (sessionId) activeSeconds++;
}

export function track(
  type: EventType,
  extra: { matchId?: string; payload?: Record<string, string | number> } = {},
) {
  if (!sessionId) return;
  queue.push({ eventId: newId(), type, ...extra });
  if (queue.length >= BATCH) void flush();
}

export function startSession() {
  if (sessionId) return;
  sessionId = newId();
  activeSeconds = 0;
  queue = [];
  track('session_started');
  timer = window.setInterval(() => {
    // Heartbeat only when idle; real batches already carry activeSeconds.
    if (queue.length || Date.now() - lastSend >= HEARTBEAT_MS) void flush();
  }, FLUSH_MS);
}

export function endSession() {
  if (!sessionId) return;
  track('session_ended');
  void flush(true);
  clearInterval(timer);
  sessionId = null;
}

async function flush(final = false) {
  if (!sessionId || sending) return;
  const batch = queue.slice(0, BATCH);
  queue = queue.slice(batch.length);
  sending = true;
  lastSend = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: { sessionId, activeSeconds },
        events: batch,
      }),
      keepalive: final,
    });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    // 4xx will fail again if resent, so the batch is dropped.
    if (res.ok) {
      const rejected = ((await res.json()) as any)?.data?.rejected;
      if (rejected?.length) console.warn('Activity events rejected', rejected);
    } else console.warn('Activity batch dropped', res.status);
  } catch {
    // Network error or 5xx: resend with the same eventIds; duplicates are ignored.
    queue = [...batch, ...queue];
  } finally {
    sending = false;
  }
}
