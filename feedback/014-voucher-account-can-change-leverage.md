# Docs say a paper USDso (voucher) account can't change its leverage setting, but setMaxLeverage succeeds and writes the new value
Severity: normal
Area: docs

## Steps to reproduce
1. Read the claims:
   - https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations, "Paper USDso": "Your leverage setting can't be changed while it remains."
   - SDK docs, Perps > "Credit vouchers": "The grant confines position increases. Only allowlisted markets, at no more than the voucher leverage cap, and the account cannot change its own leverage setting."
2. Take an account that holds a claimed voucher: `0xB667DAae78712068Ef9c2Cab61c3217901a0309A` (`getPerpVoucher`: `claimed: true`, floor 1000 USDso, not expired).
3. Run [`scripts/014-voucher-leverage-change.ts`](../scripts/014-voucher-leverage-change.ts) (`cd scripts && npm install && node 014-voucher-leverage-change.ts <voucherAccount> <leverageX>`). Nothing is signed or sent. It runs `MarginBank.setMaxLeverage(ETH-PERP, x)` from the voucher account as `eth_call`, then traces the same call with `debug_traceCall` (callTracer for events, prestateTracer diffMode for storage writes).

## Expected
`setMaxLeverage` from a voucher account reverts (or at least changes nothing), as both pages say.

## Actual
The call does not revert. It emits `MaxLeverageSet(account, perpPool, leverageX)` and writes the new value to MarginBank storage (`0 → 2` for 2x). A voucher account can therefore set its own per-market leverage. A wallet or bot that trusts the docs hides or skips the leverage control for voucher users, which today is every Perps Arena account. The bot kit's strategies, for example, print "leverage on ETH-PERP is unset for this account … set it in the app".

The SDK's own `getPerpLeverage` notes say a voucher cap "replaces an unset or looser accountMaxLeverageX". That implies a tighter setting is honoured, which conflicts with "cannot change". Either the docs or the contract is wrong.

## Evidence
`node 014-voucher-leverage-change.ts 0xB667DAae78712068Ef9c2Cab61c3217901a0309A 2`, 2026-10-21T10:01:52Z, block 29249700:

```
getPerpVoucher {"claimed":true,"floor":"1000000000000000000000","expiresAt":"1793735599"}
getMaxLeverage before 0
eth_call: no revert
event MaxLeverageSet {"account":"0xB667DAae78712068Ef9c2Cab61c3217901a0309A","perpPool":"0xD6Cb1DD58580B84D76068aC21594219ce03aeddf","leverageX":2}
storage write 0xb46d6c7d6eb8e377532fc296a3b1626b31da83ef4c5c1ec4edd15f27b0275451: 0x…0000 -> 0x…0002
```

Second run with 10x, 2026-10-21T10:02:10Z, block 29249886: `eth_call: no revert` and `event MaxLeverageSet {..., "leverageX":10}`.

Earlier `eth_call` simulations at block 29249208 returned success for `setMaxLeverage(ETH, 2 | 5 | 10 | 20)` from the same account. The other voucher rule on the page does hold: `withdraw(1 wei)` from the same account reverts `WithdrawalBelowCreditFloor()`.

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), MarginBank `0x478769E1177C0773c43A593DCCc4Ad15F15F1394`, ETH-PERP `0xd6cb1dd58580b84d76068ac21594219ce03aeddf`. Simulation and tracing only. The account is the owner `0xB667DAae78712068Ef9c2Cab61c3217901a0309A`; no transaction was sent from it.
