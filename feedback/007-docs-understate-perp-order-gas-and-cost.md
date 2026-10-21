# Developer docs understate perp order gas (≤1.56M) and per-transaction cost (≤0.003 STT) by 2-8x
Severity: normal
Area: docs

## Steps to reproduce
1. Read https://app.testnet.dreamdex.io/docs/developers/perps-testnet:
   - "Get test funds": "transactions to perp pools measured on testnet cost between 0.0003 and 0.003 STT each."
   - "Leave plenty of gas": "Successful placeOrderFor transactions on testnet used up to about 1.56M gas".
2. As a bot key linked with Link a Bot, send small IOC orders with `placeOrderFor` and a 10M gas limit, as the docs and the bot kit do: `node --env-file=../.env op.ts place <BASE> <buy|sell> <qty> <price> ioc` ([`scripts/op.ts`](../scripts/op.ts)).
3. Read `gasUsed` and `effectiveGasPrice` from each receipt.

## Expected
Successful `placeOrderFor` calls use about 1.56M gas or less and cost 0.0003-0.003 STT, so a bot funded from those figures can place hundreds to thousands of orders per STT.

## Actual
Each successful order, each a one-level IOC fill of the minimum size, used 2.7M-4.3M gas at 6 gwei and cost 0.016-0.026 STT. That is 1.7-2.7x the documented gas ceiling and 5-8x the documented top cost. A bot funded for 1,000 orders at the documented 0.003 STT (3 STT) runs dry after about 150. A gas limit chosen from "up to about 1.56M" (for example 2M) runs out of gas on these orders. The docs' own advice to send 10M is safe, but the figures beside it are wrong.

## Evidence
All on 2026-10-21, gas limit 10,000,000, from the bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892`:

| Tx | Order | Status | gasUsed | effectiveGasPrice | Cost |
|---|---|---|---|---|---|
| `0xb49fa126988f88f54be8219ea9e727d91f8fa246b1cce34878ff4ff47a36ec6a` | ZEC buy 0.009 IOC, 1 fill | success | 4,261,840 | 6 gwei | 0.02557104 STT |
| `0xc2b97fb2a93ad598f6b677937bb95f50694d1cd4d26ef2d0afcb43300164d40e` | ZEC sell 0.009 IOC, 1 fill | success | 2,730,676 | 6 gwei | 0.016384056 STT |
| `0x0c58fd297348d56ffcb5360936f21d5ace0e6990699ae0b86b728955028baa0d` | BTC buy 0.00013 IOC, 1 fill | success | 3,705,769 | 6 gwei | 0.022234614 STT |

At the same time `eth_gasPrice` and the latest block's `baseFeePerGas` were both 6 gwei, so the cost is not from an inflated priority fee. Even 1.56M gas at 6 gwei is 0.0094 STT, already above the documented 0.003 STT top.

## Environment
Raw `placeOrderFor` via viem 2.57.7 (ABI as in the docs); @somnia-chain/markets-sdk 0.32.1 for reads. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Account (owner) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892`.
