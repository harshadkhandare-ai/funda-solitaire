export type Card = { id: string; suit: number; rank: number; up: boolean };
export type Game = {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  columns: Card[][];
  moves: number;
  score: number;
  draw: number;
};
export type Source = {
  kind: 'waste' | 'columns' | 'foundations';
  pile: number;
  index: number;
};
export type Target = { kind: 'columns' | 'foundations'; pile: number };
export const suits = ['♠', '♥', '♣', '♦'];
export const ranks = [
  '',
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];
export const red = (c: Card) => c.suit % 2 === 1;
export function deal(): Game {
  const cards: Card[] = suits.flatMap((_, suit) =>
    Array.from({ length: 13 }, (_, i) => ({
      id: `${suit}-${i + 1}`,
      suit,
      rank: i + 1,
      up: false,
    })),
  );
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  const columns = Array.from({ length: 7 }, (_, i) =>
    cards.splice(0, i + 1).map((c, j) => ({ ...c, up: j === i })),
  );
  return {
    stock: cards,
    waste: [],
    foundations: [[], [], [], []],
    columns,
    moves: 0,
    score: 0,
    draw: 3,
  };
}
export function pile(g: Game, s: Source): Card[] {
  return s.kind === 'waste' ? g.waste : g[s.kind][s.pile];
}
export function canMove(g: Game, s: Source, t: Target): boolean {
  if (s.kind === t.kind && s.pile === t.pile) return false;
  const from = pile(g, s),
    moving = from.slice(s.index),
    c = moving[0],
    dest = g[t.kind][t.pile],
    last = dest.at(-1);
  if (!c || !c.up || s.index < 0) return false;
  if (s.kind !== 'columns' && s.index !== from.length - 1) return false;
  if (
    moving.some(
      (x, i) =>
        !x.up ||
        (i > 0 &&
          (moving[i - 1].rank !== x.rank + 1 || red(moving[i - 1]) === red(x))),
    )
  )
    return false;
  if (t.kind === 'foundations')
    return (
      moving.length === 1 &&
      c.suit === t.pile &&
      c.rank === (last ? last.rank + 1 : 1)
    );
  return last
    ? last.up && last.rank === c.rank + 1 && red(last) !== red(c)
    : c.rank === 13;
}
export function move(g: Game, s: Source, t: Target): Game | null {
  if (!canMove(g, s, t)) return null;
  const n = structuredClone(g),
    from = pile(n, s),
    cards = from.splice(s.index);
  n[t.kind][t.pile].push(...cards);
  n.moves++;
  if (t.kind === 'foundations') n.score += 10;
  if (s.kind === 'foundations') n.score = Math.max(0, n.score - 10);
  if (from.length && !from.at(-1)!.up) {
    from.at(-1)!.up = true;
    n.score += 5;
  }
  return n;
}
export function drawCards(g: Game): Game | null {
  if (!g.stock.length && !g.waste.length) return null;
  const n = structuredClone(g);
  n.draw = 3;
  n.moves++;
  if (!n.stock.length) {
    n.stock = n.waste.reverse().map((c) => ({ ...c, up: false }));
    n.waste = [];
  } else {
    // Reveal one per tap; the table displays the latest three waste cards.
    n.waste.push({ ...n.stock.pop()!, up: true });
  }
  return n;
}
export function availableMoves(g: Game) {
  const sources: Source[] = [];
  if (g.waste.length)
    sources.push({ kind: 'waste', pile: 0, index: g.waste.length - 1 });
  g.columns.forEach((p, i) =>
    p.forEach((c, j) => {
      if (c.up) sources.push({ kind: 'columns', pile: i, index: j });
    }),
  );
  const moves: { source: Source; target: Target }[] = [];
  for (const source of sources)
    for (const kind of ['foundations', 'columns'] as const)
      for (let i = 0; i < (kind === 'columns' ? 7 : 4); i++) {
        const target = { kind, pile: i };
        if (
          canMove(g, source, target) &&
          !(
            kind === 'columns' &&
            !g.columns[i].length &&
            source.kind === 'columns' &&
            source.index === 0
          )
        )
          moves.push({ source, target });
      }
  return moves;
}
export const won = (g: Game) => g.foundations.every((p) => p.length === 13);

// Counters do not affect the board; column order does not make a new position.
export function boardKey(g: Game): string {
  const cards = (p: Card[]) =>
    p.map((c) => `${c.id}:${Number(c.up)}`).join(',');
  return JSON.stringify([
    cards(g.stock),
    cards(g.waste),
    g.foundations.map(cards),
    g.columns.map(cards).sort(),
  ]);
}
export function bestHint(g: Game, history: Game[] = []) {
  const visited = new Set([...history, g].map(boardKey));
  const progressMoves = (board: Game) =>
    new Set(
      availableMoves(board)
        .filter(
          ({ source, target }) =>
            target.kind === 'foundations' ||
            (source.kind === 'columns' &&
              source.index > 0 &&
              !pile(board, source)[source.index - 1].up),
        )
        .map(
          ({ source, target }) =>
            `${pile(board, source)[source.index].id}:${target.kind}:${board[target.kind][target.pile].at(-1)?.id || 'empty'}`,
        ),
    );
  const currentProgress = progressMoves(g);
  return (
    availableMoves(g)
      .map((candidate) => {
        const next = move(g, candidate.source, candidate.target)!;
        const from = pile(g, candidate.source);
        const reveals =
          candidate.source.kind === 'columns' &&
          candidate.source.index > 0 &&
          !from[candidate.source.index - 1].up;
        const score =
          candidate.target.kind === 'foundations'
            ? 100
            : reveals
              ? 80
              : candidate.source.kind === 'waste'
                ? 60
                : 10;
        return { ...candidate, next, score };
      })
      .filter(
        ({ next, score }) =>
          !visited.has(boardKey(next)) &&
          (score > 10 ||
            [...progressMoves(next)].some((key) => !currentProgress.has(key))),
      )
      .sort((a, b) => b.score - a.score)[0] || null
  );
}
