# dreamdex-perps-feedback

Feedback on the dreamDEX Perps API and SDK on Somnia Tokyo testnet (Hideki, chain ID 50383), for the [dreamDEX Perps Builder Bounty](https://dorahacks.io/hackathon/dreamdex-perps-bounty).

## Layout

- `feedback/`: one file per issue, `NNN-short-kebab-title.md`
- `scripts/`: minimal reproduction scripts linked from the reports (`cd scripts && npm install && node <script>.ts`, Node >= 22.6). Most are read-only and need no key. Scripts that place, cancel or simulate orders as a bot linked with Link a Bot (`op.ts`, `self-match.ts`, `expiry-test.ts`, `slot-reuse.ts`, `batch-test.ts`, `edge-sims.ts`, `max-size-check.ts`, `amend-sims.ts`, `watch-latency.ts`, `positions-view-latency.ts`, `band-sims.ts`, `018-perp-amendorders-gap.ts`, `019-stop-orders-need-operator-registry.ts`, `020-createorder-below-min.ts`) need `BOT_PRIVATE_KEY` and run as `node --env-file=../.env <script>.ts`. `008-cancel-finished-order.ts` uses it when present and otherwise simulates from the owner address.
- `notes/surface.md`: perps API / SDK inventory
- `notes/log.md`: what was tested and the result

## Reports

| # | Title | Severity | Area |
|---|---|---|---|
| [001](feedback/001-paper-usdso-allowlist-docs-vs-chain.md) | Paper USDso market allowlist in the docs contradicts MarginBank.isVoucherMarketAllowed | normal | docs |
| [002](feedback/002-oi-cap-and-position-cap-docs-vs-chain.md) | Open interest caps and the "a tenth of it" per-account cap rule do not match on-chain risk parameters | normal | docs |
| [003](feedback/003-perp-symbol-case-usdso.md) | Documented perp symbol "BTC/USDSO:USDSO" does not resolve; the SDK builds "BTC/USDso:USDso" and its error blames loadMarkets() | major | SDK |
| [004](feedback/004-sdk-perps-docs-old-deployment.md) | SDK Perps docs describe an older testnet: the "One-shot reads" sample filters on WBTC and crashes | normal | docs |
| [005](feedback/005-bot-kit-perp-doctor-price-precision.md) | dreamdex-bot-kit perp:doctor rounds prices to 2 decimals and shows live books as locked (bid = ask) | normal | SDK |
| [006](feedback/006-position-timestamp-always-zero.md) | Position lastUpdatedTimestampNs is never written, so fetchPositions() dates every open position 1970-01-01 | major | SDK |
| [007](feedback/007-docs-understate-perp-order-gas-and-cost.md) | Developer docs understate perp order gas (≤1.56M) and per-transaction cost (≤0.003 STT) by 2-8x | normal | docs |
| [008](feedback/008-cancel-finished-order-reverts-incorrectsender.md) | Cancelling an already filled or cancelled perp order reverts IncorrectSender (naming 0x0 or another trader), not the documented OrderIdMismatch | normal | contracts |
| [009](feedback/009-no-reduce-only-for-regular-perp-orders.md) | No reduce-only option for regular perp orders in the pool or SDK; createOrder silently drops a reduceOnly param | major | SDK |
| [010](feedback/010-reduce-overwrites-order-fullquantity.md) | After reduceOrder, order history reports the reduced size as fullQuantity ("Original size"), so the placed size is lost | normal | SDK |
| [011](feedback/011-docs-say-no-backstop-bidders-but-one-is-active.md) | Margin & Liquidations says no backstop bidders are registered on testnet, but one is registered and takes over positions | normal | docs |
| [012](feedback/012-funding-docs-omit-interest-term-wrong-payer.md) | Funding page says "perp below the index: shorts pay longs", but an unmentioned interest term makes longs pay on 10 of 21 markets | normal | docs |
| [013](feedback/013-no-perps-api-reference-outside-ts-sdk.md) | Perps have no HTTP / WebSocket / contracts API reference; the indexer GraphQL that serves perps data is documented only by its URL | normal | docs |
| [014](feedback/014-voucher-account-can-change-leverage.md) | Docs say a paper USDso (voucher) account can't change its leverage setting, but setMaxLeverage succeeds and writes the new value | normal | docs |
| [015](feedback/015-sdk-cancel-taker-docs-imply-partial-fill.md) | SDK docs say CANCEL_TAKER "cancels the remaining taker quantity", but a self-match reverts the whole order, including fills against other traders | major | SDK |
| [016](feedback/016-expired-orders-stay-open-and-keep-margin-locked.md) | Expired perp orders stay "open" in getOpenOrders (with no expiry field) and keep their margin locked until someone cancels them | major | SDK |
| [017](feedback/017-sdk-docs-document-apis-missing-from-0-32-1.md) | SDK Perps docs document APIs that @somnia-chain/markets-sdk 0.32.1 does not have (quotePerpClose, getPerpPositionsPage, CreditReclaimed); their samples throw | normal | docs |
| [018](feedback/018-perp-amendorders-not-atomic-leaves-gap.md) | Perp pool amendOrders is not atomic as documented: a rejected replacement cancels the original and returns 0, leaving a gap | major | docs |
| [019](feedback/019-stop-orders-fail-with-documented-config.md) | Perp TP/SL (stop) orders fail with the documented SDK setup: SOMNIA_HIDEKI_TESTNET_ADDRESSES has no operatorPermissionsRegistry | normal | SDK |
| [020](feedback/020-createorder-min-check-assumes-lot-equals-min.md) | createOrder checks the perp minimum as "one lot" (assuming lot = minQuantity), so sub-minimum orders (BTC: 1-12 lots) pass the SDK and revert on chain | normal | SDK |
| [021](feedback/021-margin-events-block-range-silently-ignored.md) | getMarginEvents ignores a sinceBlock/toBlock range without an error and returns the account's whole history, so the documented equity-flow netting is silently wrong | normal | SDK |
| [022](feedback/022-bot-kit-prepared-tx-check-differs-js-python.md) | bot kit (4e75896): the JS/TS and Python prepared-transaction checks decide differently on the same input (data without 0x, chainId "" or "50312.0") and throw raw errors on malformed values | normal | bot kit |

## Setup

Scripts that sign read `BOT_PRIVATE_KEY` from a local `.env`. `.env` is gitignored and must never be committed.
