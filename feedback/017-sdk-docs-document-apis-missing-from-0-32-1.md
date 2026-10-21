# SDK Perps docs document APIs that @somnia-chain/markets-sdk 0.32.1 does not have (quotePerpClose, getPerpPositionsPage, CreditReclaimed); their samples throw
Severity: normal
Area: docs

## Steps to reproduce
1. Install the version the dreamDEX developer page says the app runs ("this page uses version 0.32.1, the one the app runs"), which is also npm `latest`: `npm install @somnia-chain/markets-sdk@0.32.1`.
2. Follow the SDK docs' Perps page (https://somnia-platform-docs.vercel.app/markets/somnia-markets/typescript/perps):
   - "Closing when the book is thin": `const q = await client.quotePerpClose({ pool, marginBank, account })`, and `exchange.quotePerpClose(symbol)`.
   - "Every account at once": `client.getPerpPositionsPage({ pool, minSize, includeFlat, cursor })`.
   - The equity-flow procedure in "The shape": `client.getMarginEvents(account, { kinds: ["Deposit", "Credited", "Withdraw", "CreditReclaimed"], ...range, ...page })`.
3. Run [`scripts/017-docs-vs-sdk-surface.ts`](../scripts/017-docs-vs-sdk-surface.ts) (`cd scripts && npm install && node 017-docs-vs-sdk-surface.ts`). It extracts every `client.*`, `trader.*` and `exchange.*` call from that page and checks each one against the installed SDK (live objects for client and exchange, typings for trader). Then it runs the margin-event filter from the equity-flow sample.

## Expected
Every method and option the Perps page documents exists in the SDK version the docs tell developers to use, and the samples run.

## Actual
In 0.32.1, 3 of the 82 documented calls do not exist, and the equity-flow filter is rejected:
- `client.quotePerpClose` → `TypeError: client.quotePerpClose is not a function`
- `exchange.quotePerpClose` → not a method
- `client.getPerpPositionsPage` → `TypeError: client.getPerpPositionsPage is not a function`
- `getMarginEvents(..., { kinds: [..., "CreditReclaimed"] })` → `InvalidInputError: Margin event kinds must contain only Deposit, Withdraw, Locked, Unlocked, Credited; got CreditReclaimed`

The equity-flow procedure is the one the page presents for scoring a competition (Perps Arena style: "Account equity for scoring is one read"), so the documented scoring code fails on its first indexed read. None of these appear in the copy of the docs shipped inside the 0.32.1 package (`docs/PERPS.md`), so the website documents a newer, unreleased SDK without saying so.

## Evidence
`node 017-docs-vs-sdk-surface.ts`, 2026-10-21T10:14:35Z:

```
SDK 0.32.1; docs page https://somnia-platform-docs.vercel.app/markets/somnia-markets/typescript/perps
methods called in the docs: 82; present 79; missing 3
  MISSING client.getPerpPositionsPage
  MISSING client.quotePerpClose
  MISSING exchange.quotePerpClose
getMarginEvents(kinds incl. CreditReclaimed) -> InvalidInputError: @somnia-chain/markets-sdk: Margin event kinds must contain only Deposit, Withdraw, Locked, Unlocked, Credited; got CreditReclaimed
```

First run, 2026-10-21T10:11:50Z, calling the samples directly ([`scripts/sdk-doc-samples.ts`](../scripts/sdk-doc-samples.ts)):

```
FAIL quotePerpClose({ pool, marginBank, account }) (flat account): TypeError - client.quotePerpClose is not a function
FAIL getMarginEvents kinds Deposit/Credited/Withdraw/CreditReclaimed: InvalidInputError - @somnia-chain/markets-sdk: Margin event kinds must contain only Deposit, Withdraw, Locked, Unlocked, Credited; got CreditReclaimed
FAIL getPerpPositionsPage({ pool }): TypeError - client.getPerpPositionsPage is not a function
```

`grep -c` over `node_modules/@somnia-chain/markets-sdk/docs/PERPS.md` (0.32.1): `quotePerpClose` 0, `getPerpPositionsPage` 0. `npm view @somnia-chain/markets-sdk dist-tags.latest` = `0.32.1`.

## Environment
@somnia-chain/markets-sdk 0.32.1 (npm `latest`), Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383). Read-only; account `0xB667DAae78712068Ef9c2Cab61c3217901a0309A` used only as a subject for reads.
