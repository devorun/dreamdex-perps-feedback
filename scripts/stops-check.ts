// Read-only: the owner's perp stops (TP/SL) on one market, as the SDK, the registry and the chain report them.
//   node stops-check.ts [BASE] [owner]
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, formatEther, formatUnits, http } from "viem"
const base = process.argv[2] ?? "ETH"
const OWNER = (process.argv[3] ?? "0xB667DAae78712068Ef9c2Cab61c3217901a0309A") as `0x${string}`
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const pub = createPublicClient({ transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", account: OWNER } as any)
const c: any = ex.client
const m = (await c.listPerpMarkets({ baseSymbol: base }))[0]
const reg = m.stopRegistry as `0x${string}`
const block = await pub.getBlockNumber()
console.log(`${new Date().toISOString()} block ${block}`)
console.log(`owner STT ${formatEther(await pub.getBalance({ address: OWNER }))} | registry ${reg} STT balance ${formatEther(await pub.getBalance({ address: reg }))} | fee per stop ${formatEther(await c.getPerpStopOrderSomiPayment(reg))} | unclaimed ${formatEther(await c.getUnclaimedPerpStopSomi({ registry: reg, account: OWNER }))}`)
const pos = await c.getPerpPosition({ marginBank: m.marginBank, account: OWNER, pool: m.poolAddress })
const st = await c.getPerpState(m.poolAddress)
console.log(`position size ${formatUnits(BigInt(pos.size), m.baseDecimals)} entry ${formatUnits(BigInt(pos.avgEntryPrice), 18)} | mark ${formatUnits(st.markPrice, 18)}`)
const all: any[] = await c.listPerpStopOrders({ account: OWNER, status: ["PENDING", "TRIGGERED", "TRIGGER_FAILED", "CANCELLED", "EXECUTED"] as any }).catch(async () => c.listPerpStopOrders({ account: OWNER }))
const mine = all.filter((s) => String(s.registry).toLowerCase() === reg.toLowerCase())
console.log(`stops on ${base}: ${mine.length}`)
for (const s of mine) console.log("  " + j({ id: s.orderIdRaw, status: s.status, isBid: s.isBid, quantity: s.quantity, trigger: formatUnits(BigInt(s.triggerPrice), 18), op: s.triggerOperator, orderType: s.orderType, intent: s.intent, sibling: s.siblingOrderId, placedOrderId: s.placedOrderId, dropReason: s.dropReason, cancelReason: s.cancelReason, createdAt: s.createdAt, updatedAt: s.updatedAt, tx: s.txHash }))
const pending = mine.filter((s) => s.status === "PENDING")
if (pending.length) { try { console.log("getPerpStopOrders(pending)", j(await c.getPerpStopOrders(pending.map((s) => ({ registry: reg, orderId: BigInt(s.orderIdRaw) }))))) } catch (e: any) { console.log("getPerpStopOrders:", e.message.slice(0, 160)) } }
for (const tx of [...new Set(mine.map((s) => s.txHash))]) {
  const t = await pub.getTransaction({ hash: tx }); const r = await pub.getTransactionReceipt({ hash: tx })
  console.log(`  tx ${tx}: from ${t.from} to ${t.to} value ${formatEther(t.value)} STT status ${r.status} gasUsed ${r.gasUsed} gasCost ${formatEther(r.gasUsed * r.effectiveGasPrice)}`)
}
const open: any[] = await c.getOpenOrders(OWNER)
console.log(`getOpenOrders(owner): ${open.length} rows ${j(open.map((o) => ({ id: o.orderId, pool: o.pool, isBid: o.isBid, price: o.price, q: o.quantityRemaining })))}`)
await ex.close(); process.exit(0)
