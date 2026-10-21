// Read-only: funding rate history rows vs chain state and the SDK's normalisation helpers.
import * as sdk from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const base = process.argv[2] ?? "BTC"
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new sdk.SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c = ex.client
const m = (await c.listPerpMarkets({ baseSymbol: base }))[0]
const st = await c.getPerpState(m.poolAddress)
console.log("chain", j({ rate: st.fundingRate, cum: st.cumulativeFundingPerUnit, lastUpdate: st.lastFundingUpdateAt, next: st.nextFundingAt, window: st.fundingWindowSec, interval: st.fundingIntervalSec, index: st.indexPrice }))
const hist: any[] = await c.listFundingRateHistory(m.poolAddress, { limit: 4 } as any)
for (const h of hist) console.log("history", j(h))
const helpers = ["fundingRate8h", "fundingRate1h", "fundingRatePerInterval", "annualizedFundingRate"].filter((k) => typeof (sdk as any)[k] === "function")
console.log("helpers exported:", helpers.join(", "))
for (const k of helpers) { try { console.log(k, j((sdk as any)[k](m))) } catch (e: any) { console.log(k, "ERR", e.message.slice(0, 160)) } }
await ex.close()
