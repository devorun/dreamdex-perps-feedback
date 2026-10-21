# Open interest caps and the "a tenth of it" per-account cap rule do not match on-chain risk parameters
Severity: normal
Area: docs

## Steps to reproduce
1. Open https://app.testnet.dreamdex.io/docs/trading/perps-testnet. Read the "Open interest cap" column and the sentence under the table: "A single account is capped at a tenth of it on most markets."
2. Open https://app.testnet.dreamdex.io/docs/developers/perps-testnet, "Common pitfalls": "Each account has a position cap per market, a tenth of the market's open interest cap on most markets."
3. Run [`scripts/002-position-caps.ts`](../scripts/002-position-caps.ts) (`cd scripts && npm install && node 002-position-caps.ts`). It reads `client.getPerpRiskParams(pool)` (`PerpPool.getPerpPoolParameters()`) for every perp pool and prints `maxOpenInterest` and `maxPositionSize` in base units next to the docs value.

## Expected
The "Open interest cap" column matches `maxOpenInterest`, and `maxPositionSize` is about one tenth of `maxOpenInterest` on most markets, as both pages state.

## Actual
- `maxOpenInterest` differs from the docs on 20 of 21 markets. It is 2x the docs value on BTC, ETH, SOL and HYPE and 4x on 16 others. Only TAO matches.
- `maxPositionSize / maxOpenInterest` is about 1/10 on one market only (TAO). It is about 1/20 on 12 markets, about 1/40 on 6, 0.2 on BTC and 0.25 on ZEC.

A developer who sizes from the docs computes a wrong per-account cap: too low on most markets, and on ZEC 2.5x below the real cap. The docs say the table "can be retuned at any time", but the "a tenth" rule is given as a fact on both pages and holds on 1 of 21 markets.

## Evidence
`node 002-position-caps.ts`, run 2026-10-21T06:14:58Z (an earlier SDK run in the same session gave the same values):

```
market   | docs OI cap  | on-chain maxOpenInterest | on-chain maxPositionSize | maxPositionSize / maxOpenInterest
1000PEPE | 130285600    | 521142400                | 13028500                 | 0.0249
ADA      | 2254678      | 9018712                  | 450934                   | 0.0499
AVAX     | 66672.2      | 266688.8                 | 13334.4                  | 0.0499
BNB      | 693.975      | 2775.9                   | 140                      | 0.0504
BTC      | 246.81545    | 493.6309                 | 100                      | 0.2025
DOGE     | 5613590      | 22454360                 | 1122700                  | 0.0499
ETH      | 3995.6125    | 7991.225                 | 399.5612                 | 0.0499
HYPE     | 23812.72     | 47625.44                 | 2381.27                  | 0.0499
LINK     | 42643.6      | 170574.4                 | 8528.6                   | 0.0499
LIT      | 138896.6     | 555586.4                 | 13889.6                  | 0.0249
NEAR     | 250410       | 1001640                  | 50000                    | 0.0499
PUMP     | 87993700     | 351974800                | 8799300                  | 0.0249
SOL      | 47654.44     | 95308.88                 | 4765.44                  | 0.0499
SUI      | 635009       | 2540036                  | 127000                   | 0.0499
TAO      | 2185.491     | 2185.491                 | 218.549                  | 0.0999
VVV      | 21786.14     | 87144.56                 | 2178.61                  | 0.0249
WLD      | 1264000      | 5056000                  | 126400                   | 0.025
XLM      | 2677780      | 10711120                 | 535556                   | 0.05
XRP      | 344632       | 1378528                  | 68926.4                  | 0.05
ZEC      | 420          | 1680                     | 420                      | 0.25
ZRO      | 250599.5     | 1002398                  | 25059.9                  | 0.0249
```

The other columns of the same table (max leverage, initial/maintenance margin, price tick, min size) and the base decimals table on the developer page all match the chain.

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Wallet: none needed (read-only). Session wallet 0x344F9c80c7E4dF61080BDE9183CBD1C71eE61E40.
