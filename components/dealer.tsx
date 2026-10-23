import { CardBack } from '@/components/card-artwork';
import type { RefObject } from 'react';

type DealerProps = {
  mode: 'deal';
  deckRef?: RefObject<HTMLSpanElement | null>;
};
export function Dealer({ mode, deckRef }: DealerProps) {
  return (
    <aside
      className={`dealer dealer-${mode}`}
      aria-label="Tina dealing your cards"
    >
      <div className="dealer-portrait">
        <img
          src="/dealer/tina-reference.png"
          alt="Tina holding a deck of cards"
          decoding="sync"
          fetchPriority="high"
          draggable={false}
        />
      </div>
      <span ref={deckRef} className="dealer-deck" aria-hidden="true">
        <CardBack />
      </span>
    </aside>
  );
}
