// Amend behaviour vs the docs, simulated from the owner address (eth_call; the owner key is not used or needed).
// One real order: a resting ETH bid placed by the linked bot, cancelled at the end.
import { SomniaMarkets, contractErrorsAbi, decodePlaceOrder } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { ContractFunctionRevertedError, createPublicClient, createWalletClient, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "ETH"
const REQ = "(bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k)"
const ABI = [...parseAbi([
  "function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)",
  "function cancelOrderFor(address owner, uint128 orderId)",
  `function amendOrder((uint128 oldOrderId, bool alwaysPlace, ${REQ} newOrder) request) returns (uint128 newOrderId)`,
  `function amendOrders((uint128 oldOrderId, bool alwaysPlace, ${REQ} newOrder)[] requests) returns (uint128[] newOrderIds)`,
  `function amendOrderFor(address owner, (uint128 oldOrderId, bool alwaysPlace, ${REQ} newOrder) request) returns (uint128 newOrderId)`,
]), ...contractErrorsAbi] as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
const pool = m.poolAddress as `0x${string}`, tick = BigInt(m.tickSize), minQ = BigInt(m.minQuantity), lot = BigInt(m.lotSize)
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
const req = (price: bigint, qty: bigint, orderType: number) => ({ isBid: true, userData: 0n, price, quantity: qty, expireTimestampNs: expire, orderType, selfMatchingOption: 0, builder: Z, builderFeeBpsTimes1k: 0n })
const sim = async (label: string, functionName: string, args: unknown[], from: `0x${string}`) => {
  try { const { result } = await pub.simulateContract({ address: pool, abi: ABI as any, functionName, args, account: from, gas: 10_000_000n }); console.log(`OK     ${label} -> ${j(result)}`) }
  catch (e: any) { const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError); console.log(`REVERT ${label} -> ${r?.data?.errorName ?? r?.signature ?? e.shortMessage?.split("\n")[0]}(${j(r?.data?.args ?? [])})`) }
}
const h = await wal.writeContract({ address: pool, abi: ABI, functionName: "placeOrderFor", args: [OWNER, true, 0n, far, minQ, expire, 3, 0, Z, 0n], gas: 10_000_000n })
const id = decodePlaceOrder(await pub.waitForTransactionReceipt({ hash: h }), pool).orderId!
console.log(`resting bid id ${id} @ ${far} (tx ${h}); bestBid ${bestBid} bestAsk ${bestAsk}`)
const STALE = 15052543164147000809223n // an order of OWNER on BTC that was cancelled earlier; not on this pool -> "gone"
await sim("amendOrder reprice -1 tick (owner)", "amendOrder", [{ oldOrderId: id, alwaysPlace: false, newOrder: req(far - tick, minQ, 3) }], OWNER)
await sim("amendOrders [reprice] (owner)", "amendOrders", [[{ oldOrderId: id, alwaysPlace: false, newOrder: req(far - tick, minQ, 3) }]], OWNER)
await sim("amendOrder to POST_ONLY at best ask (would cross) (owner)", "amendOrder", [{ oldOrderId: id, alwaysPlace: false, newOrder: req(bestAsk, minQ, 3) }], OWNER)
await sim("amendOrders [POST_ONLY at best ask] (owner)", "amendOrders", [[{ oldOrderId: id, alwaysPlace: false, newOrder: req(bestAsk, minQ, 3) }]], OWNER)
await sim("amendOrder gone id, alwaysPlace=false (owner)", "amendOrder", [{ oldOrderId: STALE, alwaysPlace: false, newOrder: req(far, minQ, 3) }], OWNER)
await sim("amendOrder gone id, alwaysPlace=true (owner)", "amendOrder", [{ oldOrderId: STALE, alwaysPlace: true, newOrder: req(far, minQ, 3) }], OWNER)
await sim("amendOrder by the linked bot for itself (not the owner)", "amendOrder", [{ oldOrderId: id, alwaysPlace: false, newOrder: req(far - tick, minQ, 3) }], bot.address)
await sim("amendOrderFor(owner, ...) by the linked bot (does it exist?)", "amendOrderFor", [OWNER, { oldOrderId: id, alwaysPlace: false, newOrder: req(far - tick, minQ, 3) }], bot.address)
await sim("amendOrder new size below min (owner)", "amendOrder", [{ oldOrderId: id, alwaysPlace: false, newOrder: req(far, minQ - lot, 3) }], OWNER)
const c = await wal.writeContract({ address: pool, abi: ABI, functionName: "cancelOrderFor", args: [OWNER, id], gas: 10_000_000n })
console.log(`cancel tx ${c} status ${(await pub.waitForTransactionReceipt({ hash: c })).status}`)
await ex.close()
