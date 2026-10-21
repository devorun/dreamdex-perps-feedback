# Cancelling an already filled or cancelled perp order reverts IncorrectSender (naming 0x0 or another trader), not the documented OrderIdMismatch
Severity: normal
Area: contracts

## Steps to reproduce
1. As the owner, or as a bot key linked with Link a Bot, place a perp order and let it fill, or cancel it.
2. Call `cancelOrderFor(owner, orderId)` (or `cancelOrder(orderId)` as the owner, or `reduceOrderFor(owner, orderId, 0)`) with that order's id. This is the usual race for a bot: it cancels an order that filled a moment earlier.
3. Run [`scripts/008-cancel-finished-order.ts`](../scripts/008-cancel-finished-order.ts) (`cd scripts && npm install && node --env-file=../.env 008-cancel-finished-order.ts`). It only runs `eth_call`. It calls `getOrder`, `cancelOrderFor`, `reduceOrderFor` and `cancelOrder` on four finished orders of the account and prints the decoded revert. Without `BOT_PRIVATE_KEY` it simulates from the owner address.

## Expected
The Errors page (https://app.testnet.dreamdex.io/docs/developers/contracts/errors) lists this case:

> `0x71fa8de6 | OrderIdMismatch() | The stored order for that slot no longer matches the supplied OrderId (already filled, cancelled, or expired-and-reused). Re-read state with getOrder / getOwnOpenOrders before cancelling.`

The Functions page (https://app.testnet.dreamdex.io/docs/developers/contracts/functions) says the same under `cancelOrder`:

> `OrderIdMismatch (0x71fa8de6) - the slot no longer holds that OrderId. The order is already in a terminal state (filled, cancelled, or expired-and-reused) - there is nothing to cancel.`

So a cancel or reduce of a finished order reverts `OrderIdMismatch()` (or `IncorrectOrder()`, which `getOrder` returns for the same ids).

## Actual
The calls revert `IncorrectSender(caller, expected)`. The Errors page describes that as "Caller is not the order owner … For operator flows the owner must authorize the operator", and calls it one of the two errors "reported most often during preflight". `expected` is whatever currently sits in the order's storage slot:
- `0x0000000000000000000000000000000000000000` when the slot is empty.
- An unrelated trader (`0x47537E3A3ea6e9391F3B26Ea45618db6828c8bfF`) when that trader's newer order now occupies the slot. The low 64 bits of the id are a sequence number and the high 64 bits a reused slot index.

A bot that handles errors by the docs reads an ordinary fill race as "my operator link is broken" and stops, or tells the user to re-link. The message also names another account as the "expected" owner of the user's own order. Two things show the pool can tell the cases apart: `getOrder` returns `IncorrectOrder()` for these ids, and when the slot is reused by the same owner's newer order, the stale id correctly reverts `IncorrectOrder()` (see the last block of Evidence). `OrderIdMismatch()` is never returned in any of these cases.

No funds are at risk: a stale id never acted on the newer order in the slot in any test.

## Evidence
`node --env-file=../.env 008-cancel-finished-order.ts`, 2026-10-21T06:56:54Z, block 29138847, operator `0x29cF993A7c66d2Af212EEE430F120750023e8892`:

```
ZEC IOC buy, tx 0xb49fa126… [Filled] id 129127208515968813332
  getOrder(id)                 -> revert IncorrectOrder([])
  cancelOrderFor(owner, id)    -> revert IncorrectSender(["0xB667DAae78712068Ef9c2Cab61c3217901a0309A","0x47537E3A3ea6e9391F3B26Ea45618db6828c8bfF"])
  reduceOrderFor(owner, id, 0) -> revert IncorrectSender(["0xB667DAae78712068Ef9c2Cab61c3217901a0309A","0x47537E3A3ea6e9391F3B26Ea45618db6828c8bfF"])
  cancelOrder(id) as owner     -> revert IncorrectSender(["0xB667DAae78712068Ef9c2Cab61c3217901a0309A","0x47537E3A3ea6e9391F3B26Ea45618db6828c8bfF"])

ZEC IOC sell, tx 0xc2b97fb2… [Filled] id 129127208515968813374
  getOrder(id)                 -> revert IncorrectOrder([])
  cancelOrderFor(owner, id)    -> revert IncorrectSender(["0xB667DAae78712068Ef9c2Cab61c3217901a0309A","0x47537E3A3ea6e9391F3B26Ea45618db6828c8bfF"])
  ...

BTC limit bid, tx 0xd9c2c933… [Cancelled] id 7950546695768823436260
  getOrder(id)                 -> revert IncorrectOrder([])
  cancelOrderFor(owner, id)    -> revert IncorrectSender(["0xB667DAae78712068Ef9c2Cab61c3217901a0309A","0x0000000000000000000000000000000000000000"])
  reduceOrderFor(owner, id, 0) -> revert IncorrectSender(["0xB667DAae78712068Ef9c2Cab61c3217901a0309A","0x0000000000000000000000000000000000000000"])
  cancelOrder(id) as owner     -> revert IncorrectSender(["0xB667DAae78712068Ef9c2Cab61c3217901a0309A","0x0000000000000000000000000000000000000000"])

BTC limit bid, tx 0xd75d279a… [Cancelled] id 15052543164147000809223
  getOrder(id)                 -> revert IncorrectOrder([])
  cancelOrderFor(owner, id)    -> revert IncorrectSender(["0xB667DAae78712068Ef9c2Cab61c3217901a0309A","0x47537E3A3ea6e9391F3B26Ea45618db6828c8bfF"])
  ...
```

Earlier in the session, a real second `cancelOrderFor` on BTC order `7950546695768823436260` (placed in tx `0xd9c2c933520f808777d1c1c217d18fda76c0d7077a5dca1f623d4451ff305e97`, cancelled in tx `0xad8bc7c8559079221d833d13f63a315e6de81c2771233aae41730377c4a7e887`) failed in simulation the same way. It named `0x47537E3A…8bfF` at 06:52Z and `0x0…0` a few minutes later, so the "expected" owner depends on who uses the slot at the time.

Same-owner slot reuse ([`scripts/slot-reuse.ts`](../scripts/slot-reuse.ts), 2026-10-21T06:55:56Z): order `15052543164147000809223` (slot 816) was cancelled in tx `0x523d9a85506337b90f6cec27bcfba66323e625a3abb10a9bae306308b0764fca`. The next order, `15052543164147000809229`, landed in slot 816 (tx `0x4fdadf742827810b25ce394e2e71c2fce9b6466d5a02ac2cdab6c33bc8301774`). Then `cancelOrderFor(owner, 15052543164147000809223)` and `reduceOrderFor(owner, 15052543164147000809223, 0)` reverted `IncorrectOrder([])`, and `cancelOrderFor(owner, 15052543164147000809229)` simulated OK.

## Environment
Raw pool calls with viem 2.57.7, error ABI `contractErrorsAbi` from @somnia-chain/markets-sdk 0.32.1. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Pools: BTC-PERP `0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0`, ZEC-PERP `0x2a73129f26917124bd2a47a9b355c395c537f050`. Account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892`.
