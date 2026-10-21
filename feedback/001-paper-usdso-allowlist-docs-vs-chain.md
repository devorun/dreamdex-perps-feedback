# Paper USDso market allowlist in the docs contradicts MarginBank.isVoucherMarketAllowed
Severity: normal
Area: docs

## Steps to reproduce
1. Open https://app.testnet.dreamdex.io/docs/trading/perps-testnet. The market table marks 1000PEPE-PERP, LIT-PERP, PUMP-PERP, VVV-PERP, ZEC-PERP and ZRO-PERP as `No` under "Paper USDso".
2. Open https://app.testnet.dreamdex.io/docs/trading/perps-testnet/margin-and-liquidations, section "Paper USDso": "You can open or increase positions only in the markets marked Yes under Paper USDso in the market table. The six newest markets are not on that list."
3. Run [`scripts/001-voucher-allowlist.ts`](../scripts/001-voucher-allowlist.ts) (`cd scripts && npm install && node 001-voucher-allowlist.ts`). It reads `MarginBank.isVoucherMarketAllowed(pool)` on `0x478769E1177C0773c43A593DCCc4Ad15F15F1394` for every perp pool, with plain viem and no SDK.
4. As a cross-check, `client.getPerpLeverage({ marginBank, account, pool })` in `@somnia-chain/markets-sdk` 0.32.1 returns `voucherMarketAllowed: true` for the same six pools. It reads the same contract function.

## Expected
The docs and the chain agree on which markets a paper USDso (voucher) account can open or increase positions in. With the docs as written, `isVoucherMarketAllowed` returns `false` for the six `No` markets.

## Actual
`isVoucherMarketAllowed` returns `true` for all 21 perp pools, the six markets the docs mark `No` included. Either the docs are stale and the six markets are now on the allowlist, or the allowlist is wider than intended. A trader or bot that follows the docs skips markets it can trade. If the docs are right, the on-chain allowlist does not enforce them.

## Evidence
`node 001-voucher-allowlist.ts`, run 2026-10-21T06:14:45Z (a first run at block 29110279 and a second at block 29112438 gave the same values):

```
block 29113580
market    pool                                        docs  isVoucherMarketAllowed
1000PEPE  0xfa9b9e50cc1745113d57893991af200a74c86b6f  No    true
ADA       0x34fa62909f77699a7a6278d992f72ff31c7a619d  Yes   true
AVAX      0xde9762b6b441133d1314c68864ae4e63a6ee45c7  Yes   true
BNB       0x3d2a99fe1e2bdeaa25024515a2d2202daf9531ad  Yes   true
BTC       0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0  Yes   true
DOGE      0xc410012e39765cd5f772e84bacb19554aec040df  Yes   true
ETH       0xd6cb1dd58580b84d76068ac21594219ce03aeddf  Yes   true
HYPE      0x63b47ed4a7de0fde659b0d82441dd74828b7297a  Yes   true
LINK      0xf71b619450bafe953f47b9b556416a3a67b443b5  Yes   true
LIT       0xdcb0ad226727b2ce92857f0af5751389d42b2a3f  No    true
NEAR      0x1cd15ae8bff0fe0a7f49233be8b90734775ba454  Yes   true
PUMP      0x76c981a52530cdf9497559140aafcd8cd16836e7  No    true
SOL       0xb483ec1fb34996638677c20ab087b16f1896fa53  Yes   true
SUI       0x1be21287cfb865a7c462ff3c4f275e70bcccefe4  Yes   true
TAO       0xd9b6a347a3ae9fd6ba21179d3343f2c8a922f697  Yes   true
VVV       0x352636ab146039851ef06d6367a106d5fb4e6409  No    true
WLD       0x0f464d57c1fd839e4d87a408bbccdab8f77e6394  Yes   true
XLM       0x74b05b9b8c8f180b53b7891018f3b254b3e658c9  Yes   true
XRP       0x7058579f3248559963f79adb937c6de9f953e060  Yes   true
ZEC       0x2a73129f26917124bd2a47a9b355c395c537f050  No    true
ZRO       0x2a1822b02039ddf0e293f3f7243673fc03eaf16c  No    true
```

The voucher campaign is live at the same time (`client.getPerpVoucherCampaign(marginBank)`): distributor `0x2ACD9EFdA721450906bfE1bef3edE269636E42C4`, `grantAmount` 1000 USDso, `leverageCapX` 20.

On a real voucher account the SDK's order gates agree with the chain, not the docs. Account `0xB667DAae78712068Ef9c2Cab61c3217901a0309A` holds a claimed voucher (`getPerpVoucher`: `claimed: true`, floor 1000 USDso) and 1000 USDso unlocked margin, `withdrawable` 0. At block 29128586 (2026-10-21), for a min-size bid at the mark, `getPerpLeverage`, `getMaxPerpOrderSize` and `previewPerpOrderMargin` returned:

```
BTC  {"voucherMarketAllowed":true,"voucherLeverageCapX":20,"placeable":true,"limitedBy":"collateral","voucherBlocked":false}
ZEC  {"voucherMarketAllowed":true,"voucherLeverageCapX":20,"placeable":true,"limitedBy":"collateral","voucherBlocked":false}
LIT  {"voucherMarketAllowed":true,"voucherLeverageCapX":20,"placeable":true,"limitedBy":"collateral","voucherBlocked":false}
ZRO  {"voucherMarketAllowed":true,"voucherLeverageCapX":20,"placeable":true,"limitedBy":"collateral","voucherBlocked":false}
```

ZEC, LIT and ZRO are `No` markets in the docs, yet nothing reports them as voucher-blocked.

## Environment
@somnia-chain/markets-sdk 0.32.1, viem 2.57.7, Node 24. Network: Somnia Tokyo testnet (Hideki, chain ID 50383), RPC https://api.hideki2.infra.testnet.somnia.network. Wallet: none needed (read-only). Session wallet 0x344F9c80c7E4dF61080BDE9183CBD1C71eE61E40.
