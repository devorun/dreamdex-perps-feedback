# Perp pool amendOrders is not atomic as documented: a rejected replacement cancels the original and returns 0, leaving a gap
Severity: normal
Area: docs

## Steps to reproduce
1. Read the documented behaviour:
   - Developer page, https://app.testnet.dreamdex.io/docs/developers/perps-testnet, "An IOC that fills nothing reverts": "An all-or-nothing amendOrders reverts with AmendReplacementRejected(requestIndex, reason) instead."
   - Functions page, https://app.testnet.dreamdex.io/docs/developers/contracts/functions, `amendOrders`: "Fully atomic: if any cancel or replacement fails (including a replacement that does not rest or fill) the whole batch reverts and no change takes effect — re-laddering never leaves a gap."
   - Errors page: "AmendReplacementRejected … The batch reverts and the cancelled orders are restored - the no-gap guarantee."
2. Run [`scripts/018-perp-amendorders-gap.ts`](../scripts/018-perp-amendorders-gap.ts) (`cd scripts && npm install && node --env-file=../.env 018-perp-amendorders-gap.ts ETH`). It:
   - places one resting POST_ONLY bid for the account, 2% under the book;
   - simulates, from the owner address, `amendOrders([{ oldOrderId: <that bid>, alwaysPlace: false, newOrder: POST_ONLY bid at the best ask }])`, a replacement that cannot rest. This uses `eth_call` plus `debug_traceCall` for the events, so nothing is amended for real;
   - cancels the original bid.

## Expected
The batch reverts (`AmendReplacementRejected(0, 3)` or the replacement's own error), and the original bid stays on the book.

## Actual
The call succeeds and returns `newOrderIds = ["0"]`. The trace shows the original order cancelled (`OrderCancelled`), its margin unlocked, an `AmendRejected`-type log (undecoded topic `0x301df543`), and no replacement. A maker re-laddering a perp book with `amendOrders` loses that rung silently, with no revert to catch. This is the gap the docs say cannot happen. The perp pool behaves like the "per-rung" pool the SDK's packaged `docs/SPOT.md` describes ("applies the other amendments and leaves the rejected one without an order … reads `0n`"), not like the "fully atomic" one the dreamDEX developer, Functions and Errors pages describe for perps. The singular `amendOrder` does revert (`PostOnlyWouldCross`), so code that tests with one order and ships with a batch sees different behaviour.

## Evidence
`node --env-file=../.env 018-perp-amendorders-gap.ts ETH`, 2026-10-21T10:16:38Z:

```
ETH: original resting bid 16288475017085541420677 @ 2394230000000000000000 (tx 0x84bebb4c14eb644d374a0e4cfee6b1c390835337ff689f87adf8d38ce7da176e); best ask 2443300000000000000000
eth_call amendOrders([replace with POST_ONLY @ best ask]) as owner -> success, newOrderIds ["0"]
trace error: none; events in order:
  OrderCancelled {"orderId":"16288475017085541420677"}
  (undecoded 0x301df543)
  CollateralUnlocked {"account":"0xB667DAae78712068Ef9c2Cab61c3217901a0309A","perpPool":"0xD6Cb1DD58580B84D76068aC21594219ce03aeddf","amount":"478846000000000000"}
cleanup: cancel original 16288475017085541420677 tx 0xa80a8436d9b4e5cb5df137d42bb6e7a4db371f5f32046c6e1f9f35eb426ff0d9 status success
```

Second run, 2026-10-21T10:17:05Z: original bid `55340232221135998792` (tx `0xd7d783361b96c850258e95d2eb5c103fecd71641ede3115b688f983c176ef81f`). Same result: `success, newOrderIds ["0"]`, the same three events with the original `OrderCancelled`. Cleanup tx `0x918edeea0cad125d2ea5e6f8d40de9c3769b2979a994b69af4f4770433825c85`.

Same session, [`scripts/amend-sims.ts`](../scripts/amend-sims.ts) at 10:15:33Z: `amendOrder` (singular) with the same crossing replacement → `REVERT PostOnlyWouldCross`; `amendOrders` → `OK ["0"]`. A normal re-price through `amendOrders` succeeded with a new id, which is cancel-then-place behaviour.

## Environment
@somnia-chain/markets-sdk 0.32.1 (ABIs, decoding), viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), ETH-PERP `0xd6cb1dd58580b84d76068ac21594219ce03aeddf`. Account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`. The resting orders were placed and cancelled by bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892`; the amend was only simulated.
