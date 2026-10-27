// Read-only checks of behavioural claims made in the docs shipped inside markets-sdk 0.32.1 (docs/PERPS.md).
import { SomniaMarkets, contractErrorsAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { ContractFunctionRevertedError, parseAbi } from "viem"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const, BOT = "0x29cF993A7c66d2Af212EEE430F120750023e8892" as const
const MB = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394" as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c: any = ex.client
const btc = (await c.listPerpMarkets({ baseSymbol: "BTC" }))[0], eth = (await c.listPerpMarkets({ baseSymbol: "ETH" }))[0]
const step = async (name: string, f: () => Promise<unknown>) => {
  const t = Date.now()
  try { console.log(`OK   ${name} (${Date.now() - t}ms): ${j(await f()).slice(0, 500)}`) } catch (e: any) { console.log(`ERR  ${name} (${Date.now() - t}ms): ${e?.name}${e?.errorName ? " errorName=" + e.errorName : ""} - ${String(e?.message).split("\n")[0].slice(0, 250)}`) }
}
const head = await c.getViemClient().getBlockNumber()
await step("1 getBankruptcyPrice on a flat account (docs: ContractRevertError errorName NoOpenPosition)", () => c.getBankruptcyPrice({ marginBank: MB, account: OWNER, pool: btc.poolAddress }))
await step("2 claimSomi eth_call with nothing owed (docs: reverts NothingToClaim)", async () => {
  const abi = [...parseAbi(["function claimSomi()"]), ...contractErrorsAbi]
  try { await c.getViemClient().simulateContract({ address: eth.stopRegistry, abi, functionName: "claimSomi", account: OWNER }); return "no revert" }
  catch (e: any) { const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError); return `revert ${r?.data?.errorName}` }
})
await step("3a getPerpVoucherEligibility(owner, claimed)", () => c.getPerpVoucherEligibility(MB, OWNER))
await step("3b getPerpVoucherEligibility(bot, never claimed, flat)", () => c.getPerpVoucherEligibility(MB, BOT))
await step("4a getMarginEvents inverted range (docs: rejected)", () => c.getMarginEvents(OWNER, { sinceBlock: head, toBlock: head - 10n, limit: 5 }))
await step("4b getMarginEvents order (docs: block, then log index)", async () => {
  const ev: any[] = await c.getMarginEvents(OWNER, { limit: 50 })
  const keys = ev.map((e) => [BigInt(e.blockNumber), Number(e.logIndex ?? -1)])
  const asc = keys.every((k, i) => i === 0 || k[0] > keys[i - 1][0] || (k[0] === keys[i - 1][0] && k[1] >= keys[i - 1][1]))
  const desc = keys.every((k, i) => i === 0 || k[0] < keys[i - 1][0] || (k[0] === keys[i - 1][0] && k[1] <= keys[i - 1][1]))
  return { rows: ev.length, fields: Object.keys(ev[0] ?? {}), ascending: asc, descending: desc, first: keys[0]?.map(String), last: keys.at(-1)?.map(String) }
})
await step("5 listPerpOrderHistory orderBy ended vs placed", async () => {
  const a: any[] = await c.listPerpOrderHistory(OWNER, { limit: 5 }), b: any[] = await c.listPerpOrderHistory(OWNER, { limit: 5, orderBy: "placed" })
  return { ended: a.map((r) => r.orderId).join(","), placed: b.map((r) => r.orderId).join(",") }
})
await step("6 listFundingRateHistory order asc/desc (docs: timestamp, then blockNumber, then id)", async () => {
  const d: any[] = await c.listFundingRateHistory(btc.poolAddress, { limit: 5, order: "desc" }), a: any[] = await c.listFundingRateHistory(btc.poolAddress, { limit: 5, order: "asc" })
  return { desc: d.map((r) => r.timestamp).join(","), asc: a.map((r) => r.timestamp).join(",") }
})
await step("7 getAccountEquity at a fixed blockNumber (head-1000)", () => c.getAccountEquity(OWNER, { scope: "perps", marginBank: MB, blockNumber: head - 1000n }))
await step("8a waitForIndexedBlock(chainId, head-20)", async () => { await c.waitForIndexedBlock(c.config.chain.id, head - 20n); return "resolved" })
await step("8b waitForIndexedBlock(chainId, head)", async () => { await c.waitForIndexedBlock(c.config.chain.id, head); return "resolved" })
await ex.close(); process.exit(0)
