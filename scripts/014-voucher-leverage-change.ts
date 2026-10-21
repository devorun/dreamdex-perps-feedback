// Without sending anything: traces setMaxLeverage(pool, x) called by a voucher account (debug_traceCall,
// prestateTracer diffMode + callTracer) and decodes the event, to check the docs' "leverage can't be changed
// while the voucher remains". Also simulates the same call with eth_call.
import { marginBankEventsAbi } from "@somnia-chain/markets-sdk"
import { createPublicClient, decodeEventLog, encodeFunctionData, http, parseAbi } from "viem"
const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const MB = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394"
const OWNER = (process.argv[2] ?? "0xB667DAae78712068Ef9c2Cab61c3217901a0309A") as `0x${string}`
const POOL = "0xd6cb1dd58580b84d76068ac21594219ce03aeddf" // ETH-PERP
const LEV = Number(process.argv[3] ?? 2)
const abi = parseAbi([
  "function setMaxLeverage(address perpPool, uint16 leverageX)",
  "function getMaxLeverage(address account, address perpPool) view returns (uint16)",
  "function getVoucher(address account) view returns (uint256)",
])
const pub = createPublicClient({ transport: http(RPC) })
const rpc = (method: string, params: unknown[]) => fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then((r) => r.json())
const blockNumber = await pub.getBlockNumber()
const tag = "0x" + blockNumber.toString(16)
const data = encodeFunctionData({ abi, functionName: "setMaxLeverage", args: [POOL, LEV] })
console.log(`block ${blockNumber}, caller ${OWNER}, setMaxLeverage(ETH-PERP, ${LEV})`)
const v = await (await import("@somnia-chain/markets-sdk")).SomniaMarkets
const sdk = new v({ chain: (await import("@somnia-chain/markets-sdk/chains")).hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
console.log("getPerpVoucher", JSON.stringify(await sdk.client.getPerpVoucher(MB, OWNER), (_, x) => (typeof x === "bigint" ? x.toString() : x)))
console.log("getMaxLeverage before", await pub.readContract({ address: MB, abi, functionName: "getMaxLeverage", args: [OWNER, POOL], blockNumber }))
try { await pub.call({ to: MB, data, account: OWNER, blockNumber }); console.log("eth_call: no revert") } catch (e: any) { console.log("eth_call: revert", e.shortMessage) }
const calls = await rpc("debug_traceCall", [{ from: OWNER, to: MB, data }, tag, { tracer: "callTracer", tracerConfig: { withLog: true } }])
const logs = [calls.result, ...(calls.result.calls ?? [])].flatMap((c: any) => c.logs ?? [])
for (const l of logs) {
  try { const d = decodeEventLog({ abi: marginBankEventsAbi as any, data: l.data, topics: l.topics }); console.log("event", d.eventName, JSON.stringify(d.args, (_, x) => (typeof x === "bigint" ? x.toString() : x))) }
  catch { console.log("event (undecoded)", l.topics[0], l.data) }
}
const diff = await rpc("debug_traceCall", [{ from: OWNER, to: MB, data }, tag, { tracer: "prestateTracer", tracerConfig: { diffMode: true } }])
const pre = diff.result.pre?.[MB.toLowerCase()]?.storage ?? {}, post = diff.result.post?.[MB.toLowerCase()]?.storage ?? {}
for (const k of Object.keys(post)) console.log(`storage write ${k}: ${pre[k] ?? "0x0"} -> ${post[k]}`)
if (!Object.keys(post).length) console.log("no storage write in MarginBank")
await sdk.close()
