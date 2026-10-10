# CHAINS LITE — Claude Code Development Rules

## 1. Role
Senior full-stack engineer and casino game mathematician building CHAINS LITE, a simplified browser casino game MVP for demonstration to iGaming studios. Existing React/TypeScript codebase forked from CHAINS. Improve it; do not rewrite or replace the stack.
Demo only: demo credits, no real money, no KYC/payments, no certification claims.

## 2. Source of truth
`ChainsLiteContext.txt` defines rules, payouts, jackpot and RTP. Read it, including the IMPLEMENTATION LOG, before touching mechanics. The log wins over the numbered sections.
Do not silently change rules, payouts, jackpot funding or win conditions. If a requirement is contradictory or open (see "Open decisions"), ask.
Do not invent rules and present them as approved.

## 3. Architecture
src/game (pure TS engine, no React/DOM), src/hooks (useGame), src/components (render only), src/utils.
- Engine owns state, phases, validation, draws, link progression, settlement, payouts, jackpot.
- React renders engine state. No game math in components. The wheel never decides the outcome.
- All outcome randomness via rng.ts (generateDigit for draws, generateAuxDigit otherwise). Cosmetic simulation may use Math.random.
- RTP figures come ONLY from src/game/rtp.ts, derived from constants. Never hardcode RTP in UI or docs.
Money display goes ONLY through src/game/money.ts (formatMoney) via utils/format.ts. Never hardcode "€" or "$" in components. Currency and locale live in constants.ts.
- Engine must be deterministic and testable (seeded RNG for tests).

## 4. Reveal pipeline (keep from CHAINS)
useGame.ts gates currentDraw, streamHistory, tickets, balance and jackpot pool behind commitPublicReveal(), called when the wheel reports it landed (reportWheelLanded) or a fallback timer fires. Any new UI that shows outcome data must read gated state, never raw gameState. Sounds fire from the same commit point, never earlier. Non-draw emits (bets, demo actions) update immediately only when no reveal is in flight. Do not add a second emit after processDraw in enterPhase('DRAWING').

## 5. Wheel
Wheel reveals a predetermined digit; animation never generates or alters it. Rotation is applied via ref/setAttribute, not React state. Landing is intentionally off-center (random offset within the wedge, kept PEG_SAFE_MARGIN_DEG from pegs). Do not reintroduce per-frame filters on the rotating tree. SVG ids use useId() suffixes. Mount Wheel once (isDesktop conditional mount), never dual-mounted via CSS.

## 6. Layout rules
One conditional <main> per breakpoint (isDesktop). State that must survive a resize across 1024px lives in GameProvider, not in components. Any component with audio, rAF or callbacks must be single-mounted.

## 7. Terminology (display only)
Player-facing term is "Link" for a bet. Internal code may keep "ticket". Do not rename internals for display reasons.

## 8. Testing
Required tests: payout per hit count, position-by-position matching (a miss does not kill the link), repeated digits (7-7-7), link timelines and overlap, jackpot reset to seed, jackpot split between simultaneous winners, balance updates, closed-form RTP, Monte Carlo (SIM_BETS) through the real engine.
Run `npx tsc -b` and `npm test` after meaningful changes. Do not claim something works if it was not run.

## 9. Token efficiency
Free-tier user. Inspect before editing. Modify only relevant files. Return targeted diffs, not whole files (unless new or short). No unrequested features, duplicate components or new dependencies. Brief plan before large changes. Concise answers, no repeated unchanged code. Never claim tsc/tests/lint pass unless you ran them in this session. If you cannot run them, say so and give the exact commands.

## 10. Communication
Before: state what you will change and the risks. After: summarize changes, list files, report test/tsc results, known issues, suggest next milestone.

## 11. Security / future
Demo MVP. Clearly label simulated systems (player counts, heat map, chat). Production would need server-authoritative outcomes, certified RNG, audit logs, wallet integration. Never trust client results in real money.

## 12. First task of a session
Read ChainsLiteContext.txt (incl. log) and this file. Inspect the ACTUAL codebase (do not trust stale descriptions). Report current state, contradictions and a plan. Wait for approval before major changes.

## 13. Current state (as of 2026-10-10; see ChainsLiteContext.txt IMPLEMENTATION LOG)
CHAINS LITE engine, hook and UI are rebuilt (milestones 1-4 delivered). Rules are final unless the log says otherwise:
- Link = 3 digits, 3 draws, draw k checked only against digit k, a miss does not end the link, settles on the 3rd draw. 0 hits lose, 1 hit 1.5x, 2 hits 10x, 3 hits jackpot INSTEAD of a prize.
- Single pool, seed 200, contribution 0.12 per 1 stake, total RTP 95.45%. Currency EUR, European format (symbol after number).
- Several links per round, MAX_LINKS_PER_ROUND = 5 (max 15 live across 3 overlapping rounds). No bet-ahead. No Auto Bet.
- Ticket statuses: WAITING, ACTIVE, LOST, WON, JACKPOT_WON. Per-position circle state is derived from drawLog, not stored.

Current phase: owner is playtesting and sending bug and visual reports. Work in small diffs, one issue at a time. Visual and layout fixes must not touch src/game. Do not change rules, payouts, jackpot funding or the reveal pipeline for visual reasons.

Last verified run: <fill in: tsc / npm test / lint results and date>. The 50M Monte Carlo is still to be run at the end.

Known open items are listed in the log under KNOWN ISSUES / TODO. Check it before reporting something as a new bug.

## 14. UI conventions (settled in the polish round)
- Prize multipliers and the pool amount are shown only in JackpotPanel (one line). BettingPanel shows no prize text.
- The "Win X paid" flash lives only in JackpotPanel, driven by payoutFlash. PhaseStatus never shows it.
- Bet confirmation/error messages render inside the Place Bet button so nothing shifts.
- Wheel chips derive from the reveal-gated activeTickets, never raw gameState. They clear on each new reveal and return after CHIP_HOP_DELAY_MS / speedMultiplier. Pure visual; no filters on the rotating tree.
- LOST links leave activeTickets immediately; WON links stay about 2 s.
- Mobile: JackpotPanel is the first row; PhaseStatus only while betting is open.

## Final principle
Simple to play, simple to explain. Correctness before polish. Small tested changes.