# getMarginEvents ignores a sinceBlock/toBlock range without an error and returns the account's whole history, so the documented equity-flow netting is silently wrong
Severity: normal
Area: SDK

## Steps to reproduce
1. Read the SDK docs' Perps page, "Account equity for scoring is one read" (https://somnia-platform-docs.vercel.app/markets/somnia-markets/typescript/perps). To turn two `getAccountEquity` snapshots into a trading gain, the page removes the flows between them with three indexed reads that "each take the same inclusive `sinceBlock` / `toBlock`": `getMarginEvents`, `listPerpMarginPulls` and `listPerpMainFundingEvents`. It also says an inverted range "is rejected".
2. Call `client.getMarginEvents(account, { kinds: ["Deposit", "Credited", "Withdraw"], sinceBlock: head - 5n, toBlock: head, limit: 200, offset: 0 })` on an account whose deposits and credits are all older than that window. Repeat with an inverted range (`sinceBlock: head, toBlock: head - 10n`).
3. Or run [`scripts/021-margin-events-range-ignored.ts`](../scripts/021-margin-events-range-ignored.ts) (`cd scripts && npm install && node 021-margin-events-range-ignored.ts [account]`). It is read-only and needs no key.

## Expected
Only rows inside the 6-block window come back (here: none), and the inverted range is rejected. The net flow the procedure subtracts for that window is 0.

## Actual
In @somnia-chain/markets-sdk 0.32.1 the range is dropped without any error:
- The windowed call and the inverted call both return every row of the account's history: the same two `Credited` rows, from 2026-10-26 and 2026-10-20.
- The rows carry no `blockNumber`, so the caller cannot filter them afterwards either.
- Netting the window as the docs describe subtracts 2,000 USDso instead of 0.

`GetMarginEventsOptions` in 0.32.1 has `kinds`, `limit` and `offset` only. `listPerpMarginPulls` (`account, pool, orderId, source, limit, offset`) and `listPerpMainFundingEvents` (`account, payer, kind, limit, …`) have no block range either, so all three reads in the procedure accept the range and silently drop it.

How this relates to 017: 017 reports documented APIs that throw because 0.32.1 lacks them. This report is a data-correctness problem: the call succeeds, nothing signals that the range was ignored, and the result is a plausible-looking but wrong trading gain. For a scoring use (the page frames the procedure as how a competition such as Perps Arena would measure gains), every account's result is off by its entire deposit and credit history.

Suggested fix: support `sinceBlock` / `toBlock` (and `blockNumber` on the rows) in the released SDK, or reject unknown option keys with an `InvalidInputError` until it does. Until then, mark the procedure in the docs as requiring the unreleased version.

## Evidence
`node 021-margin-events-range-ignored.ts`, 2026-10-27T11:01:27Z:

```
head 34467031; range 34467026..34467031
getMarginEvents(no range): 2 rows; with the 6-block range: 2 rows; with an inverted range: 2 rows
rows returned for the 6-block range (none of them is in it):
  Credited  1000000000000000000000 at 2026-10-26T14:32:21.000Z tx 0x3a65ebdb17581e5e96ffea5676691ac7c14452b60017fedb0925939426864269 blockNumber field: (absent)
  Credited  1000000000000000000000 at 2026-10-20T19:53:19.000Z tx 0xf56659050a0488001ba78da10b81c3c39126ac4eaf2d201887d187e904046ee6 blockNumber field: (absent)
net flow the documented procedure would subtract for this 6-block window: 2000 USDso (expected 0)
```

Second run, 2026-10-27T11:01:41Z, range 34467168..34467173, and third run, 2026-10-27T11:20:04Z, range 34478194..34478199: the same two rows and the same 2000 USDso each time.

## Environment
@somnia-chain/markets-sdk 0.32.1 (npm `latest`), Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), indexer https://hideki-dev.smk.somnia.host/v1/graphql. Read-only; account `0xB667DAae78712068Ef9c2Cab61c3217901a0309A` used only as the subject of the reads.
