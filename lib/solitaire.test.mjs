import { strict as assert } from 'node:assert';
import {
  deal,
  drawCards,
  move,
  availableMoves,
  won,
  bestHint,
  boardKey,
} from './solitaire.ts';
const c = (rank, suit, up = true) => ({
  id: `${suit}-${rank}`,
  rank,
  suit,
  up,
});
for (let n = 0; n < 100; n++) {
  const g = deal();
  assert.equal(
    new Set([...g.stock, ...g.columns.flat()].map((c) => c.id)).size,
    52,
  );
  assert.equal(g.stock.length, 24);
  assert.equal(g.waste.length, 0);
  assert.ok(g.stock.every((card) => !card.up));
  g.columns.forEach((p, i) => {
    assert.equal(p.length, i + 1);
    assert.equal(p.filter((c) => c.up).length, 1);
  });
}
let g = deal(),
  original = g.stock.map((c) => c.id);
g = drawCards(g);
assert.equal(g.waste.length, 1);
assert.equal(g.stock.length, 23);
while (g.stock.length) g = drawCards(g);
g = drawCards(g);
assert.deepEqual(
  g.stock.map((c) => c.id),
  original,
);
assert.ok(g.stock.every((c) => !c.up));
g = {
  stock: [],
  waste: [c(1, 1)],
  foundations: [[], [], [], []],
  columns: [[c(7, 0), c(6, 1)], [c(8, 1)], [c(13, 0)], [], [], [], []],
  moves: 0,
  score: 0,
  draw: 1,
};
assert.equal(
  move(g, { kind: 'columns', pile: 0, index: 0 }, { kind: 'columns', pile: 1 })
    .columns[1].length,
  3,
);
assert.equal(
  move(g, { kind: 'columns', pile: 0, index: 1 }, { kind: 'columns', pile: 3 }),
  null,
);
assert.equal(
  move(g, { kind: 'columns', pile: 2, index: 0 }, { kind: 'columns', pile: 3 })
    .columns[3][0].rank,
  13,
);
assert.equal(
  move(
    g,
    { kind: 'waste', pile: 0, index: 0 },
    { kind: 'foundations', pile: 0 },
  ),
  null,
);
let next = move(
  g,
  { kind: 'waste', pile: 0, index: 0 },
  { kind: 'foundations', pile: 1 },
);
assert.equal(next.score, 10);
assert.equal(next.moves, 1);
assert.equal(g.waste.length, 1);
g.columns[0] = [c(9, 0, false), c(1, 0)];
next = move(
  g,
  { kind: 'columns', pile: 0, index: 1 },
  { kind: 'foundations', pile: 0 },
);
assert.equal(next.columns[0][0].up, true);
assert.equal(next.score, 15);
assert.ok(availableMoves(g).length);
assert.equal(won(g), false);
console.log(
  'Solitaire rules passed: 100 deals, deck recycling, sequences, kings, foundations, score, immutability, reveal, hints.',
);

const legacy = deal();
legacy.draw = 1;
assert.equal(drawCards(legacy).waste.length, 1);
assert.equal(drawCards(legacy).draw, 3);
assert.equal(deal().draw, 3);
console.log('Three-card window defaults and legacy-game migration passed.');

// A rolling window reveals one card each tap without discarding older cards.
const start = deal(),
  order = start.stock.map((c) => c.id).reverse();
let rolling = start;
for (let tap = 1; tap <= 24; tap++) {
  const before = rolling;
  rolling = drawCards(rolling);
  assert.equal(rolling.stock.length, 24 - tap);
  assert.equal(rolling.waste.length, tap);
  assert.deepEqual(
    rolling.waste.slice(-3).map((c) => c.id),
    order.slice(Math.max(0, tap - 3), tap),
  );
  assert.equal(before.stock.length, 25 - tap);
  assert.equal(rolling.moves, tap);
}
const recycled = drawCards(rolling);
assert.equal(recycled.waste.length, 0);
assert.deepEqual(recycled.stock, start.stock);
assert.equal(drawCards(recycled).waste[0].id, order[0]);
assert.equal(drawCards({ ...start, stock: [], waste: [] }), null);
console.log(
  'Single-tap reveal, rolling three-card window, immutability and full recycling passed.',
);

const loopBoard = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  columns: [[c(4, 0)], [c(5, 1)], [c(5, 3)], [], [], [], []],
  moves: 0,
  score: 0,
  draw: 3,
};
assert.equal(
  bestHint(loopBoard),
  null,
  'Skip moves that only shuffle exposed cards',
);
const afterHint = move(
  loopBoard,
  { kind: 'columns', pile: 0, index: 0 },
  { kind: 'columns', pile: 1 },
);
assert.equal(
  bestHint(afterHint, [loopBoard]),
  null,
  'Do not shuttle the same card between equivalent stacks',
);
assert.equal(
  boardKey(loopBoard),
  boardKey({
    ...loopBoard,
    moves: 99,
    score: 20,
    columns: [...loopBoard.columns].reverse(),
  }),
);
const foundationBoard = { ...loopBoard, waste: [c(1, 1)] };
assert.equal(bestHint(foundationBoard).target.kind, 'foundations');
const revealBoard = {
  ...loopBoard,
  columns: [
    [c(9, 3, false), c(4, 0)],
    [c(5, 1)],
    [c(2, 0)],
    [c(3, 1)],
    [],
    [],
    [],
  ],
};
assert.equal(
  bestHint(revealBoard).source.pile,
  0,
  'Prefer uncovering a hidden card',
);
console.log(
  'Hint cycle prevention, equivalent columns, foundations and reveal priorities passed.',
);

let finishBoard = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  columns: Array.from({ length: 7 }, (_, suit) =>
    suit < 4 ? Array.from({ length: 13 }, (_, i) => c(13 - i, suit)) : [],
  ),
  moves: 0,
  score: 0,
  draw: 3,
};
for (let index = 0; index < 52; index++) {
  const candidate = availableMoves(finishBoard).find(
    (m) => m.target.kind === 'foundations',
  );
  assert.ok(candidate, 'Every finish step must be a legal foundation move');
  const before = finishBoard;
  finishBoard = move(finishBoard, candidate.source, candidate.target);
  assert.equal(finishBoard.foundations.flat().length, index + 1);
  assert.equal(before.foundations.flat().length, index);
}
assert.equal(won(finishBoard), true);
assert.equal(finishBoard.moves, 52);
console.log(
  'Sequential foundation completion passed: 52 legal moves, immutable steps and victory.',
);
