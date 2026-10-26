// accountPositions.subscribe (polling/event-driven account view) vs receipts, while the linked bot
// (1) closes a BTC short with an IOC and (2) rests a POST_ONLY AVAX bid, comparing previewPerpOrderMargin's lock with the real lock.
// Real txs: the close, the resting bid, its cancel.
import { SomniaMarkets, decodePlaceOrder } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, createWalletClient, formatUnits, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const, MB = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394" as const
const ABI = parseAbi([
  "function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)",
  "function cancelOrderFor(address owner, uint128 orderId)",
])
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const c: any = ex.client
await ex.loadMarkets()
const btc = (await c.listPerpMarkets({ baseSymbol: "BTC" }))[0], avax = (await c.listPerpMarkets({ baseSymbol: "AVAX" }))[0]
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(RPC) })
const wal = createWalletClient({ account: bot, chain: hidekiTestnet, transport: http(RPC) })
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(1) + "s"
let last = ""
const stop = c.accountPositions.subscribe(MB, OWNER, (v: any) => {
  if (v.status !== "ready" && v.status !== "stale") { console.log(`${T()} view ${v.status}`); return }
  const pos = v.data.positions.map((p: any) => `${p.pool.slice(0, 6)}:${p.size}`).join(",")
  const lk = v.data.margin.lockedCollateral ?? v.data.margin.locked
  const s = `${v.status} block ${v.data.blockNumber} positions [${pos}] locked ${lk == null ? "?" : formatUnits(BigInt(lk), 18)} orders ${j(v.data.orders?.status)}/${v.data.orders?.value?.length ?? "?"}`
  if (s !== last) { console.log(`${T()} view rev ${v.revision}: ${s}`); last = s }
})
function j(x: unknown) { return JSON.stringify(x) }
await new Promise((s) => setTimeout(s, 8000))
const expire = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n, Z = "0x0000000000000000000000000000000000000000" as const
// (1) close the BTC short
const ask = parseUnits(String((await ex.fetchOrderBook("BTC/USDso:USDso", 1)).asks[0][0]), 18)
const lim = ((ask * 1003n) / 1000n / BigInt(btc.tickSize)) * BigInt(btc.tickSize)
console.log(`${T()} sending BTC close (buy 0.018 @ <= ${formatUnits(lim, 18)})`)
const h1 = await wal.writeContract({ address: btc.poolAddress, abi: ABI, functionName: "placeOrderFor", args: [OWNER, true, 0n, lim, 1800000n, expire, 2, 0, Z, 0n], gas: 10_000_000n })
const r1 = await pub.waitForTransactionReceipt({ hash: h1 })
console.log(`${T()} BTC close receipt block ${r1.blockNumber} ${r1.status} tx ${h1}`)
await new Promise((s) => setTimeout(s, 15000))
// (2) rest an AVAX bid; preview its lock first
const bid = parseUnits(String((await ex.fetchOrderBook("AVAX/USDso:USDso", 1)).bids[0][0]), 18)
const price = ((bid * 98n) / 100n / BigInt(avax.tickSize)) * BigInt(avax.tickSize), qty = parseUnits("20", avax.baseDecimals)
const before = await c.getMarginAccount(MB, OWNER)
const prev: any = await c.previewPerpOrderMargin({ pool: avax.poolAddress, marginBank: MB, account: OWNER, isBid: true, quantity: qty, price })
console.log(`${T()} preview AVAX bid 20 @ ${formatUnits(price, 18)}: lockAmount ${formatUnits(BigInt(prev.lockAmount), 18)} meetsInitialMargin ${prev.meetsInitialMargin} hasCollateralForLock ${prev.hasCollateralForLock} (asOfBlock ${prev.asOfBlock})`)
const h2 = await wal.writeContract({ address: avax.poolAddress, abi: ABI, functionName: "placeOrderFor", args: [OWNER, true, 0n, price, qty, expire, 3, 0, Z, 0n], gas: 10_000_000n })
const r2 = await pub.waitForTransactionReceipt({ hash: h2 })
const id = decodePlaceOrder(r2, avax.poolAddress).orderId!
const after = await c.getMarginAccount(MB, OWNER)
console.log(`${T()} AVAX bid receipt block ${r2.blockNumber} tx ${h2}; locked ${formatUnits(BigInt(before.lockedCollateral), 18)} -> ${formatUnits(BigInt(after.lockedCollateral), 18)} (delta ${formatUnits(BigInt(after.lockedCollateral) - BigInt(before.lockedCollateral), 18)})`)
await new Promise((s) => setTimeout(s, 15000))
const h3 = await wal.writeContract({ address: avax.poolAddress, abi: ABI, functionName: "cancelOrderFor", args: [OWNER, id], gas: 10_000_000n })
const r3 = await pub.waitForTransactionReceipt({ hash: h3 })
console.log(`${T()} AVAX cancel receipt block ${r3.blockNumber} ${r3.status}`)
await new Promise((s) => setTimeout(s, 15000))
stop(); await ex.close(); process.exit(0)
