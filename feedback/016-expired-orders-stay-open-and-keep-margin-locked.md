# Expired perp orders stay "open" in getOpenOrders (with no expiry field) and keep their margin locked until someone cancels them
Severity: normal
Area: SDK

## Steps to reproduce
1. Place a resting perp order with a short `expireTimestampNs`. Here a linked bot places for the owner: a POST_ONLY 0.004 ETH bid 1% under the book, expiring in 40-45 s.
2. Wait until the block time is past the expiry.
3. Compare the reads: `client.getOpenOrders(owner)`, `exchange.fetchOrderBook`, `PerpPool.getOrder(id)`, `client.getMarginAccount(marginBank, owner)`.
4. Try `reduceOrderFor` (simulated), then `cancelOrderFor`.

All of this is in [`scripts/expiry-test.ts`](../scripts/expiry-test.ts) (`cd scripts && npm install && node --env-file=../.env expiry-test.ts ETH 40`).

## Expected
Once an order is past its expiry it can no longer fill, and `fetchOrderBook` already hides it. So:
- `getOpenOrders`, documented as "`owner`'s currently-OPEN orders", either leaves it out or gives the caller what it needs to tell it apart (its `expireTimestampNs` or an expired status).
- The perps docs say that an expired order keeps its margin locked until it is cancelled, so a trader or bot knows to clean it up.

## Actual
After expiry:
- `getOpenOrders` still lists the order, with no `expireTimestampNs` or status field in the row (`id, orderId, market, pool, side, isBid, price, quantityRemaining, userData`), so a bot cannot tell an expired order from a live one.
- The margin stays locked: `lockedCollateral` keeps the order's full lock (0.484826 USDso for 0.004 ETH @ 2424.13 at 5%) until `cancelOrderFor` runs. Only then does it return to `unlocked`.
- `getOrder` still returns the full `quantityRemaining`, and `reduceOrderFor` reverts `ExpiredOrderMustBeCancelled`.
- After the cancel, the order shows in history as `Expired`, not `Cancelled`.

So an account that uses short expiries as a safety net (for example, quotes that "expire on their own") keeps margin tied up in orders that can no longer trade. Its open-orders view keeps showing them as live. The trader Orders page, the developer perps page and the SDK Perps page never say that expired orders must be cancelled to free their margin. The Functions reference mentions `ExpiredOrderMustBeCancelled` for reduces only. The one place that explains it is the TSDoc of the live-store read `getLiveUserOrders` ("on chain it holds its escrow until a cancel or a sweep"). It is not on `getOpenOrders`, the read that returns these rows.

## Evidence
Second run, `node --env-file=../.env expiry-test.ts ETH 40`, 2026-10-21T10:09:12Z:

```
placed 0.004 ETH bid @ 2424.13 expiring at 1792577402 (in 40s): tx 0xb8856eefc58447fe6ab389bb9aff840671aa5867d8a7d17fbb403852440e2c78 id 16270028273011831865348
before expiry: margin locked 0.484826 unlocked 999.50881034435088542
before expiry (block time 1792577364, -38s past expiry): getOrder quantityRemaining 4000000000000000 | price level in fetchOrderBook true | getOpenOrders has it true | history status -
after expiry: margin locked 0.484826 unlocked 999.50881034435088542
after expiry (block time 1792577416, 14s past expiry): getOrder quantityRemaining 4000000000000000 | price level in fetchOrderBook false | getOpenOrders has it true | history status -
  sim reduceOrderFor(id, min) after expiry: REVERT ExpiredOrderMustBeCancelled(["16270028273011831865348"])
  sim cancelOrderFor(id) after expiry: OK
cancel tx 0x4cdafc9e6cc8beaa880ae437df88a3c4f93a61fd33917ffed914b6b4584134a1 status success
after cancel: margin locked 0 unlocked 999.99363634435088542
after cancel (block time 1792577431, 29s past expiry): getOrder revert … | price level in fetchOrderBook false | getOpenOrders has it false | history status Expired
```

First run, 2026-10-21T10:07:27Z: order `12949614339744112573849` (tx `0x7647511f303231db5d4d4c8ef76f8319799a13112d8d56b41c2c68a02ab90fd5`). 15 s past expiry it was still in `getOpenOrders` and out of `fetchOrderBook`, and `reduceOrderFor` reverted `ExpiredOrderMustBeCancelled`. Cancelled in tx `0xe43b83844c084563c409160e069ee83090a669cd365a8be8f8dfccd4c3065d39`, after which history showed `Expired`.

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), ETH-PERP `0xd6cb1dd58580b84d76068ac21594219ce03aeddf`. Account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892`.
