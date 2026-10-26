// Simulation only: taker orders priced far beyond the pool's circuit-breaker band. Traces fills (eth_call + debug_traceCall).
//   node --env-file=../.env band-sims.ts <BASE> <qty> <pctBelowMark> [orderType: 2=IOC 0=LIMIT]
import * as sdk from "@somnia-chain/markets-sdk"
import { SomniaMarkets, contractErrorsAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { ContractFunctionRevertedError, createPublicClient, decodeEventLog, encodeFunctionData, formatUnits, http, parseAbi, parseUnits, toFunctionSelector } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const [base = "ETH", qtyH = "0.5", pctH = "10", typeH = "2"] = process.argv.slice(2)
const ABI = [...parseAbi(["function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)"]), ...contractErrorsAbi] as const
const evAbis = Object.entries(sdk).filter(([k, v]) => /EventsAbi$/.test(k) && Array.isArray(v)).flatMap(([, v]) => v as any[])
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
const pool = m.poolAddress as `0x${string}`, tick = BigInt(m.tickSize), lot = BigInt(m.lotSize)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(RPC) })
const cb = await pub.call({ to: pool, data: toFunctionSelector("getCircuitBreakerParameters()") })
const bandBps = BigInt("0x" + (cb.data ?? "0x").slice(2, 66))
const st = await ex.client.getPerpState(pool)
const mark = st.markPrice
const price = (mark * (10000n - BigInt(Math.round(Number(pctH) * 100))) / 10000n / tick) * tick
const qty = (parseUnits(qtyH, m.baseDecimals) / lot) * lot
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const expire = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n
const args = [OWNER, false, 0n, price, qty, expire, Number(typeH), 0, "0x0000000000000000000000000000000000000000", 0n] as const
const bandFloor = (mark * (10000n - bandBps)) / 10000n
console.log(`${base} mark ${formatUnits(mark, 18)} band ${bandBps} bps -> band floor ${formatUnits(bandFloor, 18)}; simulated sell ${qtyH} @ ${formatUnits(price, 18)} (${pctH}% under mark), orderType ${typeH}`)
try { const { result } = await pub.simulateContract({ address: pool, abi: ABI, functionName: "placeOrderFor", args, account: bot, gas: 10_000_000n }); console.log(`eth_call: success ${JSON.stringify(result, (_, x) => (typeof x === "bigint" ? x.toString() : x))}`) }
catch (e: any) { const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError); console.log(`eth_call: REVERT ${r?.data?.errorName}(${JSON.stringify(r?.data?.args ?? [], (_, x) => (typeof x === "bigint" ? x.toString() : x))})`) }
const tr = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "debug_traceCall", params: [{ from: bot.address, to: pool, data: encodeFunctionData({ abi: ABI, functionName: "placeOrderFor", args }), gas: "0x989680" }, "latest", { tracer: "callTracer", tracerConfig: { withLog: true } }] }) }).then((r) => r.json())
const walk = (c: any): any[] => [...(c.logs ?? []), ...(c.calls ?? []).flatMap(walk)]
const logs = walk(tr.result ?? {}).map((l: any, i: number) => ({ ...l, address: l.address, logIndex: i, data: l.data, topics: l.topics }))
const names: Record<string, number> = {}
for (const l of logs) { try { const d: any = decodeEventLog({ abi: evAbis, data: l.data, topics: l.topics }); names[d.eventName] = (names[d.eventName] ?? 0) + 1 } catch { names["?"] = (names["?"] ?? 0) + 1 } }
const dec: any = sdk.decodePlaceOrder({ logs, status: "success" } as any, pool)
const fills = (dec.fills ?? []).map((f: any) => ({ price: BigInt(f.fillPrice), qty: BigInt(f.quantityFilled) }))
console.log(`trace events ${JSON.stringify(names)}`)
if (fills.length) {
  const lo = fills.reduce((a: bigint, f: any) => (f.price < a ? f.price : a), fills[0].price)
  const tot = fills.reduce((a: bigint, f: any) => a + f.qty, 0n)
  const outside = fills.filter((f: any) => f.price < bandFloor).reduce((a: bigint, f: any) => a + f.qty, 0n)
  console.log(`fills ${fills.length}, total ${formatUnits(tot, m.baseDecimals)} of ${qtyH}, lowest ${formatUnits(lo, 18)}; filled below band floor: ${formatUnits(outside, m.baseDecimals)}`)
} else console.log("no fills decoded")
await ex.close(); process.exit(0)
