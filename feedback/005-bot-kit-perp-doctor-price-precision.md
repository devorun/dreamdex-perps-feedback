# dreamdex-bot-kit perp:doctor rounds prices to 2 decimals and shows live books as locked (bid = ask)
Severity: normal
Area: SDK

## Steps to reproduce
1. Clone https://github.com/somnia-chain/dreamdex-bot-kit (commit `2579866`) and run `npm ci`.
2. Run the preflight that docs/perps.md says to run first: `NETWORK=hideki npm run perp:doctor`. No key is needed for the market view.
3. Read the `book[...]` and `mark=` values for LIT-PERP, NEAR-PERP, SUI-PERP and XRP-PERP. All four have a 0.0001 tick.
4. Run [`scripts/005-doctor-price-precision.ts`](../scripts/005-doctor-price-precision.ts) (`cd scripts && npm install && node 005-doctor-price-precision.ts`). It prints the same top of book at full precision next to the doctor's formatting.

## Expected
The doctor shows prices at the market's tick precision, so its book line shows the real spread. The comment above the formatter says "A price with enough digits to read, whether it is 83,000 or 0.0058".

## Actual
`px()` in `scripts/perp-doctor.ts` formats every price at or above 1 with `toFixed(2)`, whatever the market's tick. On markets priced between 1 and about 10 with a 0.0001 tick, this drops 2 of the 4 significant decimals:
- The book prints as locked, with `bid` equal to `ask`, on LIT, NEAR, SUI and XRP, although each has a positive spread on chain.
- `mark=` loses the same precision. On XRP it printed `mark=1.34` beside `book[bid=1.33 ask=1.33]`, which looks as if the mark sits outside the book.

The doctor is the tool docs/perps.md tells users to run "first" to check that a market is priceable and its book is live. A book shown as locked suggests a broken or crossed market where there is none.

## Evidence
`NETWORK=hideki npm run perp:doctor`, 2026-10-21T06:38:21Z (a first run at about 06:30Z, with the bot key, showed the same four markets locked):

```
LIT-PERP   mark=3.46 · funding -45.315% (pays longs) · book[bid=3.46 ask=3.46] · tick=0.0001 lot=0.1 minQty=2.8 IM=2000bps
NEAR-PERP  mark=5.03 · funding -75.600% (pays longs) · book[bid=5.02 ask=5.02] · tick=0.0001 lot=0.1 minQty=5.1 IM=1000bps
SUI-PERP   mark=1.02 · funding 10.950% (pays shorts) · book[bid=1.02 ask=1.02] · tick=0.0001 lot=1 minQty=13 IM=1000bps
XRP-PERP   mark=1.34 · funding -103.470% (pays longs) · book[bid=1.33 ask=1.33] · tick=0.0001 lot=0.1 minQty=6.9 IM=500bps
```

`node 005-doctor-price-precision.ts`, 2026-10-21T06:39:05Z:

```
market | tick   | best bid | best ask | perp-doctor shows
LIT    | 0.0001 | 3.4618 | 3.4638 | book[bid=3.46 ask=3.46]
NEAR   | 0.0001 | 5.0185 | 5.0193 | book[bid=5.02 ask=5.02]
SUI    | 0.0001 | 1.0231 | 1.024 | book[bid=1.02 ask=1.02]
XRP    | 0.0001 | 1.3288 | 1.3289 | book[bid=1.33 ask=1.33]
```

A possible fix is to format with the market's tick decimals, for example `v.toFixed(tickDecimals)` from `formatUnits(tickSize, 18)`.

## Environment
dreamdex-bot-kit `2579866` (perp-core on @somnia-chain/markets-sdk 0.31.0); repro script on @somnia-chain/markets-sdk 0.32.1, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Wallet: none needed (market view only). Session wallet 0x344F9c80c7E4dF61080BDE9183CBD1C71eE61E40.
