# createOrder checks the perp minimum as "one lot" (assuming lot = minQuantity), so sub-minimum orders (BTC: 1-12 lots) pass the SDK and revert on chain
Severity: normal
Area: SDK

## Steps to reproduce
1. Load markets and read the BTC perp's grid: `lotSize` 0.00001 BTC, `minQuantity` 0.00013 BTC (13 lots). `limits.amount.min` reports 0.00013.
2. Call `exchange.createOrder("BTC/USDso:USDso", "limit", "buy", 0.00012, <price under the book>)`, a quantity of 12 lots: on the lot grid but below `minQuantity`.
3. Run [`scripts/020-createorder-below-min.ts`](../scripts/020-createorder-below-min.ts) (`cd scripts && npm install && node --env-file=../.env 020-createorder-below-min.ts BTC`). It sends nothing. It runs the real `createOrder` and intercepts the order at the trader, which is where `createOrder` hands the order to the executor. Then it simulates that exact order on chain with `eth_call`, as a bot linked with Link a Bot placing for the account.

## Expected
`createOrder` rejects any perp amount below the market's `minQuantity` with an `InvalidInputError` before anything is signed, as it already does for amounts below one lot. Its own comment claims there is "no band where an order passes here and still reverts as below-minimum".

## Actual
`createOrder` (`dist/unified/exchange.js`) only rejects amounts that floor to zero lots. Its comment assumes one lot is the venue minimum: "every deployed venue sets tick = lot = min … so this threshold is exactly the venue's own and there is no band where an order passes here and still reverts as below-minimum". That is not true for perps. Every perp market has `minQuantity` > `lotSize` (BTC 13 lots, ETH 40 lots). `placePerpOrder` only checks `quantity > 0`. The local private-key executor signs with a fixed gas limit and broadcasts without simulating (`dist/executor/local.js`).

So an amount between one lot and `minQuantity` is accepted by the SDK, sent, and mined as a revert with `QuantityBelowMinimum(quantity, minQuantity)`:
- The caller pays gas for a transaction the SDK could have refused locally. The revert path uses about 111.6k gas, 0.00067 STT at 6 gwei.
- A bot developer sees the error as an on-chain revert instead of an SDK input error, in the same API that does reject amounts below one lot.

Workaround: size against `limits.amount.min` from `loadMarkets()`. It holds the correct `minQuantity` on all 21 perp markets.

Suggested fix: in `createOrder` (and ideally `placePerpOrder`), reject a perp quantity below the market's `minQuantity`, the value already in `limits.amount.min`, with an `InvalidInputError` before signing. Also drop the "lot = min" assumption from the comment.

## Evidence
`node --env-file=../.env 020-createorder-below-min.ts BTC`, 2026-10-26T09:56:53Z:

```
markets-sdk 0.32.1; BTC/USDso:USDso: lot 0.00001, minQuantity 0.00013 (= 13 lots), limits.amount.min 0.00013
createOrder("BTC/USDso:USDso", "limit", "buy", 0.000005, 76574.0): rejected by the SDK: InvalidInputError: @somnia-chain/markets-sdk: amount 0.000005 is below one lot on BTC/USDso:USDso (lot 0.00001) — it would place a zero-quantity order
createOrder("BTC/USDso:USDso", "limit", "buy", 0.00012, 76574.0): accepted by the SDK -> handed to the executor: {"quantity":"12000","price":"76573900000000000000000","orderType":0}
eth_call placeOrderFor(captured order) @ block 33564692: REVERT QuantityBelowMinimum(["12000","13000"])
```

Second run, 2026-10-26T09:57:10Z: same result. 0.00012 is accepted and handed to the executor (`quantity 12000`), and `eth_call` reverts `QuantityBelowMinimum(["12000","13000"])` at block 33564856.

Same on ETH-PERP, 2026-10-26T09:57:26Z: lot 0.0001, `minQuantity` 0.004 (40 lots). `createOrder(..., 0.0039, ...)` is accepted (`quantity 3900000000000000`), and `eth_call` reverts `QuantityBelowMinimum(["3900000000000000","4000000000000000"])` at block 33565018.

Gas of the reverting call, from `debug_traceCall` on BTC-PERP with quantity 12000: `error EXECUTION_REVERTED | gasUsed 111632`.

## Environment
@somnia-chain/markets-sdk 0.32.1 (npm `latest`), viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383); BTC-PERP `0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0`, ETH-PERP `0xd6cb1dd58580b84d76068ac21594219ce03aeddf`. Simulation only: account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892` (linked with Link a Bot). No transaction was sent.
