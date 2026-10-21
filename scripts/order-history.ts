// Read-only: order history rows for the owner, to compare fullQuantity with what each order was placed for.
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
const OWNER = (process.argv[2] ?? "0xB667DAae78712068Ef9c2Cab61c3217901a0309A") as `0x${string}`
const ids = process.argv.slice(3)
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const rows: any[] = await ex.client.listPerpOrderHistory(OWNER, { limit: 50 })
for (const r of rows.filter((r) => !ids.length || ids.includes(String(r.orderId))))
  console.log(j({ orderId: r.orderId, status: r.status, price: r.price, fullQuantity: r.fullQuantity, filledQuantity: r.filledQuantity, quantityRemaining: r.quantityRemaining, placedTxHash: r.placedTxHash }))
await ex.close()
