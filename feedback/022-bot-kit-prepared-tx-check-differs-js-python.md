# bot kit (4e75896): the JS/TS and Python prepared-transaction checks decide differently on the same input (data without 0x, chainId "" or "50312.0") and throw raw errors on malformed values
Severity: normal
Area: bot kit

## Steps to reproduce
1. Check out somnia-chain/dreamdex-bot-kit at `4e75896` (merge of 64ee1bd, "Sanity-check and simulate prepared transactions in the examples").
2. The same check ships in three implementations that are meant to be equivalent:
   - JS: `examples/01-multi-strategy-ai/utils/prepared-tx-guard.js` (`checkPreparedTx`)
   - TS: `examples/03-monorepo-grid/packages/sdk/src/execution/prepared-tx-guard.ts` (`checkPreparedTx`)
   - Python: `prepared_tx_guard.py` (`check_prepared_tx`). The copies in 01, 04 and 06 are identical; the 05 copy is the async twin.
3. Run [`scripts/022-guard-differential.mjs`](../scripts/022-guard-differential.mjs) (`node 022-guard-differential.mjs <bot-kit>/examples`). It loads the kit's own files and sends the same 26 prepared transactions through all three, with the official-pool lookup stubbed to true. It prints accept / `PreparedTxRejected` / other error per implementation. It runs locally only and makes no network calls.
4. For comparison, run the kit's own tests: `node --test utils/prepared-tx-guard.test.js` (13 pass), `node --test test/prepared-tx-guard.test.mjs` (7 pass), `python test_prepared_tx_guard.py` (9 pass in 01, 04 and 05). None of them covers the inputs below.

## Expected
Given the same prepared transaction, the three implementations take the same decision. Any input the check cannot parse is refused with `PreparedTxRejected`, the error the callers handle, as the existing "refuses … malformed input" tests intend.

## Actual
They disagree on 7 of 26 inputs:

- **Calldata without the `0x` prefix:** JS/TS refuse it ("does not call a function"). Python accepts it, because `_hex()` silently prefixes `0x`, and returns the prefixed data for signing.
- **`chainId: ""`:** JS/TS refuse it (`Number("")` is 0, "prepared transaction is for chain , the bot is on chain 50312"). Python treats `""` as absent and skips the chain check.
- **`chainId: "50312.0"` or `50312.0` (float):** JS/TS accept it (`Number()` gives 50312). Python raises `ValueError` from `int()`, not `PreparedTxRejected`.
- **Unparsable `value`** (`"0x"`, `"1e3"`, `1.5`): no implementation refuses it with `PreparedTxRejected`. JS/TS throw a raw `SyntaxError` or `RangeError` from `BigInt()`, and Python throws `ValueError` from `int()`. A caller that catches `PreparedTxRejected` to skip one bad prepared transaction gets an unhandled exception instead.

So whether a given API response is signed, refused, or crashes the bot depends on which example the bot was built from. The test suites do not pin the shared contract: no test covers prefix handling, string or float `chainId`, empty strings, or malformed `value`.

Suggested fix: normalise once, identically, in all three implementations. Require a `0x`-prefixed calldata string. Parse `chainId` and `value` with one strict rule: integer or `0x` hex, everything else refused. Raise `PreparedTxRejected` for any field that does not parse. Then add a shared table of test vectors (like the 26 inputs here) that every implementation's test suite runs.

## Evidence
`node 022-guard-differential.mjs <bot-kit 4e75896>/examples`, 2026-10-30T15:33:43Z:

```
case                                         | JS                   | TS                   | Python
  baseline order                             | accept(value=0)     | accept(value=0)     | accept(value=0)
≠ data without 0x prefix                     | REJECT              | REJECT              | accept(value=0)
  data with 0X prefix                        | REJECT              | REJECT              | REJECT
  selector in upper case                     | accept(value=0)     | accept(value=0)     | accept(value=0)
  to in lower case                           | accept(value=0)     | accept(value=0)     | accept(value=0)
  to with 0X prefix                          | REJECT              | REJECT              | REJECT
  to with surrounding spaces                 | REJECT              | REJECT              | REJECT
≠ chainId ""                                 | REJECT              | REJECT              | accept(value=0)
  chainId missing                            | accept(value=0)     | accept(value=0)     | accept(value=0)
  chainId "0xc488" (hex string)              | accept(value=0)     | accept(value=0)     | accept(value=0)
  chainId "50312" (decimal string)           | accept(value=0)     | accept(value=0)     | accept(value=0)
≠ chainId "50312.0"                          | accept(value=0)     | accept(value=0)     | ERROR ValueError
≠ chainId 50312.0 (float)                    | accept(value=0)     | accept(value=0)     | ERROR ValueError
  chainId " 50312 "                          | accept(value=0)     | accept(value=0)     | accept(value=0)
  chainId "0XC488"                           | accept(value=0)     | accept(value=0)     | accept(value=0)
  value ""                                   | accept(value=0)     | accept(value=0)     | accept(value=0)
  value "0x0"                                | accept(value=0)     | accept(value=0)     | accept(value=0)
  value "0X0"                                | accept(value=0)     | accept(value=0)     | accept(value=0)
≠ value "0x"                                 | ERROR SyntaxError   | ERROR SyntaxError   | ERROR ValueError
  value " 0 "                                | accept(value=0)     | accept(value=0)     | accept(value=0)
≠ value "1e3"                                | ERROR SyntaxError   | ERROR SyntaxError   | ERROR ValueError
≠ value 1.5                                  | ERROR RangeError    | ERROR RangeError    | ERROR ValueError
  value "-0"                                 | accept(value=0)     | accept(value=0)     | accept(value=0)
  value "16" on cancelOrder (takes no coin)  | REJECT              | REJECT              | REJECT
  value "0x10" on cancelOrder (takes no coin) | REJECT              | REJECT              | REJECT
  value "  " (spaces)                        | accept(value=0)     | accept(value=0)     | accept(value=0)

26 inputs; implementations disagree on 7
```

Second run, 2026-10-30T15:34:03Z: the same seven rows differ in the same way.

The kit's own suites pass on the same checkout: JS 13/13, TS 7/7, Python 9/9 (01, 04, 05).

## Environment
dreamdex-bot-kit `4e75896` (main, 2026-10-30); Node 24.18 (runs the `.ts` file directly), Python 3.11. Local only: no chain or API was contacted, and the official-pool lookup was stubbed.
