// Expiry lifecycle: one resting order with a short expireTimestampNs; after it expires, compare what each read
// reports and what reduce/cancel do. Real txs: place + one final cancel (only if still needed).
import { SomniaMarkets, contractErrorsAbi, decodePlaceOrder } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { ContractFunctionRevertedError, createPublicClient, createWalletClient, formatUnits, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"
const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const base = process.argv[2] ?? "ETH", life = Number(process.argv[3] ?? 45)
const ABI = [...parseAbi([
  "function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)",
  "function cancelOrderFor(address owner, uint128 orderId)",
  "function reduceOrderFor(address owner, uint128 orderId, uint256 newQuantityRemaining)",
  "function getOrder(uint128 orderId) view returns ((uint128 orderId, bool isBid, address owner, uint64 userData, uint256 price, uint256 fullQuantity, uint256 quantityRemaining, uint64 expireTimestampNs))",
]), ...contractErrorsAbi] as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql" })
const m = (await ex.client.listPerpMarkets({ baseSymbol: base }))[0]
const pool = m.poolAddress as `0x${string}`, tick = BigInt(m.tickSize), minQ = BigInt(m.minQuantity)
await ex.loadMarkets()
const S = `${base}/USDso:USDso`
const bid = parseUnits(String((await ex.fetchOrderBook(S, 1)).bids[0][0]), 18)
const price = ((bid * 99n) / 100n / tick) * tick
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(RPC) })
const wal = createWalletClient({ account: bot, chain: hidekiTestnet, transport: http(RPC) })
const nowS = async () => Number((await pub.getBlock()).timestamp)
const expire = BigInt((await nowS()) + life) * 1_000_000_000n
const sim = async (label: string, fn: "cancelOrderFor" | "reduceOrderFor", args: readonly unknown[]) => {
  try { await pub.simulateContract({ address: pool, abi: ABI, functionName: fn, args: args as never, account: bot, gas: 10_000_000n }); console.log(`  sim ${label}: OK`) }
  catch (e: any) { const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError); console.log(`  sim ${label}: REVERT ${r?.data?.errorName}(${j(r?.data?.args ?? [])})`) }
}
const h = await wal.writeContract({ address: pool, abi: ABI, functionName: "placeOrderFor", args: [OWNER, true, 0n, price, minQ, expire, 3, 0, "0x0000000000000000000000000000000000000000", 0n], gas: 10_000_000n })
const rc = await pub.waitForTransactionReceipt({ hash: h })
const id = decodePlaceOrder(rc, pool).orderId!
console.log(`placed ${formatUnits(minQ, m.baseDecimals)} ${base} bid @ ${formatUnits(price, 18)} expiring at ${expire / 1_000_000_000n} (in ${life}s): tx ${h} id ${id}`)
const snapshot = async (label: string) => {
  const t = await nowS()
  const onChain = await pub.readContract({ address: pool, abi: ABI, functionName: "getOrder", args: [id] }).then((o) => `quantityRemaining ${o.quantityRemaining}`, (e) => "revert " + String(e.shortMessage).split("\n")[0])
  const book = await ex.fetchOrderBook(S, 50)
  const inBook = book.bids.some(([p]) => parseUnits(String(p), 18) === price)
  const open: any[] = await ex.client.getOpenOrders(OWNER)
  const hist: any[] = await ex.client.listPerpOrderHistory(OWNER, { limit: 10, status: undefined } as any).catch(() => [])
  const h = hist.find((r) => String(r.orderId) === String(id))
  const acct = await ex.client.getMarginAccount(m.marginBank, OWNER)
  console.log(`${label}: margin locked ${formatUnits(acct.lockedCollateral, 18)} unlocked ${formatUnits(acct.unlockedCollateralBalance, 18)}`)
  console.log(`${label} (block time ${t}, ${t - Number(expire / 1_000_000_000n)}s past expiry): getOrder ${onChain} | price level in fetchOrderBook ${inBook} | getOpenOrders has it ${open.some((o) => String(o.orderId) === String(id))} | history status ${h?.status ?? "-"}`)
}
await snapshot("before expiry")
while ((await nowS()) < Number(expire / 1_000_000_000n) + 10) await new Promise((s) => setTimeout(s, 5000))
await snapshot("after expiry")
await sim("reduceOrderFor(id, min) after expiry", "reduceOrderFor", [OWNER, id, minQ])
await sim("cancelOrderFor(id) after expiry", "cancelOrderFor", [OWNER, id])
const c = await wal.writeContract({ address: pool, abi: ABI, functionName: "cancelOrderFor", args: [OWNER, id], gas: 10_000_000n })
console.log(`cancel tx ${c} status ${(await pub.waitForTransactionReceipt({ hash: c })).status}`)
await new Promise((s) => setTimeout(s, 6000))
await snapshot("after cancel")
await ex.close()
