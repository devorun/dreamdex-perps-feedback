# No reduce-only option for regular perp orders in the pool or SDK; createOrder silently drops a reduceOnly param
Severity: normal
Area: SDK

## Steps to reproduce
1. Read https://app.testnet.dreamdex.io/docs/trading/perps-testnet/orders, "Order types": "Reduce-only orders can only shrink a position, never open or flip one."
2. Run [`scripts/009-no-reduce-only.ts`](../scripts/009-no-reduce-only.ts) (`cd scripts && npm install && node 009-no-reduce-only.ts`). It prints the inputs of every order-placing function in the perp pool ABIs that @somnia-chain/markets-sdk 0.32.1 exports.
3. Read the SDK's order inputs:
   - `CreateOrderParams` in `dist/unified/exchange.d.ts` has `timeInForce`, `postOnly`, `slippage`, `builder` and `builderFeeBpsTimes1k`. It has no `reduceOnly`.
   - `ORDER_TYPE` is `LIMIT`, `FILL_OR_KILL`, `MARKET` and `POST_ONLY`.
   - The raw operator call in the docs, `placeOrderFor(owner, isBid, userData, price, quantity, expireTimestampNs, orderType, selfMatchingOption, builder, builderFeeBpsTimes1k)`, has no reduce-only input either.
4. Read the Link a Bot page: a linked bot cannot "Arm take-profit or stop-loss orders on the exchange".

## Expected
A program can send a reduce-only order, as the Orders page offers it. For example, a `reduceOnly` flag on `placePerpOrder` / `placeOrder(For)`, or a `reduceOnly: true` param on the CCXT-style `exchange.createOrder` that is honoured or rejected. In particular, a linked bot can shrink a position without being able to open or flip it.

## Actual
Reduce-only exists only as the `intent` of a stop order (`PerpStopIntent = "reduceOnly" | "opening"` in `dist/trade.d.ts`). There is no reduce-only form of a regular limit, IOC or FOK order:

```
perpPoolWriteAbi.placeOrder(bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k)
ORDER_TYPE {"LIMIT":0,"FILL_OR_KILL":1,"MARKET":2,"POST_ONLY":3}
functions mentioning reduceOnly in these ABIs: none
```

The consequences:
- `exchange.createOrder(symbol, "limit", "sell", amount, price, { reduceOnly: true })` from JavaScript (or with a cast in TypeScript) places a plain order. `createOrder` in `dist/unified/exchange.js` reads only `params.timeInForce`, `postOnly`, `slippage` and the builder fields. The flag is dropped without an error, and the order can open or flip a position. CCXT users pass `reduceOnly` routinely.
- A bot linked with Link a Bot has no reduce-only path at all: it cannot place stops, and regular orders have no flag. The bot kit's `perp-guard` and `closePosition` therefore close with a plain opposite IOC sized from a position read made before the send. If the position shrinks in between (a fill, a partial liquidation, another bot), the "close" opens a position the other way. Reduce-only exists to prevent exactly that.

## Evidence
`node 009-no-reduce-only.ts`, 2026-10-21 (output above), against @somnia-chain/markets-sdk 0.32.1.

Every regular order placed in this session through `placeOrderFor` used the inputs above; for example, tx `0x0c58fd297348d56ffcb5360936f21d5ace0e6990699ae0b86b728955028baa0d` (BTC-PERP IOC buy) shows the full calldata. There is no field in which to ask for reduce-only.

## Environment
@somnia-chain/markets-sdk 0.32.1, Node 24; dreamdex-bot-kit `2579866`. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892`.
