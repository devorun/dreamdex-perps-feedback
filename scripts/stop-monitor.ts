// Polls one pending stop until it leaves PENDING (or the position changes), logging mark vs trigger each tick,
// then prints the stop row, the position and the owner's STT. Read-only.
//   node stop-monitor.ts <BASE> <stopIdRaw> [maxMinutes]
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, formatEther, formatUnits, http } from "viem"
const [base = "ETH", stopId = "", maxMin = "20"] = process.argv.slice(2)
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const pub = createPublicClient({ transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c: any = ex.client
const m = (await c.listPerpMarkets({ baseSymbol: base }))[0]
const end = Date.now() + Number(maxMin) * 60000
let minMark = Infinity
const all = ["PENDING", "TRIGGERED", "TRIGGER_FAILED", "CANCELLED"]
while (Date.now() < end) {
  let st: any, pos: any, rows: any
  try { [st, pos, rows] = await Promise.all([c.getPerpState(m.poolAddress), c.getPerpPosition({ marginBank: m.marginBank, account: OWNER, pool: m.poolAddress }), c.listPerpStopOrders({ account: OWNER, status: all })]) }
  catch (e: any) { console.log(`${new Date().toISOString()} read failed (${e.name}: ${String(e.message).slice(0, 80)}), retrying`); await new Promise((r) => setTimeout(r, 15000)); continue }
  const mark = Number(formatUnits(st.markPrice, 18)); minMark = Math.min(minMark, mark)
  const s = rows.find((r: any) => r.orderIdRaw === stopId)
  console.log(`${new Date().toISOString()} mark ${mark.toFixed(2)} (min ${minMark.toFixed(2)}) trigger ${s ? formatUnits(BigInt(s.triggerPrice), 18) : "?"} stop ${s?.status ?? "missing"} position ${formatUnits(BigInt(pos.size), m.baseDecimals)}`)
  if (!s || s.status !== "PENDING" || BigInt(pos.size) === 0n) {
    console.log("STOP ROW", j(s))
    console.log("POSITION", j(pos))
    console.log("owner STT", formatEther(await pub.getBalance({ address: OWNER })), "| unclaimed", formatEther(await c.getUnclaimedPerpStopSomi({ registry: m.stopRegistry, account: OWNER })))
    break
  }
  await new Promise((r) => setTimeout(r, 15000))
}
await ex.close(); process.exit(0)
