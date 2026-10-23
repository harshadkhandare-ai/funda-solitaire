# Contributing to Funda Solitaire

Thanks for your interest! This is a portrait-first Klondike solitaire game built
with React, TypeScript, and Vinext.

## Getting Started

```bash
# Install dependencies (requires Node.js >= 22.13)
npm install

# Start the dev server
npm run dev

# Run the solitaire rule tests
node --experimental-strip-types lib/solitaire.test.mjs

# TypeScript check
npx tsc --noEmit

# Build for production
npm run build
```

## Project Structure

- `app/page.tsx` — Main game UI and controllers (start screen + table)
- `app/deck/page.tsx` — Card gallery page (`/deck`)
- `app/layout.tsx` — Root layout and metadata
- `app/globals.css` — All styling (Tailwind + custom)
- `lib/solitaire.ts` — Immutable Klondike rules engine
- `lib/solitaire.test.mjs` — Rule tests
- `components/dealer.tsx` — Tina the dealer character
- `components/card-artwork.tsx` — Card rendering
- `components/projected-card.tsx` — SVG card projection
- `public/` — Static assets (cards, dealer art, textures)

## Guidelines

- Keep game logic in `lib/solitaire.ts` pure and immutable.
- Prefer CSS animations over JS where possible; respect `prefers-reduced-motion`.
- All user-facing strings should be simple English (Tina speaks simple English).
- Test rule changes with `lib/solitaire.test.mjs` before submitting.
- Run `npm run lint` and `npm run format` before pushing.

## License

MIT
