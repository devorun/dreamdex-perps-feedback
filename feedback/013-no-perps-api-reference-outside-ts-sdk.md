# Perps have no HTTP / WebSocket / contracts API reference; the indexer GraphQL that serves perps data is documented only by its URL
Severity: normal
Area: docs

## Steps to reproduce
1. Open the developer docs' API sections: HTTP API (Overview, Market Data, Trading, Portfolio), WebSocket API (Overview, Real-Time Feed, Operations), Libraries > CCXT, and Contracts (Functions, Types, Errors).
2. Run [`scripts/013-perps-data-paths.ts`](../scripts/013-perps-data-paths.ts) (`cd scripts && npm install && node 013-perps-data-paths.ts`). It counts mentions of perps, MarginBank and the perps network (Hideki / 50383) in each of those pages. It also introspects the Hideki indexer's GraphQL schema for perp entities and subscriptions.
3. Read https://app.testnet.dreamdex.io/docs/developers/perps-testnet: its network table lists "Indexer (GraphQL) | https://hideki-dev.smk.somnia.host/v1/graphql", and the page builds only with `@somnia-chain/markets-sdk`.

## Expected
A perps developer who does not use the TypeScript SDK (a Python or Go bot, a backend, a data pipeline) can find a documented way to read perp markets, positions, margin, funding and liquidations and to stream them. That means one of: an HTTP or WebSocket API that covers the perps network, a contracts reference for MarginBank / PerpPool / LiquidationEngine, or a schema reference for the indexer the docs point to.

## Actual
- HTTP API and WebSocket API pages cover mainnet (5031) and Shannon testnet (50312) only. They never mention perps or the Hideki network (50383), where all perp markets live.
- CCXT page: spot only (`SOMI/USDC` examples), no perps.
- Contracts reference (Functions, Types, Errors): no mention of perps or MarginBank. It documents the shared order book entrypoints (for example `placeOrderFor`) but not MarginBank (margin, positions, funding settlement, vouchers), PerpPool's perp views, or the LiquidationEngine.
- The only machine interface for perps data besides the chain is the Hideki indexer. It serves 21 perp query roots and 21 perp subscriptions (`PerpPosition`, `FundingPayment`, `FundingRateUpdate`, `LiquidationEvent`, `MarginEvent`, `OpenInterestSnapshot`, `PerpOrderRejection`, …). The docs give its URL and nothing else: no entity list, field meanings, units or subscription usage. The SDK docs add that "its own field descriptions still carry the older wording" for liquidation fields.

In practice the TypeScript SDK is the only documented way to build on perps. The bounty asks to test the "Perps API", but there is no perps API reference to test against outside the SDK.

## Evidence
`node 013-perps-data-paths.ts`, 2026-10-21T09:55:07Z:

```
indexer https://hideki-dev.smk.somnia.host/v1/graphql: 21 perp query roots, 21 perp subscription roots
  e.g. FundingParametersEpoch, FundingPayment, FundingRateCandle, FundingRateUpdate, LendLiquidation, LiquidationEvent, MarginEvent, OpenInterestSnapshot, PendingPerpPositionChange, PerpFeeRecord, PerpFundingState, PerpInsuranceFundEvent
docs/developers/http-api                        perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 2
docs/developers/http-api/market-data            perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 2
docs/developers/http-api/trading                perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 0
docs/developers/http-api/portfolio              perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 0
docs/developers/websocket-api                   perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 0
docs/developers/websocket-api/real-time-feed    perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 1
docs/developers/websocket-api/operations        perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 0
docs/developers/libraries/ccxt                  perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 0
docs/developers/contracts/functions             perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 0
docs/developers/contracts/types                 perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 0
docs/developers/contracts/errors                perp 0 | MarginBank 0 | Hideki/50383 0 | Shannon/50312 0
```

An earlier pass in the same session, on saved copies of the same pages, gave the same zero counts. A separate introspection of the same indexer listed 27 perp-related query roots when position entities were included (`PerpPosition`, `PerpPositionChange`, `AccountPositionTouch`, …).

The HTTP API overview's base-URL table has exactly two rows: "Mainnet (Somnia) | 5031 | https://api.dreamdex.io/v0" and "Testnet (Somnia Shannon) | 50312 | https://stg.api.dreamdex.io/v0". There is no row for the perps network.

## Environment
Docs at https://app.testnet.dreamdex.io/docs as of 2026-10-21; Hideki indexer https://hideki-dev.smk.somnia.host/v1/graphql. Node 24 (fetch only). Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Read-only; no wallet needed.
