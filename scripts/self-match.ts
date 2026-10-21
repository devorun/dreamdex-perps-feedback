// Self-trade prevention vs the "My order was rejected" FAQ. One real order: the owner's resting bid (POST_ONLY),
// cancelled at the end. The incoming self-matching sells are only simulated (eth_call + debug_traceCall for fills).
//   node --env-file=../.env self-match.ts <BASE> <mode: top|behind> [selfMatchingOption 0|1]
import { SomniaMarkets, contractErrorsAbi, decodePlaceOrder, perpPoolEventsAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import * as sdk from "@somnia-chain/markets-sdk"
import { ContractFunctionRevertedError, createPublicClient, createWalletClient, decodeEventLog, encodeFunctionData, formatUnits, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const [base = "ETH", mode = "behind", smoArg = "0"] = process.argv.slice(2)
const SMO = Number(smoArg)
const ABI = [...parseAbi([
  "function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)",
  "function cancelOrderFor(address owner, uint128 orderId)",
]), ...contractErrorsAbi] as const
const evAbis = Object.entries(sdk).filter(([k, v]) => /EventsAbi$/.test(k) && Array.isArray(v)).flatMap(([, v]) => v as any[])
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
const pool = m.poolAddress as `0x${string}`, tick = BigInt(m.tickSize), lot = BigInt(m.lotSize), minQ = BigInt(m.minQuantity), bd = m.baseDecimals
await ex.loadMarkets()
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(RPC) })
const wal = createWalletClient({ account: bot, chain: hidekiTestnet, transport: http(RPC) })
const expire = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n
const Z = "0x0000000000000000000000000000000000000000" as const
const P = (h: number) => (parseUnits(String(h), 18) / tick) * tick
const Q = (h: number) => (parseUnits(String(h), bd) / lot) * lot

let ob = await ex.fetchOrderBook(`${base}/USDso:USDso`, 10)
const bestBid = P(ob.bids[0][0]), bestAsk = P(ob.asks[0][0])
const ours = mode === "top" ? bestBid + tick : bestBid - 5n * tick
if (ours >= bestAsk) throw new Error("no room for a non-crossing bid")
console.log(`${base} bestBid ${formatUnits(bestBid, 18)} bestAsk ${formatUnits(bestAsk, 18)} -> our resting bid @ ${formatUnits(ours, 18)} (${mode}), selfMatchingOption for the incoming sell = ${SMO}`)
const placeArgs = [OWNER, true, 0n, ours, minQ, expire, 3, 0, Z, 0n] as const
await pub.simulateContract({ address: pool, abi: ABI, functionName: "placeOrderFor", args: placeArgs, account: bot, gas: 10_000_000n }) // throws (nothing sent) if it would cross
const h = await wal.writeContract({ address: pool, abi: ABI, functionName: "placeOrderFor", args: placeArgs, gas: 10_000_000n })
const rc = await pub.waitForTransactionReceipt({ hash: h })
if (rc.status !== "success") { console.log("our bid did not rest; nothing to test or cancel"); await ex.close(); process.exit(0) }
const oursId = decodePlaceOrder(rc, pool).orderId!
console.log(`our bid tx ${h} status ${rc.status} id ${oursId}`)

ob = await ex.fetchOrderBook(`${base}/USDso:USDso`, 20)
const others = ob.bids.filter(([p]) => P(p) >= ours).reduce((s, [p, q]) => s + Q(q), 0n) - minQ // depth at/above our price minus our own order
const sellQty = mode === "top" ? minQ : others + minQ
console.log(`book depth ahead of / beside us at >= our price (others): ${formatUnits(others, bd)}; simulated IOC sell ${formatUnits(sellQty, bd)} @ ${formatUnits(ours, 18)}`)
const args = [OWNER, false, 0n, ours, sellQty, expire, 2, SMO, Z, 0n] as const
try {
  const { result } = await pub.simulateContract({ address: pool, abi: ABI, functionName: "placeOrderFor", args, account: bot, gas: 10_000_000n })
  console.log(`eth_call: success ${j(result)}`)
} catch (e: any) {
  const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError)
  console.log(`eth_call: REVERT ${r?.data?.errorName}(${j(r?.data?.args ?? [])})`)
}
const data = encodeFunctionData({ abi: ABI, functionName: "placeOrderFor", args })
const tr = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "debug_traceCall", params: [{ from: bot.address, to: pool, data, gas: "0x989680" }, "latest", { tracer: "callTracer", tracerConfig: { withLog: true } }] }) }).then((r) => r.json())
const walk = (c: any): any[] => [...(c.logs ?? []), ...(c.calls ?? []).flatMap(walk)]
const names: Record<string, number> = {}
let filled = 0n
for (const l of walk(tr.result ?? {})) {
  try { const d: any = decodeEventLog({ abi: evAbis, data: l.data, topics: l.topics }); names[d.eventName] = (names[d.eventName] ?? 0) + 1; if (/fill/i.test(d.eventName) && d.args.quantity != null) filled += BigInt(d.args.quantity); if (/self|reject|cancel/i.test(d.eventName)) console.log(`  trace event ${d.eventName} ${j(d.args)}`) } catch { names["?" + l.topics[0].slice(0, 10)] = (names["?" + l.topics[0].slice(0, 10)] ?? 0) + 1 }
}
console.log(`trace: error ${tr.result?.error ?? "none"}; events ${j(names)}`)
const c = await wal.writeContract({ address: pool, abi: ABI, functionName: "cancelOrderFor", args: [OWNER, oursId], gas: 10_000_000n })
console.log(`cancel our bid tx ${c} status ${(await pub.waitForTransactionReceipt({ hash: c })).status}`)
await ex.close()
