// amendOrders on a perp pool when the replacement would cross as POST_ONLY. One real resting order (placed by the
// linked bot for the owner, cancelled at the end); the owner's amendOrders is only simulated (eth_call +
// debug_traceCall), so nothing is amended for real. Shows whether the original order survives (no-gap) or not.
import * as sdk from "@somnia-chain/markets-sdk"
import { SomniaMarkets, contractErrorsAbi, decodePlaceOrder } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, createWalletClient, decodeEventLog, encodeFunctionData, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "ETH"
const REQ = "(bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k)"
const ABI = [...parseAbi([
  "function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)",
  "function cancelOrderFor(address owner, uint128 orderId)",
  `function amendOrders((uint128 oldOrderId, bool alwaysPlace, ${REQ} newOrder)[] requests) returns (uint128[] newOrderIds)`,
]), ...contractErrorsAbi] as const
const evAbis = Object.entries(sdk).filter(([k, v]) => /EventsAbi$/.test(k) && Array.isArray(v)).flatMap(([, v]) => v as any[])
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
const pool = m.poolAddress as `0x${string}`, tick = BigInt(m.tickSize), minQ = BigInt(m.minQuantity)
await ex.loadMarkets()
const ob = await ex.fetchOrderBook(`${base}/USDso:USDso`, 1)
const P = (h: number) => (parseUnits(String(h), 18) / tick) * tick
const bestBid = P(ob.bids[0][0]), bestAsk = P(ob.asks[0][0])
const far = (bestBid * 98n) / 100n / tick * tick
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(RPC) })
const wal = createWalletClient({ account: bot, chain: hidekiTestnet, transport: http(RPC) })
const expire = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n
const Z = "0x0000000000000000000000000000000000000000" as const
const h = await wal.writeContract({ address: pool, abi: ABI, functionName: "placeOrderFor", args: [OWNER, true, 0n, far, minQ, expire, 3, 0, Z, 0n], gas: 10_000_000n })
const id = decodePlaceOrder(await pub.waitForTransactionReceipt({ hash: h }), pool).orderId!
console.log(`${base}: original resting bid ${id} @ ${far} (tx ${h}); best ask ${bestAsk}`)
const requests = [{ oldOrderId: id, alwaysPlace: false, newOrder: { isBid: true, userData: 0n, price: bestAsk, quantity: minQ, expireTimestampNs: expire, orderType: 3, selfMatchingOption: 0, builder: Z, builderFeeBpsTimes1k: 0n } }]
try { const { result } = await pub.simulateContract({ address: pool, abi: ABI, functionName: "amendOrders", args: [requests], account: OWNER, gas: 10_000_000n }); console.log(`eth_call amendOrders([replace with POST_ONLY @ best ask]) as owner -> success, newOrderIds ${j(result)}`) }
catch (e: any) { console.log(`eth_call amendOrders -> REVERT ${e.shortMessage?.split("\n")[0]}`) }
const data = encodeFunctionData({ abi: ABI, functionName: "amendOrders", args: [requests] })
const tr = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "debug_traceCall", params: [{ from: OWNER, to: pool, data, gas: "0x989680" }, "latest", { tracer: "callTracer", tracerConfig: { withLog: true } }] }) }).then((r) => r.json())
const walk = (c: any): any[] => [...(c.logs ?? []), ...(c.calls ?? []).flatMap(walk)]
console.log(`trace error: ${tr.result?.error ?? "none"}; events in order:`)
for (const l of walk(tr.result ?? {})) {
  try { const d: any = decodeEventLog({ abi: evAbis, data: l.data, topics: l.topics }); console.log(`  ${d.eventName} ${j(d.args)}`) } catch { console.log(`  (undecoded ${l.topics[0].slice(0, 10)})`) }
}
const c = await wal.writeContract({ address: pool, abi: ABI, functionName: "cancelOrderFor", args: [OWNER, id], gas: 10_000_000n })
console.log(`cleanup: cancel original ${id} tx ${c} status ${(await pub.waitForTransactionReceipt({ hash: c })).status}`)
await ex.close()
