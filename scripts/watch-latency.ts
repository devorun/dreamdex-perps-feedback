// Live tail vs indexer vs chain for one resting order: when does each source show it, and when does it drop it?
// Real txs: one POST_ONLY bid (bot for owner) and its cancel. Sources:
//   live  = client.watchMarket(pool) + getLiveUserOrders(pool, owner) via subscribeLive
//   idx   = client.getOpenOrders(owner) polled every 1.5 s
//   watch = exchange.watchOrders(symbol) on an address-only exchange for the owner (if supported)
import { SomniaMarkets, decodePlaceOrder } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "ETH"
const ABI = parseAbi([
  "function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)",
  "function cancelOrderFor(address owner, uint128 orderId)",
])
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", account: OWNER } as any)
const c = ex.client
const m = (await c.listPerpMarkets({ baseSymbol: base }))[0]
const pool = m.poolAddress as `0x${string}`, tick = BigInt(m.tickSize)
await ex.loadMarkets()
const S = `${base}/USDso:USDso`
const bid = parseUnits(String((await ex.fetchOrderBook(S, 1)).bids[0][0]), 18)
const price = ((bid * 98n) / 100n / tick) * tick
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(1) + "s"
const handle = await c.watchMarket(pool)
const seen: Record<string, string> = {}
let target = ""
const mark = (src: string, has: boolean) => { const k = `${src}:${has ? "shows" : "drops"}`; if (target && !seen[k] && (has || seen[`${src}:shows`])) { seen[k] = T(); console.log(`${T()} ${src} ${has ? "shows" : "drops"} the order`) } }
const liveHas = () => (c.getLiveUserOrders(pool, OWNER) as any[]).some((o: any) => String(o.orderId ?? o.id).endsWith(target) && o.status === "Open")
const unsub = c.subscribeLive(() => { if (target) mark("live", liveHas()) })
const poll = setInterval(async () => { if (!target) return; const open: any[] = await c.getOpenOrders(OWNER).catch(() => []); mark("idx", open.some((o) => String(o.orderId) === target)) }, 1500)
let watchSupported = true
;(async () => { while (true) { try { const os: any[] = await ex.watchOrders(S); if (target) mark("watchOrders", os.some((o) => String(o.id).includes(target) && (o.status === "open"))) } catch (e: any) { if (watchSupported) console.log(`watchOrders: ${e.name} ${String(e.message).slice(0, 140)}`); watchSupported = false; break } } })()
await new Promise((s) => setTimeout(s, 3000))
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(RPC) })
const wal = createWalletClient({ account: bot, chain: hidekiTestnet, transport: http(RPC) })
const expire = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n
console.log(`${T()} sending place`)
const h = await wal.writeContract({ address: pool, abi: ABI, functionName: "placeOrderFor", args: [OWNER, true, 0n, price, BigInt(m.minQuantity), expire, 3, 0, "0x0000000000000000000000000000000000000000", 0n], gas: 10_000_000n })
const r = await pub.waitForTransactionReceipt({ hash: h })
target = String(decodePlaceOrder(r, pool).orderId)
console.log(`${T()} place receipt (block ${r.blockNumber}) tx ${h} id ${target}`)
mark("live", liveHas())
await new Promise((s) => setTimeout(s, 20000))
console.log(`${T()} sending cancel`)
const ch = await wal.writeContract({ address: pool, abi: ABI, functionName: "cancelOrderFor", args: [OWNER, BigInt(target)], gas: 10_000_000n })
const cr = await pub.waitForTransactionReceipt({ hash: ch })
console.log(`${T()} cancel receipt (block ${cr.blockNumber}) tx ${ch}`)
mark("live", liveHas())
await new Promise((s) => setTimeout(s, 20000))
console.log("summary", JSON.stringify(seen))
clearInterval(poll); unsub(); handle.stop?.(); await ex.close(); process.exit(0)
