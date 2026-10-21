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

## 2026-10-21: bot kit (no funds)

Setup: owner (app account) `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`, bot key `0x29cF993A7c66d2Af212EEE430F120750023e8892` (not linked yet). The session wallet `0x344F…1E40` is empty and no longer used.

| # | Test | Result |
|---|---|---|
| 23 | Bot kit `npm ci` at `2579866` | OK. npm 11 warns that the esbuild postinstall is not in allowScripts; tsx still runs. perp-core resolves SDK 0.31.0, while the docs say the app runs 0.32.1. No failure seen from that yet. |
| 24 | `npm run perp:doctor` with bot key + OWNER_ADDRESS | OK: link `NOT LINKED`, bot gas 0 STT, owner margin 1000 unlocked / 0 withdrawable (voucher), 21 markets. |
| 25 | perp:doctor price formatting | `toFixed(2)` shows LIT/NEAR/SUI/XRP books as bid = ask → **feedback 005**. |
| 26 | Owner voucher account: `getPerpLeverage`, `getMaxPerpOrderSize`, `previewPerpOrderMargin` on BTC/ZEC/LIT/ZRO/TAO | All placeable, not voucher-blocked → added to **feedback 001**. |
| 27 | perp-core `sizeOrder` / `alignQuantity` / `placePerp` (code read) | Sizes via `getMaxPerpOrderSize`; lot alignment down; returns 0 below minQuantity; IOC no-fill and PostOnlyWouldCross handled. Nothing reportable. |
| 28 | Funding display on perp:doctor | Most markets show 10.950% APR (pays shorts) = 0.01% per 8h × 3 × 365, the positive floor the kit's comment mentions. |

## 2026-10-21: orders as a linked bot (owner `0xB667…309A`, bot `0x29cF…8892`)

| # | Test | Result |
|---|---|---|
| 29 | perp:doctor after linking | `link: ok on all 21 markets`, bot gas 5 STT. |
| 30 | Voucher account opens ZEC (docs: not allowed) | Filled, then closed → **001** confirmed end to end. |
| 31 | Gas / cost per successful `placeOrderFor` | 2.7M-4.3M gas, 0.016-0.026 STT at 6 gwei → **007**. Resting orders 1.1M-1.8M; cancel 173k; reduce 117k; a reverting IOC 110k. |
| 32 | `getPerpPosition.lastUpdatedTimestampNs` / `fetchPositions().timestamp` | Always 0 / 1970 → **006**. |
| 33 | IOC that misses the touch | Status 0; replay at parent block decodes `ImmediateOrCancelNoFill`, as the docs say. |
| 34 | Validation via simulation (`edge-sims.ts`) | qty 0 / below min → `QuantityBelowMinimum`; off lot → `InvalidQuantity`; off tick / 0 price → `InvalidPrice`; post-only crossing → `PostOnlyWouldCross`; FOK too large → `FillOrKillNotFillable`; past/0 expiry → `OrderAlreadyExpired`; builder fee w/o approval → `BuilderFeeExceedsApproval`; msg.value → `UnexpectedNativeDeposit`; > maxPositionSize at a tiny price → `MaxPositionSizeExceeded`; 18-dec qty scale → `InsufficientCollateral` (as the docs say). orderType 4 → bare revert (enum panic, not reported). Resting bids at 1 tick and asks at 2x the book are accepted (the band applies to fills only). |
| 35 | Resting order lock | locked = qty × price × IMF exactly (1.0231 for 0.00026 @ 78700 × 5%). |
| 36 | reduce → cancel → cancel again | Second cancel: `IncorrectSender(owner, 0x0 / other trader)` instead of the documented `OrderIdMismatch` → **008**. |
| 37 | Same-owner slot reuse + stale id | Stale id reverts `IncorrectOrder`; the newer order is untouched. No correctness bug. |
| 38 | Reduce-only for regular orders | Not in the ABI or `CreateOrderParams`; `reduceOnly` param silently dropped → **009**. |
| 39 | Analytics vs hand math (uPnL, notional, IM/MM, previewClose, leverage) | Equal to the wei. Liquidation price clamps to 0 for an over-collateralised long. |
| 40 | `placeOrdersFor` batch with an unfillable IOC | `successes [false, true]`; indexer rejection `ImmediateOrCancelNoFill`, `requestIndex 0`, as documented. |
| 41 | `fullQuantity` after reduce | Rewritten to the reduced size; history calls it "original size" → **010**. |
| 42 | bot kit perp-starter `DRY_RUN=true` on ETH-PERP, 20 USDso | Sizes 0.0082 ETH; TP/SL from the mark. Nothing sent. |
| 43 | Funding history rows vs chain | Each hourly row moves `cumulativeFundingPerUnit` by ≈ index × rate / 8, as the docs say. |
| 44 | `watchOrderBook` (30 s, ETH) vs `fetchOrderBook` | 25 updates, never crossed, timestamps monotonic, final book identical. |
| 45 | `getMaxPerpOrderSize` vs pool acceptance (ETH, 4 cases) | Identical when simulated at the SDK's `asOfBlock`. A first run at a different block looked off by one lot; that was the block, not a bug. |

## Next (needs test funds)

- Claim the paper USDso voucher, then try an order on a market the docs mark `No` (confirms 001 end to end).
- Order lifecycle, validation edge cases, margin/PnL/funding numbers vs the docs' formulas.
- Bot kit perps examples (`perp-starter`, `perp-maker`, `perp:doctor`).
