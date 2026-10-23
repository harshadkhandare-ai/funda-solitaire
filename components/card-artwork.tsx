import { type Card, ranks, suits } from '@/lib/solitaire';

const courtArt: Record<number, string> = {
  11: 'jack',
  12: 'queen',
  13: 'king',
};

export function CardArtwork({ card }: { card: Pick<Card, 'rank' | 'suit'> }) {
  return (
    <span
      className={`card-artwork rank-${card.rank} suit-${card.suit}`}
      aria-hidden="true"
    >
      <span className="corner">
        <span>{ranks[card.rank]}</span>
        <small>{suits[card.suit]}</small>
      </span>
      {card.rank > 10 ? (
        <span className="court-viewport">
          <img
            className="court-art"
            src={`/cards/cutouts/${courtArt[card.rank]}-${card.suit % 2 ? 'red' : 'black'}.png`}
            alt=""
            draggable={false}
            decoding="sync"
          />
        </span>
      ) : (
        <span className="suit-emblem">{suits[card.suit]}</span>
      )}
    </span>
  );
}
export function CardBack() {
  return (
    <img
      className="card-back-art"
      src="/cards/back.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="sync"
    />
  );
}
