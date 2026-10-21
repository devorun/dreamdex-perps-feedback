# Test log

What was tested and what came out, so nothing is tested twice. Times are UTC.

## 2026-10-21: setup and read-only checks (no funds yet)

| # | Test | Result |
|---|---|---|
| 1 | Install `@somnia-chain/markets-sdk@0.32.1` in an empty project | OK. The docs give no install command. npm pulls `viem` as a peer; `react` and `@somnia-chain/reactivity` are optional peers. |
| 2 | Developer page "Connect" snippet, verbatim, read-only | OK: 21 perp markets, BTC row found. Exits on its own (indexer-only read). |
| 3 | Same with `privateKey` from `.env` | OK, `walletAddress` resolves. |
| 4 | Process exit after a chain read (`getPerpRiskParams`, `getPerpSystemConfig`) | Stays alive on the WebSocket until `markets.close()`. `close()` exists and works. Not reported: expected for a WS client. |
| 5 | Docs contracts table vs `getPerpSystemConfig` | All match. |
| 6 | `SOMNIA_HIDEKI_TESTNET_ADDRESSES.collateral` vs perps collateral | Different, as the docs' pitfall says. |
| 7 | Market table (tick, min size, leverage, IM/MM) vs chain | All match for 21 markets. |
| 8 | Base decimals table vs market rows | All match. |
| 9 | Open interest cap column and the "a tenth" rule vs `getPerpRiskParams` | Mismatch → **feedback 002**. |
| 10 | Paper USDso column vs `MarginBank.isVoucherMarketAllowed` | Mismatch → **feedback 001**. |
| 11 | Voucher campaign and eligibility | Live, 1000 USDso grant, `leverageCapX` 20; session wallet eligible. |
| 12 | `listPerpPoolStatuses` | 21 pools, all registered, none restricted. |
| 13 | SDK docs Quick start symbol `BTC/USDSO:USDSO` | Unknown symbol; the real one is `BTC/USDso:USDso`; misleading "call loadMarkets() first" → **feedback 003**. |
| 14 | SDK docs one-shot sample `listPerpMarkets({ baseSymbol: "WBTC" })` | 0 rows, then TypeError; "10 pools, four restricted" and "BTC and ETH only" are stale → **feedback 004**. |
| 15 | `getPerpState`, `getPerpFeedStatus`, `fetchTicker`, `fetchFundingRate` on BTC | Consistent with each other and with the indexer row (mark, index, funding rate, OI). |
| 16 | `fetchTicker.statsAsOf` is in the future | By design: TSDoc defines it as the end of the candle window. Not a bug. |
| 17 | `fetchTicker.lastSource.timestamp` is the candle bucket start, not the trade time | Documented in TSDoc. Not a bug. |
| 18 | `fetchOrderBook("BTC/USDso:USDso", 5)` | Prices on the 0.1 tick, sizes on the lot grid, best bid < best ask. |
| 19 | `getMaxPerpOrderSize` with a zero balance | `priceable: true`, `placeable: false`, `limitedBy: "collateral"`, `maxPositionSize` 100 BTC (matches risk params). |
| 20 | `getMarginAccount`, `fetchBalance`, `fetchPositions` on an empty account | Zeros / empty, `marginStatus: "Healthy"`. |
| 21 | dreamDEX HTTP API `GET https://stg.api.dreamdex.io/v0/markets` | Shannon only, 3 spot markets, no perps. The docs do not claim perps there. |
| 22 | Funding sign on BTC: mark < index while `fundingRate` > 0 | `emaPremium` > 0 (last trade above index). In this sample the rate was exactly `emaPremium` − 0.0005. The docs do not say how the rate is derived. Not reported yet; revisit when funding can be observed on a position. |

## Next (needs test funds)

- Claim the paper USDso voucher, then try an order on a market the docs mark `No` (confirms 001 end to end).
- Order lifecycle, validation edge cases, margin/PnL/funding numbers vs the docs' formulas.
- Bot kit perps examples (`perp-starter`, `perp-maker`, `perp:doctor`).
