# Funda Solataire

Portrait-first Klondike solitaire built with React, TypeScript, and Vinext.

## Play

Tap the stock to draw, select a card then tap its destination, or drag a card or sequence. Eligible cards move directly to foundations when tapped. Double-tap a card to make an available move. Each stock tap reveals one card. The latest three waste cards overlap from left to right, with earlier ranks exposed; only the newest is playable. Older cards remain in the waste for recycling. The start screen features Tina and one primary button: Start Game for a fresh hand, or Continue Game for a saved hand. Fresh hands have an empty waste pile and face-down stock; cards open only when the stock is tapped. The playing screen uses a compact stats header and a Pause / Undo / Hint / How to play bottom bar. Includes the last 100 moves of undo, hints, three table colors, optional synthesized sound, a pause menu, local game saving, and automatic completion when the tableau is uncovered and the stock and waste are empty.

## Development

Requires Node 22.13 or newer. Run `npm install`, then `npm run dev`. Run `npm run build` for the deployment build. Run `node --experimental-strip-types lib/solitaire.test.mjs` for rule checks and `npx tsc --noEmit` for TypeScript checks.

## Android integration

This repository contains the web game, not an Android wrapper. The layout includes viewport safe-area support, touch dragging, scalable cards, reduced-motion support, and localStorage persistence. Enable JavaScript and DOM storage in the host WebView. The hosting preview is private; player-facing use requires an appropriately accessible deployment. An actual Android WebView and device test is still required before release. Offline packaging and a service worker are not included.

## Validation

The rule tests cover shuffled deck uniqueness, deal structure, single-card drawing, rolling three-card visibility and recycling, sequence moves, empty-column restrictions, foundations, scores, immutability, uncovering cards, and hint discovery. Production build and TypeScript checks pass. Browser UI QA was not performed because browser control is unavailable in this session. Optional WebMCP hint discovery is feature-detected but could not be runtime-verified without a supported browser context.

## Deployment (GitHub + Vercel)

### 1. Create the GitHub repository

Create a new empty repository on GitHub (e.g. `funda-solitaire`). Do **not** initialize it with a README — this repo already has one.

### 2. Push the code

```bash
git init
git add .
git commit -m "chore: initial release of Funda Solitaire"

git remote add origin https://github.com/YOUR_USERNAME/funda-solitaire.git
git branch -M main
git push -u origin main
```

### 3. Import into Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New → Project** and import your `funda-solitaire` GitHub repository.
3. Vercel will detect the framework and use these settings automatically:
   - Build Command: `npm run build`
   - Output Directory: `dist/client`
   - Install Command: `npm install`
4. Click **Deploy**.

### 4. Verify security headers

After deployment, confirm the security headers are live:

```bash
curl -I https://your-project.vercel.app
```

You should see:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`

### Environment Variables

This game is fully client-side and requires **no environment variables**. Do not add API keys or secrets — none are needed.


Saved games, timer, sound preference, and table color are local to the current browser profile. Undo and redo history are session-only. The timer runs only on the playing screen and pauses for menus and when the app goes into the background. Shuffles are random and are not guaranteed solvable.

## Interaction refinements

Foundations sit on the left; the stock sits at the far right beside its waste pile. New games deal 28 cards in staggered order. Dragging uses a fixed overlay for complete sequences, legal-target feedback, overlap-assisted drops, return animation on invalid drops, and edge scrolling. Exposed indices use compact stack spacing; the waste shows the latest three cards in an overlapping fan. Motion respects the system reduced-motion preference. Touch behavior still needs verification on the target Android device.

## Dealer host

Tina welcomes players on the start screen in simple English. New deals animate from her deck at the bottom of the table, followed by a short farewell. Hint brings her back with a legal move or draw/recycle guidance for up to ten seconds; her bubble can be dismissed. The character is a still illustration with card and interface animation, not a skeletal or video character. All guidance is text.
