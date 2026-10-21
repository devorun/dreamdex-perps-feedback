# Funding page says "perp below the index: shorts pay longs", but an unmentioned interest term makes longs pay on 10 of 21 markets
Severity: normal
Area: docs

## Steps to reproduce
1. Read https://app.testnet.dreamdex.io/docs/trading/perps-testnet/funding, "Who pays whom":
   - "Perp above the index (positive funding): longs pay shorts."
   - "Perp below the index (negative funding): shorts pay longs."
   The page gives no formula for the rate itself.
2. Run [`scripts/012-funding-sign-vs-premium.ts`](../scripts/012-funding-sign-vs-premium.ts) (`cd scripts && npm install && node 012-funding-sign-vs-premium.ts`). It reads `client.getPerpState(pool)` for every perp market and prints:
   - the pool's own premium of perp over index (`emaPremium`, per 8 h);
   - the published `fundingRate`;
   - who pays;
   - a check of `fundingRate == P + clamp(0.0001 − P, −0.0005, +0.0005)`.

## Expected
Following the page, a market whose perp trades below the index (`emaPremium < 0`) has negative funding, and shorts pay longs.

## Actual
On 10 of 21 markets the pool's premium is negative (perp below index), but the funding rate is +0.0001 per 8 h, so longs pay shorts: 1000PEPE, ADA, BNB, LINK, PUMP, TAO, VVV, WLD, ZEC, ZRO. On all 21 markets the rate equals `P + clamp(0.0001 − P, ±0.0005)` exactly, to the wei. That is, the rate is the premium plus a 0.01%-per-8 h interest term clamped to ±0.05% (10.95% APR when the premium is near zero). The page does not mention the interest term.

So the stated rule is wrong whenever the premium sits between −0.05% and +0.01% per 8 h, which is most quiet markets most of the time. In that band longs always pay, and a trader who goes long "because the perp is below the index, so shorts pay me" pays funding instead. The bot kit's perp-doctor already reads 10.950% APR (pays shorts) on most markets, without the docs explaining why.

## Evidence
`node 012-funding-sign-vs-premium.ts`, 2026-10-21T09:49:46Z:

```
market   | emaPremium (P)   | fundingRate      | P+clamp(0.0001-P,±0.0005) | perp vs index | who pays
1000PEPE |  -0.000063       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
ADA      |  -0.000004       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
AVAX     |  -0.000647       |  -0.000147       |  -0.000147 (=)              | below         | shorts pay
BNB      |  -0.000062       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
BTC      |   0.001803       |   0.001303       |   0.001303 (=)              | above         | longs pay
DOGE     |   0.000001       |   0.000100       |   0.000100 (=)              | above         | longs pay
ETH      |  -0.000864       |  -0.000364       |  -0.000364 (=)              | below         | shorts pay
HYPE     |  -0.002227       |  -0.001727       |  -0.001727 (=)              | below         | shorts pay
LINK     |  -0.000055       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
LIT      |  -0.001125       |  -0.000625       |  -0.000625 (=)              | below         | shorts pay
NEAR     |  -0.000740       |  -0.000240       |  -0.000240 (=)              | below         | shorts pay
PUMP     |  -0.000053       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
SOL      |  -0.001498       |  -0.000998       |  -0.000998 (=)              | below         | shorts pay
SUI      |   0.000368       |   0.000100       |   0.000100 (=)              | above         | longs pay
TAO      |  -0.000132       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
VVV      |  -0.000014       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
WLD      |  -0.000364       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
XLM      |   0.000001       |   0.000100       |   0.000100 (=)              | above         | longs pay
XRP      |  -0.000653       |  -0.000153       |  -0.000153 (=)              | below         | shorts pay
ZEC      |  -0.000281       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay
ZRO      |  -0.000002       |   0.000100       |   0.000100 (=)              | below         | longs pay  <-- docs say shorts pay

formula matches on 21/21; perp below index but longs pay on 10/21
```

A second run at 2026-10-21T09:51:00Z gave the same result, 21/21 and 10/21.

That the published rate is what is charged was checked on a real position. A BTC-PERP long of 0.00013 paid `FundingSettled.payment` 1594655649114580 (0.0015947 USDso) in tx `0x91230e2fe56fac78d8febdebd963b5474b2a79c911d54c63e5a929224327c2fd`. That equals size × the rise in `cumulativeFundingPerUnit` at that settlement, which is size × index × rate / 8 with the published rate.

## Environment
@somnia-chain/markets-sdk 0.32.1, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Read-only; no wallet needed for the script.
