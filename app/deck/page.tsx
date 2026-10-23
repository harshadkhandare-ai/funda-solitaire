import type { Metadata } from 'next';
import { CardArtwork, CardBack } from '@/components/card-artwork';
import { ranks, suits } from '@/lib/solitaire';
export const metadata: Metadata = {
  title: 'The Royal Deck — Funda Solataire',
  description:
    'Explore all 52 cards in the Funda Solataire ivory, gold and sapphire deck.',
  openGraph: {
    title: 'The Royal Deck — Funda Solataire',
    description:
      'Explore the complete ivory, gold and sapphire solitaire deck.',
    images: [],
  },
  twitter: {
    title: 'The Royal Deck — Funda Solataire',
    description:
      'Explore the complete ivory, gold and sapphire solitaire deck.',
    images: [],
  },
};
export default function Deck() {
  return (
    <main className="deck-gallery app">
      <header>
        <a href="/">← Back to Funda</a>
        <span>THE ROYAL DECK</span>
        <h1>Every card, considered.</h1>
        <p>52 cards. Ivory faces. Gold details. A little royalty.</p>
      </header>
      {suits.map((s, suit) => (
        <section
          key={s}
          aria-label={`${['Spades', 'Hearts', 'Clubs', 'Diamonds'][suit]} cards`}
        >
          <h2>
            {s} {['Spades', 'Hearts', 'Clubs', 'Diamonds'][suit]}
          </h2>
          <div className="deck-grid">
            {Array.from({ length: 13 }, (_, i) => (
              <div className="deck-cell" key={i}>
                <div
                  className={`playing-card face deck-preview-card ${suit % 2 ? 'red' : ''}`}
                  role="img"
                  aria-label={`${ranks[i + 1]} of ${['spades', 'hearts', 'clubs', 'diamonds'][suit]}`}
                >
                  <CardArtwork card={{ rank: i + 1, suit }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h2>The reverse</h2>
        <div className="deck-cell deck-back-preview">
          <div
            className="playing-card back deck-preview-card"
            role="img"
            aria-label="Sapphire and gold card back"
          >
            <CardBack />
          </div>
        </div>
      </section>
    </main>
  );
}
