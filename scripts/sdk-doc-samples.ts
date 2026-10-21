// Runs the read-only code samples of the SDK docs' Perps page, as written (setup and logging added),
// against the owner account and BTC-PERP. Each sample is isolated so one failure does not hide the rest.
import { SomniaMarkets, liquidationEngineEventsAbi, marginBankEventsAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { getAbiItem } from "viem"
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const exchange = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const client = exchange.client
const account = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const perp = (await client.listPerpMarkets({ baseSymbol: "BTC" }))[0]
const { marginBank, poolAddress: pool } = perp
const step = async (name: string, f: () => Promise<unknown>) => {
  try { const r = await f(); console.log(`OK   ${name}: ${j(r).slice(0, 400)}`) } catch (e: any) { console.log(`FAIL ${name}: ${e?.name} - ${String(e?.message).slice(0, 300)}`) }
}
await step("getPerpSideHolders + getBankruptcyPrice (keeper sample)", async () => {
  const { holders, asOfBlock } = await client.getPerpSideHolders({ marginBank, pool, isLong: true })
  const prices = await Promise.all(holders.slice(0, 3).map((h) => client.getBankruptcyPrice({ marginBank, account: h, pool }, { blockNumber: asOfBlock })))
  return { holders: holders.length, asOfBlock, firstPrices: prices }
})
await step("getBankruptcyPrice on a flat account (docs: ContractRevertError NoOpenPosition)", () => client.getBankruptcyPrice({ marginBank, account, pool }))
await step("perpAdlQueue.getSnapshot (ADL sample)", async () => {
  const view: any = await (client as any).perpAdlQueue.getSnapshot({ marginBank, pool, isLong: true })
  return { status: view.status, regime: view.data?.queue?.regime, holders: view.data?.queue?.holders?.length, orderSource: view.data?.queue?.orderSource }
})
await step("perpAdlQueue.subscribe 8s (ADL sample)", () => new Promise((res) => {
  const seen: string[] = []
  const stop = (client as any).perpAdlQueue.subscribe({ marginBank, pool, isLong: true }, (view: any) => { seen.push(view.status) })
  setTimeout(() => { stop(); res({ statuses: seen }) }, 8000)
}))
await step("protocol state sample", async () => {
  const cfg = await client.getPerpSystemConfig(marginBank)
  const fund = await client.getInsuranceFundState(cfg.insuranceFund)
  const eng = await client.getLiquidationEngineConfig(cfg.liquidationEngine)
  return { fullyWired: cfg.fullyWired, fund: fund.totalBalance, bidders: eng.bidderCount }
})
await step("tryGetPerpAccountEquity / getPerpCollateralBasis", async () => ({ eq: await (client as any).tryGetPerpAccountEquity(marginBank, account), basis: await (client as any).getPerpCollateralBasis(marginBank, account) }))
await step("quotePerpClose({ pool, marginBank, account }) (flat account)", () => client.quotePerpClose({ pool, marginBank, account }))
await step("quotePerpClose({ pool, marginBank, isBid, quantity }) bare size", () => client.quotePerpClose({ pool, marginBank, isBid: false, quantity: 13000n } as any))
await step("getUnclaimedPerpStopSomi (stop sample)", () => client.getUnclaimedPerpStopSomi({ registry: perp.stopRegistry!, account }))
await step("getAccountEquity scope perps", () => client.getAccountEquity(account, { scope: "perps", marginBank }))
await step("getAccountEquity scope spot (docs: throws NotSupportedError)", () => client.getAccountEquity(account, { scope: "spot" } as any))
await step("waitForIndexedBlock(chainId, head-5)", async () => { const b = (await client.getViemClient().getBlockNumber()) - 5n; await client.waitForIndexedBlock(client.config.chain.id, b); return b })
await step("getMarginEvents kinds Deposit/Credited/Withdraw/CreditReclaimed", () => client.getMarginEvents(account, { kinds: ["Deposit", "Credited", "Withdraw", "CreditReclaimed"], limit: 5 } as any))
await step("listPerpMarginPulls", () => client.listPerpMarginPulls({ account, limit: 5 } as any))
await step("listPerpMainFundingEvents Returned", () => client.listPerpMainFundingEvents({ account, kind: "Returned", limit: 5 } as any))
await step("history one-shots (getFundingPayments, getMarginEvents, listLiquidations, listPerpPositionChanges)", async () => ({
  funding: (await client.getFundingPayments(account, { pool, limit: 50 } as any)).length,
  margin: (await client.getMarginEvents(account, { limit: 50 } as any)).length,
  liqs: (await client.listLiquidations({ party: account, pool } as any)).length,
  changes: (await client.listPerpPositionChanges({ account, pool } as any)).length,
}))
await step("listFundingRateCandles(pool, 3600)", async () => (await client.listFundingRateCandles(pool, 3600, {} as any)).length)
await step("getOpenInterestHistory(pool)", async () => (await client.getOpenInterestHistory(pool)).length)
await step("watch-from-chain sample: getPerpMarket(perpMarketId) + getAbiItem", async () => {
  const market = await client.getPerpMarket(perp.id)
  const { liquidationEngine } = await client.getPerpSystemConfig(market!.marginBank)
  return { market: market?.baseSymbol, liquidationEngine, fundingSettled: !!getAbiItem({ abi: marginBankEventsAbi as any, name: "FundingSettled" }), positionLiquidated: !!getAbiItem({ abi: liquidationEngineEventsAbi as any, name: "PositionLiquidated" }) }
})
await step("one-shot reads sample (getPerpPortfolio, listPerpOrderHistory, getPerpState)", async () => {
  const port: any = await client.getPerpPortfolio(account, { ordersLimit: 50, tradesLimit: 50 })
  const hist = await client.listPerpOrderHistory(account, { limit: 100 })
  const state = await client.getPerpState(pool)
  return { portfolioKeys: Object.keys(port), tradesSince: port.tradesSince, hist: hist.length, mark: state.markPrice }
})
await step("listPerpPositions(account) / includeFlat", async () => ({ open: (await client.listPerpPositions(account)).length, withFlat: (await client.listPerpPositions(account, { includeFlat: true } as any)).length }))
await step("getPerpPositionsPage({ pool })", async () => { const p: any = await client.getPerpPositionsPage({ pool } as any); return { rows: p.rows?.length ?? p.positions?.length ?? Object.keys(p), nextCursor: p.nextCursor } })
await exchange.close()
