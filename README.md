# CHAINS LITE

A live-casino game concept: one continuous stream of digits, shared by everyone.
Pick 3 digits, press Bet. Every bet is a **link** with its own 3-draw timeline.

> Demo only. Demo credits (€), no real money, not a certified RNG.
> © Milutin Erdevicki, concept and code, 2026.

**Play:** [link after deploy]   |   **Math sheet:** [docs/MATH.md](docs/MATH.md)

<!-- Add screenshots here (desktop and mobile) once the build is final. -->

## How it plays

1. Pick 3 digits, in order (repeats allowed). 1 € per link. Up to 5 links per round.
2. Your link starts on the next draw and lives exactly 3 draws. Draw 1 is checked
   against your 1st digit, draw 2 against your 2nd, draw 3 against your 3rd.
3. A miss does not end the link: all 3 draws always play.
4. On the 3rd draw the link settles by hits:
   **0 = lose, 1 = 1.5x, 2 = 10x, 3 = progressive jackpot.**

## Why it's interesting

- **One shared stream, personal timelines:** simple to read, easy to follow live.
- **Every draw matters:** no link dies early, so the tension runs to the 3rd spin.
- **Single progressive pool** with a 200 € operator seed, funded by 12% of every stake.
  Jackpot hits are 1 in 1,000 links, so the pool stays visibly alive.
- **Closed math:** RTP 95.45% (63.45% prizes + 32% jackpot), house edge 4.55%.
  See the math sheet.

## Architecture

```
src/game/   Pure TypeScript engine. No React, no DOM. Runs in Node (tests).
            engine, ticket state machine, payouts, jackpot, rng, rtp, money
src/hooks/  useGame: subscribes React to the engine, gates the reveal
            until the wheel lands so the UI never spoils a result
src/components/  Rendering only. No game math.
src/utils/  Formatting, colors, Web Audio sounds (synthesized, no files)
```

```
Engine (decides the digit, settles links)
   | emit()
useGame (holds the result back)
   | wheelTargetDraw
Wheel (animates to the predetermined digit)
   | reportWheelLanded()
UI reveals digit, links, balance, jackpot, sounds
```

The animation never influences the outcome; it only reveals it.

## Stack

React 19, TypeScript, Vite, Tailwind CSS, SVG wheel, Web Audio API, Vitest.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, math and Monte Carlo tests
npx tsc -b       # type check
```

Large Monte Carlo run:

```bash
SIM_BETS=50000000 npx vitest run src/game/sim.test.ts
```

```powershell
$env:SIM_BETS=50000000; npx vitest run src/game/sim.test.ts
```

Presenter tools (force a digit, speed up, pause, reset, pool preset) appear only
with `/?demo` in the URL.

## Quality

- Deterministic, headless engine with unit tests for hit counting, prizes,
  jackpot payout and split, seed reset, link timelines, per-round cap and RNG routing.
- Monte Carlo through the real ticket state machine matches the theoretical RTP.
- All outcome randomness goes through one RNG module (swappable).

## Production path (not built)

This is a single-player simulation of a multiplayer game. Taking it to
production means:

1. Split shared round state (phase loop, draws, pool) from player session
   (wallet, links).
2. Move the round to a WebSocket server; clients subscribe and animate.
3. Replace the RNG with a certified one; add audit logging.
4. Integrate the operator's wallet (idempotent transactions).
5. Responsible-gaming features: limits, reality checks, session timers.

The engine has no UI dependency, so steps 1-2 are plumbing rather than a rewrite.

## Simulated in the demo

Player counts, the bets heat map and table chat are simulated.