// watchPerpMarkets (liquidations + funding settlement) for N seconds vs the indexed reads it is said to mirror.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const secs = Number(process.argv[2] ?? 60)
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c: any = ex.client
const t0 = Date.now()
const plane = await c.watchPerpMarkets()
let updates = 0
const unsub = c.subscribeLive(() => { updates++ })
const first = { liqs: c.listLiveLiquidations({ limit: 50 }).length, pays: c.listLiveFundingPayments({ limit: 50 }).length }
console.log(`hydrated in ${Date.now() - t0} ms: live liquidations ${first.liqs}, live funding payments ${first.pays}`)
await new Promise((s) => setTimeout(s, secs * 1000))
const liveL: any[] = c.listLiveLiquidations({ limit: 50 }), liveF: any[] = c.listLiveFundingPayments({ limit: 50 })
const idxL: any[] = await c.listLiquidations({ limit: 50 }), idxF: any[] = await c.getFundingPayments(undefined as any, { limit: 50 } as any).catch((e: any) => (console.log("getFundingPayments(all):", e.message.slice(0, 100)), []))
const ids = (a: any[]) => new Set(a.map((r) => r.id))
const onlyLive = [...ids(liveL)].filter((id) => !ids(idxL).has(id)).length
const order = (a: any[]) => a.every((r, i) => i === 0 || BigInt(a[i - 1].timestamp) > BigInt(r.timestamp) || (a[i - 1].timestamp === r.timestamp && BigInt(a[i - 1].blockNumber ?? 0) >= BigInt(r.blockNumber ?? 0)))
console.log(`after ${secs}s: store updates ${updates}; live liquidations ${liveL.length} (newest ${liveL[0]?.timestamp}), indexed ${idxL.length} (newest ${idxL[0]?.timestamp}); live-only ids ${onlyLive}; live newest-first ${order(liveL)}, indexed newest-first ${order(idxL)}`)
console.log(`live funding payments ${liveF.length} (newest ${liveF[0]?.timestamp}), indexed ${idxF.length}`)
unsub(); plane.stop(); await ex.close(); process.exit(0)
