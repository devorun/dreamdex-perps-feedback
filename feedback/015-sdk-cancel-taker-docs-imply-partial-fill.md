# SDK docs say CANCEL_TAKER "cancels the remaining taker quantity", but a self-match reverts the whole order, including fills against other traders
Severity: major
Area: SDK

## Steps to reproduce
1. Read the SDK's description of the default self-match option:
   - `SELF_MATCHING_OPTION` in `dist/trade.d.ts`: "0 cancels the rest of the taker, 1 cancels the whole maker", and `CANCEL_TAKER`: "0 — cancel the remaining taker quantity, leave the maker resting."
   - `docs/SPOT.md` in the npm package: "`CANCEL_TAKER` (0) drops the rest of the incoming order and leaves the resting one on the book".
2. Run [`scripts/self-match.ts`](../scripts/self-match.ts) in `behind` mode: `cd scripts && npm install && node --env-file=../.env self-match.ts ETH behind 0`. It:
   - rests a min-size POST_ONLY bid for the account a few ticks under the best bid, so other traders' bids sit ahead of it;
   - simulates (`eth_call` and `debug_traceCall`, nothing sent) an IOC sell large enough to take the bids ahead and then reach the account's own bid, with `selfMatchingOption = 0`;
   - cancels the resting bid.

## Expected
Per the SDK wording, the sell fills the other traders' bids ahead of the account's own order, then the "remaining taker quantity" is cancelled and the account's bid stays. The transaction succeeds with a partial fill.

## Actual
The whole call reverts `SelfMatchCancelTaker()`. Nothing fills, not even the other traders' liquidity ahead of the self-match. This is what the "My order was rejected" FAQ ("refuses the whole incoming order … none of the new order is placed or filled") and the Errors page describe, but it is the opposite of "cancel the remaining taker quantity". A bot that reads the SDK expects a crossing IOC to keep its fills when it brushes its own quote, and gets a reverted, gas-burning transaction instead. A maker that both quotes and takes (the bot kit's perp-maker plus a hedge) hits this whenever it crosses its own ladder.

Rated major because the docs lead developers to expect a partial fill, but the whole transaction reverts.

## Evidence
`node --env-file=../.env self-match.ts ETH behind 0`, 2026-10-21T10:05:49Z:

```
ETH bestBid 2448.47 bestAsk 2448.78 -> our resting bid @ 2448.42 (behind), selfMatchingOption for the incoming sell = 0
our bid tx 0x239b2741afd415d9bd9619693e8d90eaae0fd9d620cfc1bb14448d41fe995385 status success id 16454495713748927379906
book depth ahead of / beside us at >= our price (others): 0.4083; simulated IOC sell 0.4123 @ 2448.42
eth_call: REVERT SelfMatchCancelTaker([])
trace: error EXECUTION_REVERTED; events {}
cancel our bid tx 0x36b59c7403065d432a85992ea04e5c7269c46088271527bd926e032e5bccd236 status success
```

Second run, 2026-10-21T10:06:18Z: our bid tx `0x9d1d459b0b15a1fe27d2574d9ae62ca64605805ba69a401f0b2b8ce3c0cadedd` at 2447.69, others ahead 4.1049 ETH, simulated IOC sell 4.1089. Again `eth_call: REVERT SelfMatchCancelTaker([])` with no fill events. Cancel tx `0x8d593fe6798a2b45628dc988cad55897c1eed675677d3875943e8357040d721a`.

With the account's bid on top of the book (`top` mode, 2026-10-21T10:05:08Z, bid tx `0xa97c9ef8607b632f8e60959cf29711c5d2be74e6bc2a3054ffebfda34cb2613e`), a min-size crossing sell also reverts `SelfMatchCancelTaker()`, as expected.

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), ETH-PERP `0xd6cb1dd58580b84d76068ac21594219ce03aeddf`. Account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892` (`placeOrderFor`).
