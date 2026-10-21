# After reduceOrder, order history reports the reduced size as fullQuantity ("Original size"), so the placed size is lost
Severity: normal
Area: SDK

## Steps to reproduce
1. Place a resting perp order for 0.00026 BTC: `node --env-file=../.env op.ts place BTC buy 0.00026 78750 limit` ([`scripts/op.ts`](../scripts/op.ts); a linked bot key placing for the owner with `placeOrderFor`).
2. Reduce it to 0.00013: `op.ts reduce BTC <orderId> 13000` (`reduceOrderFor(owner, orderId, 13000)`).
3. Cancel it: `op.ts cancel BTC <orderId>`.
4. Read the order history: `node order-history.ts <owner> <orderId>` ([`scripts/order-history.ts`](../scripts/order-history.ts), `client.listPerpOrderHistory(owner)`).

## Expected
The SDK's order row type (`dist/fills.d.ts`) documents `fullQuantity` as "Original size, raw base/outcome units". The activity row in `dist/activity.d.ts` says "Raw base units the order was placed for." So the history row shows `fullQuantity` 26000 (0.00026 BTC). The 13000 removed by the reduce stays visible as the difference between `fullQuantity` and `filledQuantity + quantityRemaining`.

## Actual
`fullQuantity` is `13000`, the size after the reduce. The history row (`fullQuantity 13000, filledQuantity 0, quantityRemaining 13000, Cancelled`) cannot be told apart from an order placed for 0.00013 BTC. The cause is on chain: `reduceOrder(For)` rewrites the stored order's `fullQuantity`, which `PerpPool.getOrder` returns as 26000 at placement and as 13000 after the reduce. The indexer and the SDK pass the rewritten value on as "original size". Order history, fill-ratio and "x of y filled" displays built on this field are wrong for any order a bot or maker shrinks with reduce. Makers do that routinely.

## Evidence
Second run, 2026-10-21T07:02:06Z:

```
place  tx 0x140782a4c97379155d0a60aa7f0e4488f36cea0aad57c55b0e482027258dcd51 block 29142007  placeOrderFor quantity 26000 -> orderId 8042780416137371196198
reduce tx 0x5cb746ac6a993a767a1e2c23b9dc05a57d61c3c1c9ced9dd20067087ad0b6079 block 29142061  reduceOrderFor(owner, 8042780416137371196198, 13000)
cancel tx 0xf5883376239b04a97766e35738bd8457b7266f0484841fb020c0126d26c89491 block 29142116

listPerpOrderHistory:
{"orderId":"8042780416137371196198","status":"Cancelled","price":"78750000000000000000000","fullQuantity":"13000","filledQuantity":"0","quantityRemaining":"13000","placedTxHash":"0x140782a4c97379155d0a60aa7f0e4488f36cea0aad57c55b0e482027258dcd51"}
```

First run, order `7950546695768823436260`: placed with quantity 26000 in tx `0xd9c2c933520f808777d1c1c217d18fda76c0d7077a5dca1f623d4451ff305e97` (block 29135504), reduced to 13000 in tx `0xd2a4a720e8cc09d1cde72e179b16951690e15ac71f9afbc5c69d9644065fa81e` (block 29135801), cancelled in tx `0xad8bc7c8559079221d833d13f63a315e6de81c2771233aae41730377c4a7e887`. `PerpPool.getOrder(7950546695768823436260)` read at each block:

```
29135504 {"fullQuantity":"26000","quantityRemaining":"26000", ...}
29135801 {"fullQuantity":"13000","quantityRemaining":"13000", ...}
```

`listPerpOrderHistory` for it: `"fullQuantity":"13000","filledQuantity":"0","quantityRemaining":"13000","status":"Cancelled"`. The indexer `Order` row agrees: `fullQuantity "13000"`.

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Pool BTC-PERP `0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0`. Account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892`.
