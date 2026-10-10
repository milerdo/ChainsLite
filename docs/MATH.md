# CHAINS LITE: Math Sheet

Demo build. Not a certified RNG; not for real-money play.
© Milutin Erdevicki, concept and code, 2026.

All figures are derived in code from `src/game/constants.ts` and
`src/game/rtp.ts`, never hardcoded in the UI.

## 1. Game model

- One shared stream of independent, uniform digits 0-9.
- A link is 3 digits, in order. Stake: 1 € per link.
- A link starts on the first draw after its bet and lives exactly 3 draws.
  Draw 1 is checked only against digit 1, draw 2 only against digit 2,
  draw 3 only against digit 3. A miss does not end the link.
- The link settles on its 3rd draw, by number of hits (correct positions):

| Hits | Probability | Frequency | Outcome (total return, stake included) |
|---|---|---|---|
| 0 | 72.9% | 1 in 1.4 | lose |
| 1 | 24.3% | 1 in 4.1 | 1.5x |
| 2 | 2.7% | 1 in 37 | 10x |
| 3 | 0.1% | 1 in 1,000 | progressive jackpot (instead of 1.5x/10x) |

Hits follow Binomial(3, 1/10). P(any payout) = 27.1%.

## 2. Jackpot

- Single progressive pool, seeded at 200x stake (200 €). Operator-funded seed.
- 12% of every stake (0.12 € per 1 €) is added to the pool when the bet is
  confirmed.
- A 3-hit link wins the whole pool. The pool then resets to 200 €.
- Links that hit 3 on the same draw split the pool equally, in whole cents
  (remainder cents go to the first winners, so shares sum exactly to the pool).
  The seed is re-funded once per payout event.
- Minimum win 200 €. Average pool at win = 200 + 0.12 / 0.001 = 320 €.

## 3. RTP

| Component | Calculation | RTP |
|---|---|---|
| 1 hit | 0.243 x 1.5 | 36.45% |
| 2 hits | 0.027 x 10 | 27.00% |
| **Regular prizes** | | **63.45%** |
| Jackpot contribution | 12% of stake | 12.00% |
| Jackpot seed | 200 x 0.001 | 20.00% |
| **Jackpot** | | **32.00%** |
| **Total RTP** | | **95.45%** |
| **House edge** | | **4.55%** |

The seed is paid by the operator after every jackpot, so it is part of the
player's RTP and a cost of 20% of turnover to the operator, recouped over time
(the pool also pays out player-funded contributions: money identity below).

Money identity for the pool:
`paid + pool = seed + contributed + seed x payout events`

## 4. Volatility (per 1 € link)

Variance = E[X^2] - E[X]^2

| Component | Std. deviation |
|---|---|
| Regular prizes only | 1.69 |
| Including jackpot (approx.) | 10.9 |

The jackpot term uses pool at win = 200 + 0.12 x (links since last win), with
the gap geometric(0.001). It is an approximation and slightly conservative.

Expected Monte Carlo precision (1 sigma on total RTP): about 0.77% at 2M links,
about 0.15% at 50M links.

## 5. Limits and exposure

- Max 10 links per round (`MAX_LINKS_PER_ROUND`), i.e. max 10 € staked per round.
- Identical links are allowed.
- Max single-link win: the pool (unbounded, grows with play); otherwise 10x.
- Prizes are paid when the link settles (3rd draw). The stake is debited when
  the bet is placed.

## 6. Several links do not change the math

Each link is an independent 1 € bet evaluated against the same stream, so RTP
per 1 € is identical for 1 link or 10. Links that settle on different draws
never interact except through the shared pool.

Small caveat: if two links win the jackpot on the same draw, the seed is
refilled once, not twice, so the jackpot RTP is very slightly below the closed
form in that rare case. The effect is negligible.

## 7. Verification

- Unit tests: hit counting position by position (a miss does not end the
  link), 1-hit and 2-hit prizes in every position combination, 3-hit jackpot
  instead of a prize, repeated digits (7-7-7), settlement on the 3rd draw only,
  overlapping timelines, split payouts, seed reset, money conservation,
  per-round link cap, closed-form RTP (63.45% / 32% / 95.45%).
- Monte Carlo through the real ticket state machine and jackpot manager (base
  prizes, then total with jackpot), plus a smaller run through `ChainsGame`
  that checks the balance against the sum of settled links.

| Run | Measured | Theory | Deviation |
|---|---|---|---|
| Prizes only, 50,000,000 links | _pending_ | 63.450% | _pending_ |
| Total incl. jackpot, 50,000,000 links | _pending_ | 95.450% | _pending_ |

Reproduce:
macOS/Linux `SIM_BETS=50000000 npx vitest run src/game/sim.test.ts`
PowerShell `$env:SIM_BETS=50000000; npx vitest run src/game/sim.test.ts`

## 8. RNG note

Draws use the Web Crypto API with rejection sampling (no modulo bias).
A seeded generator exists for reproducible tests only. A production version
requires a certified RNG.