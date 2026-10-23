'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  CircleHelp,
  Home as HomeIcon,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Shuffle,
  Sparkles,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
  Vibrate,
} from 'lucide-react';
import { Dealer } from '@/components/dealer';
import { ProjectedCard } from '@/components/projected-card';
import { CardArtwork, CardBack } from '@/components/card-artwork';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  availableMoves,
  bestHint,
  canMove,
  Card,
  deal,
  drawCards,
  Game,
  move,
  pile,
  ranks,
  red,
  Source,
  suits,
  Target,
  won,
} from '@/lib/solitaire';

export default function Home() {
  const [game, setGame] = useState<Game | null>(null),
    [history, setHistory] = useState<Game[]>([]),
    [selected, setSelected] = useState<Source | null>(null),
    [seconds, setSeconds] = useState(0),
    [modal, setModal] = useState(''),
    [sound, setSound] = useState(true),
    [haptics, setHaptics] = useState(true),
    [message, setMessage] = useState(''),
    [hint, setHint] = useState<string | null>(null),
    [theme, setTheme] = useState('emerald');
  const [screen, setScreen] = useState<'start' | 'table'>('start'),
    [hasSaved, setHasSaved] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [victoryReady, setVictoryReady] = useState(false);
  useEffect(() => {
    setVictoryReady(false);
    if (!game || !won(game) || screen !== 'table') return;
    const timer = window.setTimeout(() => setVictoryReady(true), 480);
    return () => window.clearTimeout(timer);
  }, [game, screen]);
  useEffect(() => {
    if (!autoCompleting || !game) return;
    if (screen !== 'table' || modal || won(game)) {
      setAutoCompleting(false);
      return;
    }
    const candidate = availableMoves(game).find(
      (m) => m.target.kind === 'foundations',
    );
    if (!candidate) {
      setAutoCompleting(false);
      return;
    }
    const timer = window.setTimeout(
      () => commit(move(game, candidate.source, candidate.target)),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [autoCompleting, game, screen, modal]);
  const pendingDeal = useRef(false);
  const dealerDeckRef = useRef<HTMLSpanElement>(null);
  const artworkCache = useRef<HTMLImageElement[]>([]);
  const artworkReady = useRef<Promise<void> | null>(null);
  const preparingRef = useRef(false);
  const [preparing, setPreparing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  function warmArtwork() {
    if (!artworkReady.current) {
      artworkReady.current = Promise.all(
        [
          '/cards/back.png',
          '/dealer/tina-reference.png',
          '/cards/cutouts/jack-red.png',
          '/cards/cutouts/jack-black.png',
          '/cards/cutouts/queen-red.png',
          '/cards/cutouts/queen-black.png',
          '/cards/cutouts/king-red.png',
          '/cards/cutouts/king-black.png',
        ].map((src) => {
          const image = new Image();
          image.src = src;
          artworkCache.current.push(image);
          return image.decode();
        }),
      ).then(() => {});
    }
    return artworkReady.current;
  }
  const dealSequence = useRef(0);
  const [dealerMode, setDealerMode] = useState<
    'none' | 'deal' | 'hint' | 'bye'
  >('none');
  const [hintVisit, setHintVisit] = useState(0);
  const hintMove = useRef<{ source: Source; target: Target } | null>(null);
  const [hintPreview, setHintPreview] = useState<{
    cards: Card[];
    rect: DOMRect;
    offsets: number[];
    dx: number;
    dy: number;
  } | null>(null);
  const [hintPointer, setHintPointer] = useState<{
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    hintMove.current = null;
    setHintPreview(null);
    setHintPointer(null);
  }, [game, modal, screen]);
  useEffect(() => {
    const clearPreview = () => {
      setHintPreview(null);
      setHintPointer(null);
    };
    window.addEventListener('resize', clearPreview);
    return () => window.removeEventListener('resize', clearPreview);
  }, []);
  useEffect(() => {
    if (dealerMode !== 'hint' && dealerMode !== 'bye') return;
    const timeout = setTimeout(
      () => {
        setDealerMode('none');
        setHintPreview(null);
        setHintPointer(null);
        hintMove.current = null;
        setHint(null);
        if (dealerMode === 'hint') setMessage('');
      },
      dealerMode === 'hint' ? 10000 : 1000,
    );
    return () => clearTimeout(timeout);
  }, [dealerMode, hintVisit]);
  useEffect(() => {
    if (screen !== 'table') setDealerMode('none');
  }, [screen]);
  useEffect(() => {
    void warmArtwork().catch(() => {
      artworkReady.current = null;
    });
  }, []);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragFrame = useRef(0);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const previousFaces = useRef(new Map<string, boolean>());
  const motionOff = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const boardRef = useRef<HTMLDivElement>(null);
  const [spacing, setSpacing] = useState({ up: 30, down: 18 });
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const resize = () => {
      const cardWidth = (board.clientWidth - 6 * 6) / 7;
      // Keep each exposed index fully visible; long columns scroll instead
      // of squeezing cards into different overlaps on each screen.
      const up = Math.ceil(cardWidth * 0.4 + 2);
      const down = Math.max(8, Math.round(cardWidth * 0.16));
      setSpacing({ up, down });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(board);
    return () => observer.disconnect();
  }, [screen, game]);
  useEffect(() => {
    function pauseWhenHidden() {
      if (document.hidden && screen === 'table')
        setModal((current) => current || 'pause');
    }
    function keyboard(e: KeyboardEvent) {
      if (e.key === 'Escape' && screen === 'table' && !modal) {
        e.preventDefault();
        setModal('pause');
      }
    }
    document.addEventListener('visibilitychange', pauseWhenHidden);
    window.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      window.removeEventListener('keydown', keyboard);
    };
  }, [screen, modal]);
  const positions = useRef(new Map<string, DOMRect>());
  const cardMotions = useRef(new Map<string, Animation>());
  useEffect(() => {
    cardMotions.current.forEach((animation) => {
      if (modal) animation.pause();
      else animation.play();
    });
  }, [modal]);
  function captureCardPositions() {
    document.querySelectorAll<HTMLElement>('[data-card-id]').forEach((el) => {
      // Dragged cards already have their actual drop positions recorded.
      if (!el.classList.contains('drag-source'))
        positions.current.set(el.dataset.cardId!, el.getBoundingClientRect());
    });
  }
  useEffect(
    () => () => {
      cardMotions.current.forEach((animation) => animation.cancel());
      cardMotions.current.clear();
    },
    [],
  );
  useLayoutEffect(() => {
    if (screen !== 'table') {
      positions.current.clear();
      cardMotions.current.forEach((animation) => animation.cancel());
      cardMotions.current.clear();
      return;
    }
    {
      const next = new Map<string, DOMRect>();
      const stock = document.querySelector('.stock')?.getBoundingClientRect();
      const fresh = pendingDeal.current;
      const origin = fresh
        ? dealerDeckRef.current?.getBoundingClientRect() || stock
        : stock;
      const sequence = dealSequence.current;
      pendingDeal.current = false;
      const animations: Animation[] = [];
      // Finish all writes first, then measure every destination before starting motion.
      // Never cancel CSS hover/selection transitions or artwork reveal animations.
      cardMotions.current.forEach((animation) => animation.cancel());
      cardMotions.current.clear();
      const measured = Array.from(
        document.querySelectorAll<HTMLElement>('[data-card-id]'),
      ).map((el) => ({ el, rect: el.getBoundingClientRect() }));
      measured.forEach(({ el, rect }) => {
        const id = el.dataset.cardId!;
        let previous = positions.current.get(id);
        next.set(id, rect);
        if (!motionOff()) {
          if (fresh && origin && el.dataset.dealOrder) {
            const flight = el.animate(
              [
                {
                  transform: `translate3d(${origin.x + origin.width / 2 - rect.width / 2 - rect.x}px,${origin.y - rect.y}px,0) rotate(-4deg)`,
                  opacity: 0,
                },
                { opacity: 1, offset: 0.08 },
                {
                  transform: 'translate3d(0,0,0) rotate(0)',
                  opacity: 1,
                },
              ],
              {
                duration: 360,
                delay: 520 + Number(el.dataset.dealOrder) * 32,
                easing: 'cubic-bezier(.2,.8,.2,1)',
                fill: 'backwards',
              },
            );
            animations.push(flight);
            cardMotions.current.set(id, flight);
          } else {
            if (!previous && el.closest('.waste') && stock) previous = stock;
            if (previous) {
              const dx = previous.x - rect.x,
                dy = previous.y - rect.y;
              if (Math.abs(dx) + Math.abs(dy) > 0.5) {
                const flight = el.animate(
                  [
                    {
                      transform: `translate3d(${dx}px,${dy}px,0)`,
                      zIndex: 30,
                    },
                    { transform: 'translate3d(0,0,0)', zIndex: 30 },
                  ],
                  {
                    duration: el.closest('.waste')
                      ? 280
                      : Math.min(420, Math.max(260, Math.hypot(dx, dy) * 0.55)),
                    easing: 'cubic-bezier(.22,.68,.25,1)',
                    fill: 'backwards',
                  },
                );
                cardMotions.current.set(id, flight);
              }
            }
            if (
              previousFaces.current.get(id) === false &&
              el.dataset.face === 'true'
            ) {
              el.querySelector('.card-artwork')?.animate(
                [
                  {
                    transform: 'scaleX(.88)',
                    opacity: 0.65,
                  },
                  {
                    transform: 'scaleX(1)',
                    opacity: 1,
                  },
                ],
                { duration: 220, easing: 'cubic-bezier(.22,.68,.25,1)' },
              );
            }
          }
        }
        previousFaces.current.set(id, el.dataset.face === 'true');
      });
      positions.current = next;
      if (fresh) {
        const finishDeal = () => {
          if (sequence !== dealSequence.current) return;
          setDealerMode('bye');
          setDealing(false);
        };
        if (animations.length)
          void Promise.allSettled(animations.map((a) => a.finished)).then(
            finishDeal,
          );
        else {
          const hold = window.setTimeout(finishDeal, 800);
          return () => window.clearTimeout(hold);
        }
      }
    }
  }, [game, screen]);
  const agentState = useRef({ game });
  agentState.current = { game };
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'get_solitaire_hint',
            description:
              'Read the current solitaire position and return a legal suggested move without changing the game.',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute(input: unknown) {
              if (
                !input ||
                typeof input !== 'object' ||
                Object.keys(input).length
              )
                throw new Error('Expected an empty object');
              const g = agentState.current.game;
              if (!g) return { status: 'loading' };
              return {
                moves: g.moves,
                score: g.score,
                hint: availableMoves(g)[0] || null,
                stock: g.stock.length,
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const drag = useRef<{
    source: Source;
    x: number;
    y: number;
    px: number;
    py: number;
    rect: DOMRect;
    active: boolean;
    pointerId: number;
    offsets: number[];
    cards: Card[];
    indexSize: string;
  } | null>(null);
  const suppress = useRef(false),
    audio = useRef<AudioContext | null>(null);
  const [dragging, setDragging] = useState<{
    source: Source;
    rect: DOMRect;
    cards: Card[];
    offsets: number[];
    indexSize: string;
  } | null>(null);
  function resolveDrop(x: number, y: number): Target | null {
    const d = drag.current;
    if (!d || !game) return null;
    const direct = document
      .elementsFromPoint(x, y)
      .map((el) => el.closest<HTMLElement>('[data-target]'))
      .find(Boolean);
    if (direct) {
      const [kind, p] = direct.dataset.target!.split('-');
      const target = { kind: kind as Target['kind'], pile: Number(p) };
      return canMove(game, d.source, target) ? target : null;
    }
    let best: Target | null = null,
      bestArea = 0;
    const left = d.rect.x + x - d.x,
      top = d.rect.y + y - d.y;
    document.querySelectorAll<HTMLElement>('[data-target]').forEach((el) => {
      const [kind, p] = el.dataset.target!.split('-'),
        t = { kind: kind as Target['kind'], pile: Number(p) };
      if (!canMove(game, d.source, t)) return;
      const r = el.getBoundingClientRect();
      const area =
        Math.max(
          0,
          Math.min(left + d.rect.width, r.right) - Math.max(left, r.left),
        ) *
        Math.max(
          0,
          Math.min(top + d.rect.height, r.bottom) - Math.max(top, r.top),
        );
      if (area > bestArea && area > d.rect.width * d.rect.height * 0.2) {
        best = t;
        bestArea = area;
      }
    });
    return best;
  }
  function dragTick() {
    const d = drag.current;
    if (!d?.active) return;
    if (overlayRef.current)
      overlayRef.current.style.transform = `translate3d(${d.px - d.x}px,${d.py - d.y}px,0)`;
    const scroller = boardRef.current?.closest('.board-scroll');
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (d.py > r.bottom - 65) scroller.scrollTop += 8;
      else if (d.py < r.top + 95) scroller.scrollTop -= 8;
    }
    const t = resolveDrop(d.px, d.py);
    setDropTarget(t ? `${t.kind}-${t.pile}` : null);
    dragFrame.current = requestAnimationFrame(dragTick);
  }
  function finishDrag(cancel = false) {
    const d = drag.current;
    if (!d) return;
    cancelAnimationFrame(dragFrame.current);
    if (!d.active) {
      drag.current = null;
      return;
    }
    suppress.current = true;
    setDropTarget(null);
    const target = cancel ? null : resolveDrop(d.px, d.py);
    if (target && game) {
      d.cards.forEach((c, i) =>
        positions.current.set(
          c.id,
          new DOMRect(
            d.rect.x + d.px - d.x,
            d.rect.y + d.py - d.y + d.offsets[i],
            d.rect.width,
            d.rect.height,
          ),
        ),
      );
      const next = move(game, d.source, target);
      drag.current = null;
      setDragging(null);
      commit(next);
    } else {
      if (!cancel) feedback('invalid');
      const source = document
        .querySelector<HTMLElement>(`[data-card-id="${d.cards[0].id}"]`)
        ?.getBoundingClientRect();
      const animation =
        !modal && !motionOff()
          ? overlayRef.current?.animate(
              [
                { transform: `translate(${d.px - d.x}px,${d.py - d.y}px)` },
                {
                  transform: `translate(${(source?.x ?? d.rect.x) - d.rect.x}px,${(source?.y ?? d.rect.y) - d.rect.y}px)`,
                },
              ],
              {
                duration: 220,
                easing: 'cubic-bezier(.2,.8,.2,1)',
                fill: 'forwards',
              },
            )
          : null;
      drag.current = null;
      if (animation)
        void animation.finished.catch(() => {}).then(() => setDragging(null));
      else setDragging(null);
    }
    setSelected(null);
    setTimeout(() => {
      suppress.current = false;
    }, 80);
  }
  useEffect(() => {
    if (modal || screen !== 'table') finishDrag(true);
  }, [modal, screen]);
  useEffect(() => () => cancelAnimationFrame(dragFrame.current), []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('funda-game-v1') || 'null');
      if (saved?.game?.columns?.length === 7) {
        setGame({ ...saved.game, draw: 3 });
        setSeconds(saved.seconds || 0);
        setTheme(saved.theme || 'emerald');
        setSound(saved.sound ?? true);
        setHaptics(saved.haptics ?? true);
        setHasSaved(saved.started ?? saved.game.moves > 0);
        return;
      }
    } catch {}
    setGame(deal());
  }, []);
  useEffect(() => {
    if (game)
      try {
        localStorage.setItem(
          'funda-game-v1',
          JSON.stringify({
            game,
            seconds,
            theme,
            sound,
            haptics,
            started: hasSaved,
          }),
        );
      } catch {}
  }, [game, seconds, theme, sound, haptics, hasSaved]);
  useEffect(() => {
    if (!game || screen !== 'table' || modal || dealing || won(game)) return;
    const timer = setInterval(() => {
      if (!document.hidden) setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [!!game, screen, modal, dealing, game && won(game)]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(
      () => setMessage(''),
      dealerMode === 'hint' ? 10000 : 3500,
    );
    return () => clearTimeout(t);
  }, [message, dealerMode, hintVisit]);
  function feedback(
    kind:
      | 'draw'
      | 'move'
      | 'foundation'
      | 'undo'
      | 'hint'
      | 'deal'
      | 'invalid'
      | 'win',
    preview = false,
  ) {
    const patterns: Record<typeof kind, number | number[]> = {
      draw: 12,
      move: 18,
      foundation: [18, 35, 18],
      undo: 12,
      hint: [10, 40, 10],
      deal: 20,
      invalid: [12, 35, 12],
      win: [30, 60, 30, 60, 70],
    };
    if (haptics && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(patterns[kind]);
      } catch {}
    }
    if (!sound && !preview) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const notes: Record<typeof kind, number[]> = {
        draw: [420, 620],
        move: [520],
        foundation: [660, 880],
        undo: [520, 390],
        hint: [740, 988],
        deal: [320, 420, 520],
        invalid: [180],
        win: [523, 659, 784, 1047],
      };
      notes[kind].forEach((frequency, index) => {
        const context = audio.current!;
        const start =
          context.currentTime + index * (kind === 'win' ? 0.13 : 0.045);
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type =
          kind === 'draw' || kind === 'deal' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 0.8,
          start + 0.09,
        );
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.045, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.15);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      });
    } catch {}
  }
  function commit(next: Game | null, effect: 'draw' | 'move' = 'move') {
    if (!next || !game || dealing) return false;
    captureCardPositions();
    setHistory((h) => [...h.slice(-99), game]);
    setGame(next);
    setDealerMode('none');
    setMessage('');
    setSelected(null);
    setHint(null);
    feedback(
      won(next)
        ? 'win'
        : next.foundations.some((p, i) => p.length > game.foundations[i].length)
          ? 'foundation'
          : effect,
    );
    return true;
  }
  function attempt(source: Source, target: Target) {
    if (autoCompleting) return false;
    return game ? commit(move(game, source, target)) : false;
  }
  function cardClick(source: Source) {
    if (!game || suppress.current || dealing || dragging) return;
    const suggestion = hintMove.current;
    if (
      suggestion &&
      suggestion.source.kind === source.kind &&
      suggestion.source.pile === source.pile &&
      suggestion.source.index === source.index &&
      attempt(source, suggestion.target)
    )
      return;
    if (
      selected &&
      source.kind !== 'waste' &&
      attempt(selected, { kind: source.kind, pile: source.pile })
    )
      return;
    setSelected(source);
    const c = pile(game, source)[source.index];
    if (
      source.index === pile(game, source).length - 1 &&
      attempt(source, { kind: 'foundations', pile: c.suit })
    )
      return;
    const destination = availableMoves(game).find(
      ({ source: candidate, target }) =>
        candidate.kind === source.kind &&
        candidate.pile === source.pile &&
        candidate.index === source.index &&
        target.kind === 'columns',
    );
    if (destination) attempt(source, destination.target);
  }
  async function restart() {
    if (preparingRef.current) return;
    preparingRef.current = true;
    setPreparing(true);
    setLoadFailed(false);
    // Unlock audio in the tap handler; playback starts after the artwork is ready.
    if (sound)
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {}
    try {
      await warmArtwork();
    } catch {
      artworkReady.current = null;
      preparingRef.current = false;
      setPreparing(false);
      setLoadFailed(true);
      return;
    }
    preparingRef.current = false;
    setPreparing(false);
    setAutoCompleting(false);
    feedback('deal');
    dealSequence.current++;
    setDealerMode('deal');
    pendingDeal.current = true;
    setDealing(true);
    positions.current.clear();
    previousFaces.current.clear();
    setGame(deal());
    setHistory([]);
    setSeconds(0);
    setSelected(null);
    setModal('');
    setHint(null);
    setMessage('');
    setHasSaved(true);
    setScreen('table');
  }
  function undo() {
    if (game && history.length && !dealing && !autoCompleting && !dragging) {
      captureCardPositions();
      feedback('undo');
      setDealerMode('none');
      setGame(history.at(-1)!);
      setHistory((h) => h.slice(0, -1));
      setSelected(null);
      setHint(null);
      setMessage('');
    }
  }
  function resume() {
    setDealerMode('none');
    setScreen('table');
    setModal('');
    setSelected(null);
    setHint(null);
    setMessage('');
    setHasSaved(true);
  }
  function goHome() {
    setDealerMode('none');
    setScreen('start');
    setModal('');
    setSelected(null);
    setMessage('');
  }
  function showHint() {
    if (!game || dealing || autoCompleting || dragging) return;
    feedback('hint');
    setDealerMode('hint');
    setHintVisit((v) => v + 1);
    const m = bestHint(game, history);
    if (m) {
      hintMove.current = m;
      const c = pile(game, m.source)[m.source.index];
      const sourceEl = document.querySelector<HTMLElement>(
        `[data-card-id="${c.id}"]`,
      );
      const targetEl = document.querySelector<HTMLElement>(
        `[data-target="${m.target.kind}-${m.target.pile}"]`,
      );
      if (sourceEl && targetEl) {
        sourceEl.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        const rect = sourceEl.getBoundingClientRect();
        const target = targetEl.getBoundingClientRect();
        const last = game[m.target.kind][m.target.pile].at(-1);
        const lastRect =
          last &&
          document
            .querySelector<HTMLElement>(`[data-card-id="${last.id}"]`)
            ?.getBoundingClientRect();
        const cards = pile(game, m.source).slice(m.source.index);
        setHintPreview({
          cards,
          rect,
          offsets: cards.map(
            (card) =>
              (document
                .querySelector<HTMLElement>(`[data-card-id="${card.id}"]`)
                ?.getBoundingClientRect().y ?? rect.y) - rect.y,
          ),
          dx: target.x - rect.x,
          dy:
            (m.target.kind === 'columns' && lastRect
              ? lastRect.y + spacing.up
              : target.y) - rect.y,
        });
        setHintPointer({
          x: rect.x + rect.width * 0.6,
          y: rect.y + Math.min(spacing.up, rect.height * 0.3),
        });
      }
      setSelected(m.source);
      setHint(`${m.target.kind}-${m.target.pile}`);
      setMessage(
        `Tap ${ranks[c.rank]}${suits[c.suit]} to move it to ${m.target.kind === 'foundations' ? 'the matching top pile' : `column ${m.target.pile + 1}`}.`,
      );
    } else {
      hintMove.current = null;
      setHintPreview(null);
      setHint(null);
      setSelected(null);
      const stock = document.querySelector('.stock')?.getBoundingClientRect();
      setHintPointer(
        stock && (game.stock.length || game.waste.length)
          ? { x: stock.x + stock.width * 0.6, y: stock.y + stock.height * 0.4 }
          : null,
      );
      setMessage(
        game.stock.length
          ? 'Tap the deck on the right for more cards.'
          : game.waste.length
            ? 'Tap the empty deck on the right to use the cards again.'
            : 'No moves left. Tap Undo or start a new game.',
      );
    }
  }
  function autoFinish() {
    if (!game) return;
    setAutoCompleting(true);
  }
  function renderCard(
    c: Card,
    source: Source,
    style?: React.CSSProperties,
    covered = false,
  ) {
    const active =
      selected?.kind === source.kind &&
      selected.pile === source.pile &&
      source.index >= selected.index;
    const lifted =
      dragging &&
      dragging.source.kind === source.kind &&
      dragging.source.pile === source.pile &&
      source.index >= dragging.source.index;
    return (
      <button
        key={c.id}
        data-card-id={c.id}
        data-face={c.up}
        data-deal-order={
          source.kind === 'columns'
            ? (source.index * (15 - source.index)) / 2 +
              source.pile -
              source.index
            : undefined
        }
        disabled={dealing || autoCompleting || covered}
        aria-pressed={!!active}
        className={`playing-card ${red(c) ? 'red' : ''} ${c.up ? 'face' : 'back'} ${covered ? 'waste-preview' : ''} ${active ? 'selected' : ''} ${lifted ? 'drag-source' : ''}`}
        style={style}
        aria-label={
          c.up
            ? `${ranks[c.rank]} of ${['spades', 'hearts', 'clubs', 'diamonds'][c.suit]}`
            : 'Face-down card'
        }
        onClick={(e) => {
          e.stopPropagation();
          if (c.up) cardClick(source);
        }}
        onPointerDown={(e) => {
          if (
            !c.up ||
            !game ||
            dealing ||
            dragging ||
            e.button !== 0 ||
            !e.isPrimary
          )
            return;
          const cards = pile(game, source).slice(source.index),
            rect = e.currentTarget.getBoundingClientRect();
          const offsets = cards.map((card) => {
            const el = document.querySelector<HTMLElement>(
              `[data-card-id="${card.id}"]`,
            );
            return (el?.getBoundingClientRect().y ?? rect.y) - rect.y;
          });
          drag.current = {
            source,
            x: e.clientX,
            y: e.clientY,
            px: e.clientX,
            py: e.clientY,
            rect,
            active: false,
            pointerId: e.pointerId,
            cards,
            offsets,
            indexSize: getComputedStyle(
              e.currentTarget.querySelector('.corner')!,
            ).fontSize,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.pointerId !== e.pointerId) return;
          d.px = e.clientX;
          d.py = e.clientY;
          if (!d.active && Math.hypot(d.px - d.x, d.py - d.y) > 6) {
            d.active = true;
            setHintPreview(null);
            setHintPointer(null);
            hintMove.current = null;
            setSelected(null);
            setHint(null);
            setDragging({
              source: d.source,
              rect: d.rect,
              cards: d.cards,
              offsets: d.offsets,
              indexSize: d.indexSize,
            });
            dragFrame.current = requestAnimationFrame(dragTick);
          }
        }}
        onPointerCancel={(e) => {
          if (drag.current?.pointerId === e.pointerId) finishDrag(true);
        }}
        onLostPointerCapture={() => {
          if (drag.current) finishDrag(true);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d && d.pointerId === e.pointerId) {
            d.px = e.clientX;
            d.py = e.clientY;
            finishDrag();
          }
        }}
      >
        {c.up ? <CardArtwork card={c} /> : <CardBack />}
      </button>
    );
  }
  const victory = screen === 'table' && !!game && won(game) && victoryReady;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <main
      className={`app theme-${theme} ${screen === 'table' ? 'in-game' : 'at-home'}`}
    >
      {screen === 'start' ? (
        <section
          className="start-screen"
          aria-label="Funda Solataire start screen"
        >
          <header className="home-header">
            <img
              className="home-wordmark"
              src="/funda-logo-gold.png"
              alt="Funda"
              draggable={false}
            />
            <Button
              variant="ghost"
              className="icon-button"
              aria-label="Settings"
              onClick={() => setModal('settings')}
            >
              <Settings2 />
            </Button>
          </header>
          <div className="home-stage">
            <div className="home-title">
              <span className="lobby-brand">FUNDA</span>
              <h1>SOLITAIRE</h1>
            </div>
            <div className="lobby-hero">
              <div className="lobby-composite">
                <img
                  className="lobby-portrait"
                  src="/dealer/start-screen-wide.png"
                  alt="Tina dealing Funda cards at the solitaire table"
                  width={1330}
                  height={1182}
                  fetchPriority="high"
                  draggable={false}
                />
                <svg
                  className="lobby-card-print"
                  viewBox="0 0 1330 1182"
                  aria-hidden="true"
                >
                  <defs>
                    <clipPath id="lobby-dealt-card">
                      <path d="M517 800 L523 800 C522 815 531 824 544 819 L553 800 L609 798 L621 927 L490 931 Z" />
                    </clipPath>
                    <clipPath id="lobby-held-deck">
                      <path d="M766 773 L834 754 L854 783 C850 798 861 811 874 802 L879 812 L800 840 Z" />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#lobby-dealt-card)">
                    <ProjectedCard
                      id="dealt-print"
                      projection={[
                        0.187127285, -0.225466943, 517, 0.005842433, -0.1910174,
                        800, 0.000012216, -0.000388389,
                      ]}
                    />
                  </g>
                  <g clipPath="url(#lobby-held-deck)">
                    <ProjectedCard
                      id="held-print"
                      projection={[
                        0.245179706, -0.141702863, 766, 0.064479202,
                        -0.108032798, 773, 0.000134733, -0.000232467,
                      ]}
                    />
                  </g>
                </svg>
              </div>
            </div>
            <div className="home-play">
              <Button
                className="primary-action home-start"
                disabled={!game || preparing}
                aria-busy={preparing}
                onClick={() => restart()}
              >
                <svg
                  className="home-cards-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="4"
                    width="12"
                    height="16"
                    rx="2"
                    transform="rotate(-12 9 12)"
                  />
                  <rect
                    x="9"
                    y="3"
                    width="12"
                    height="17"
                    rx="2"
                    fill="#ffda7b"
                  />
                  <path
                    d="m15 8 3 4-3 4-3-4Z"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
                <span>
                  {preparing
                    ? 'Getting ready…'
                    : loadFailed
                      ? 'Try Again'
                      : 'Start New Game'}
                </span>
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section
          className={`play-screen ${dealing ? 'dealer-present' : 'table-expanded'}`}
          aria-label="Solitaire table"
        >
          <header className="play-header">
            <div className="header-stats">
              <div>
                <small>SCORE</small>
                <strong className="stat-bump" key={game?.score}>
                  {game?.score || 0}
                </strong>
              </div>
              <div>
                <small>TIME</small>
                <strong>{clock}</strong>
              </div>
              <div>
                <small>MOVES</small>
                <strong>{game?.moves || 0}</strong>
              </div>
            </div>
          </header>
          <div
            className={`dealer-stage ${modal ? 'table-obscured' : ''}`}
            aria-hidden={!dealing}
          >
            <Dealer
              key={dealSequence.current}
              mode="deal"
              deckRef={dealerDeckRef}
            />
          </div>
          <div className={`table ${modal ? 'table-obscured' : ''}`}>
            <div className="table-rail" aria-hidden="true" />
            <div className="board-scroll">
              <div
                className={`board ${dealing ? 'is-dealing' : ''}`}
                ref={boardRef}
              >
                <div className="top-piles">
                  <div className="foundations">
                    {suits.map((s, i) => (
                      <div
                        key={s}
                        data-target={`foundations-${i}`}
                        data-filled={!!game?.foundations[i].length}
                        data-complete={game?.foundations[i].length === 13}
                        role="button"
                        tabIndex={0}
                        aria-label={`${['Spades', 'Hearts', 'Clubs', 'Diamonds'][i]} foundation`}
                        onKeyDown={(e) => {
                          if (
                            (e.key === 'Enter' || e.key === ' ') &&
                            selected
                          ) {
                            e.preventDefault();
                            attempt(selected, { kind: 'foundations', pile: i });
                          }
                        }}
                        className={`slot foundation ${dropTarget === `foundations-${i}` ? 'drop-ready' : ''} ${hint === `foundations-${i}` ? 'hint' : ''}`}
                        onClick={() =>
                          selected &&
                          attempt(selected, { kind: 'foundations', pile: i })
                        }
                      >
                        <span className="empty-suit">{s}</span>
                        {game?.foundations[i].at(-1) &&
                          renderCard(game.foundations[i].at(-1)!, {
                            kind: 'foundations',
                            pile: i,
                            index: game.foundations[i].length - 1,
                          })}
                      </div>
                    ))}
                  </div>
                  <div className="pile-group">
                    <div className="stock-wrap">
                      <button
                        className={`stock slot ${game?.stock.length ? 'back' : ''}`}
                        disabled={dealing || autoCompleting || !!dragging}
                        aria-label={
                          game?.stock.length ? 'Draw next card' : 'Recycle deck'
                        }
                        onClick={() => game && commit(drawCards(game), 'draw')}
                      >
                        {game?.stock.length ? <CardBack /> : <RotateCcw />}
                      </button>
                      <small>{game?.stock.length || 0}</small>
                    </div>
                    <div
                      className="waste"
                      role="group"
                      aria-label="Last three drawn cards; rightmost card is playable"
                    >
                      {game?.waste.slice(-3).map((c, i, visible) => (
                        <div
                          className="waste-card slot"
                          key={c.id}
                          style={{ '--waste-index': i } as React.CSSProperties}
                        >
                          {renderCard(
                            c,
                            {
                              kind: 'waste',
                              pile: 0,
                              index: game.waste.length - visible.length + i,
                            },
                            undefined,
                            i !== visible.length - 1,
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="tableau">
                  {(game?.columns || Array.from({ length: 7 }, () => [])).map(
                    (cards, i) => (
                      <div
                        key={i}
                        data-target={`columns-${i}`}
                        role="group"
                        aria-label={`Column ${i + 1}`}
                        className={`column ${dropTarget === `columns-${i}` ? 'drop-ready' : ''} ${hint === `columns-${i}` ? 'hint' : ''}`}
                        style={{
                          minHeight: `calc(var(--card-h) + ${cards.reduce((n, c, j) => n + (j < cards.length - 1 ? (c.up ? spacing.up : spacing.down) : 0), 0)}px)`,
                        }}
                        onClick={(e) => {
                          if (e.target === e.currentTarget && selected)
                            attempt(selected, { kind: 'columns', pile: i });
                        }}
                      >
                        {!cards.length && (
                          <button
                            className="column-empty"
                            aria-label={`Move to empty column ${i + 1}`}
                            onClick={() =>
                              selected &&
                              attempt(selected, { kind: 'columns', pile: i })
                            }
                          >
                            K
                          </button>
                        )}
                        {cards.map((c, j) =>
                          renderCard(
                            c,
                            { kind: 'columns', pile: i, index: j },
                            {
                              top: cards
                                .slice(0, j)
                                .reduce(
                                  (n, c) =>
                                    n + (c.up ? spacing.up : spacing.down),
                                  0,
                                ),
                              zIndex: j + 1,
                            },
                          ),
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
            <div
              className={`table-toast ${message ? 'visible' : ''}`}
              role="status"
            >
              {message}
            </div>
            {game &&
              game.stock.length === 0 &&
              game.waste.length === 0 &&
              game.columns.every((p) => p.every((c) => c.up)) &&
              !won(game) && (
                <Button
                  className="finish-button"
                  onClick={autoFinish}
                  disabled={autoCompleting}
                >
                  <Sparkles /> {autoCompleting ? 'Finishing…' : 'Finish game'}
                </Button>
              )}
          </div>
          <nav className="bottom-bar" aria-label="Game controls">
            <Button variant="ghost" onClick={() => setModal('help')}>
              <CircleHelp />
              <span>How to play</span>
            </Button>
            <Button
              variant="ghost"
              onClick={undo}
              disabled={
                !history.length || dealing || autoCompleting || !!dragging
              }
            >
              <Undo2 />
              <span>Undo</span>
            </Button>
            <Button
              variant="ghost"
              onClick={showHint}
              disabled={dealing || autoCompleting || !!dragging}
            >
              <Lightbulb />
              <span>Hint</span>
            </Button>
            <Button variant="ghost" onClick={() => setModal('pause')}>
              <Pause />
              <span>Pause</span>
            </Button>
          </nav>
        </section>
      )}
      <Dialog
        open={!!modal || victory}
        onOpenChange={(open) => {
          if (!open) setModal('');
        }}
      >
        <DialogContent
          className={`game-dialog theme-${theme} ${modal === 'pause' || victory ? 'pause-dialog' : ''}`}
          showCloseButton={!victory}
        >
          {(modal === 'pause' || victory) && (
            <div className="pause-emblem">
              {victory ? <Trophy /> : <Pause />}
            </div>
          )}
          <DialogTitle>
            {victory
              ? 'You won!'
              : modal === 'settings'
                ? 'Settings'
                : modal === 'help'
                  ? 'How to play'
                  : modal === 'pause'
                    ? 'Game paused'
                    : 'Start a new game?'}
          </DialogTitle>
          <DialogDescription>
            {victory
              ? 'Well done! You finished the game.'
              : modal === 'new'
                ? 'Your current game will be replaced.'
                : modal === 'pause'
                  ? 'Tap Continue to play again.'
                  : modal === 'settings'
                    ? screen === 'table'
                      ? 'Your game is paused.'
                      : 'Choose your sound and vibration settings.'
                    : 'Move cards to the four top piles. Start with Ace and end with King.'}
          </DialogDescription>
          {(modal === 'pause' || victory) && (
            <div className="pause-stats">
              <div>
                <small>SCORE</small>
                <strong className="stat-bump" key={game?.score}>
                  {game?.score || 0}
                </strong>
              </div>
              <div>
                <small>TIME</small>
                <strong>{clock}</strong>
              </div>
              <div>
                <small>MOVES</small>
                <strong>{game?.moves || 0}</strong>
              </div>
            </div>
          )}
          {modal === 'help' && (
            <div className="rules">
              <p>
                <strong>Put a smaller card on a bigger card.</strong> Use the
                other color. For example, put a red 6 on a black 7. Only a King
                can go in an empty space.
              </p>
              <p>
                <strong>Fill the four top piles.</strong> Start each pile with
                an Ace. Add 2, 3, 4 and so on, up to King. Match the suit symbol
                in each pile.
              </p>
              <p>
                <strong>Tap or drag a card to move it.</strong> Tap the deck on
                the right to see 3 more cards. You can use the top card. Tap
                Hint if you need help, or Undo to take back a move.
              </p>
            </div>
          )}
          {modal === 'settings' && (
            <>
              <div className="setting-row">
                <div>
                  <strong>Sound effects</strong>
                  <small>Sounds for cards, hints and wins</small>
                </div>
                <Button
                  variant="ghost"
                  className={`sound-toggle ${sound ? 'enabled' : ''}`}
                  aria-label="Sound effects"
                  aria-pressed={sound}
                  onClick={() => {
                    setSound(!sound);
                    if (!sound) feedback('foundation', true);
                  }}
                >
                  {sound ? <Volume2 /> : <VolumeX />}
                  {sound ? 'On' : 'Off'}
                </Button>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Vibrations</strong>
                  <small>Feel a small tap when you play</small>
                </div>
                <Button
                  variant="ghost"
                  className={`sound-toggle ${haptics ? 'enabled' : ''}`}
                  aria-label="Vibrations"
                  aria-pressed={haptics}
                  onClick={() => {
                    setHaptics(!haptics);
                    if (!haptics && typeof navigator.vibrate === 'function') {
                      try {
                        navigator.vibrate(18);
                      } catch {}
                    }
                  }}
                >
                  <Vibrate /> {haptics ? 'On' : 'Off'}
                </Button>
              </div>
              <div className="menu-actions">
                <Button variant="ghost" onClick={() => setModal('help')}>
                  <CircleHelp /> How to play <ArrowRight />
                </Button>
                {screen === 'table' && (
                  <>
                    <Button variant="ghost" onClick={() => setModal('new')}>
                      <Shuffle /> New game <ArrowRight />
                    </Button>
                    <Button variant="ghost" onClick={goHome}>
                      <HomeIcon /> Home <ArrowRight />
                    </Button>
                  </>
                )}
              </div>
              <Button className="primary-action" onClick={() => setModal('')}>
                {screen === 'table' ? (
                  <>
                    <Play /> Continue
                  </>
                ) : (
                  'Done'
                )}
              </Button>
            </>
          )}
          {(modal === 'new' || victory) && (
            <div className="new-options">
              <Button className="primary-action" onClick={() => restart()}>
                <Shuffle /> {victory ? 'Play Again' : 'Start Game'}{' '}
                <ArrowRight />
              </Button>
              {!victory && (
                <Button variant="ghost" onClick={() => setModal('')}>
                  Go back
                </Button>
              )}
            </div>
          )}
          {modal === 'pause' && (
            <>
              <Button className="primary-action" onClick={() => setModal('')}>
                <Play fill="currentColor" /> Continue
              </Button>
              <div className="pause-links">
                <Button
                  className="pause-action"
                  onClick={restart}
                  disabled={preparing}
                >
                  <Shuffle /> {preparing ? 'Getting ready…' : 'New game'}
                </Button>
                <Button className="pause-action" onClick={goHome}>
                  <HomeIcon /> Home
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {hintPreview &&
        !modal &&
        screen === 'table' &&
        createPortal(
          <div
            className="hint-flight"
            aria-hidden="true"
            key={hintVisit}
            style={
              {
                left: hintPreview.rect.x,
                top: hintPreview.rect.y,
                width: hintPreview.rect.width,
                '--hint-dx': `${hintPreview.dx}px`,
                '--hint-dy': `${hintPreview.dy}px`,
              } as React.CSSProperties
            }
          >
            {hintPreview.cards.map((card, index) => (
              <div
                key={card.id}
                className={`playing-card face ${red(card) ? 'red' : ''}`}
                style={{
                  position: 'absolute',
                  top: hintPreview.offsets[index],
                  width: hintPreview.rect.width,
                  height: hintPreview.rect.height,
                }}
              >
                <CardArtwork card={card} />
              </div>
            ))}
          </div>,
          document.body,
        )}
      {hintPointer &&
        !modal &&
        screen === 'table' &&
        createPortal(
          <div
            className="hint-tap-pointer"
            aria-hidden="true"
            style={{ left: hintPointer.x, top: hintPointer.y }}
          >
            <span>👆</span>
          </div>,
          document.body,
        )}
      {dragging &&
        createPortal(
          <div
            ref={overlayRef}
            className="drag-layer"
            aria-hidden="true"
            style={
              {
                left: dragging.rect.x,
                top: dragging.rect.y,
                width: dragging.rect.width,
                height: dragging.rect.height + dragging.offsets.at(-1)!,
                '--card-h': `${dragging.rect.height}px`,
                '--drag-index': dragging.indexSize,
              } as React.CSSProperties
            }
          >
            {dragging.cards.map((c, i) => (
              <div
                key={c.id}
                className={`playing-card face ${red(c) ? 'red' : ''}`}
                style={{ top: dragging.offsets[i], zIndex: i + 1 }}
              >
                <CardArtwork card={c} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </main>
  );
}
