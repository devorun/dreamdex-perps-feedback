// Operator CLI: the linked bot key (BOT_PRIVATE_KEY) trades the owner account (OWNER_ADDRESS)
// through the pool's placeOrderFor / cancelOrderFor / reduceOrderFor, as the "Link a Bot" docs describe.
//
//   node --env-file=../.env op.ts state  <BASE>
//   node --env-file=../.env op.ts place  <BASE> <buy|sell> <qty> <price|bid|ask|mark> <limit|fok|ioc|post> [--nosim] [--gas N]
//   node --env-file=../.env op.ts raw    <BASE> <buy|sell> <qtyRaw> <priceRaw> <limit|fok|ioc|post> [--nosim] [--gas N]
//   node --env-file=../.env op.ts cancel <BASE> <orderId> [--nosim]
//   node --env-file=../.env op.ts reduce <BASE> <orderId> <newQtyRemaining> [--nosim]
//   node --env-file=../.env op.ts replay <BASE> <txHash> <blockNumber>
//
// --nosim sends without a local simulation, to observe the on-chain result of a reverting call.
import { SomniaMarkets, contractErrorsAbi, decodePlaceOrder } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { BaseError, ContractFunctionRevertedError, decodeErrorResult, createPublicClient, createWalletClient, formatUnits, http, parseAbi, parseUnits } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const RPC = "https://api.hideki2.infra.testnet.somnia.network"
const INDEXER = "https://hideki-dev.smk.somnia.host/v1/graphql"
const OWNER = (process.env.OWNER_ADDRESS ?? "0xB667DAae78712068Ef9c2Cab61c3217901a0309A") as `0x${string}`
const ORDER_TYPES = { limit: 0, fok: 1, ioc: 2, post: 3 } as const

const ABI = [
  ...parseAbi([
    "function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)",
    "function cancelOrderFor(address owner, uint128 orderId)",
    "function reduceOrderFor(address owner, uint128 orderId, uint256 newQuantityRemaining)",
  ]),
  ...contractErrorsAbi,
] as const

const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const [cmd, base, ...rest] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--gas"))

const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER })
const client = ex.client
const m = (await client.listPerpMarkets({ baseSymbol: base }))[0]
if (!m) throw new Error(`no perp market ${base}`)
const pool = m.poolAddress as `0x${string}`
const qd = m.quoteDecimals, bd = m.baseDecimals

const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: hidekiTestnet, transport: http(RPC) })
const wallet = createWalletClient({ account: bot, chain: hidekiTestnet, transport: http(RPC) })

function revertName(e: unknown): string {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null
    if (r) return `${r.data?.errorName ?? r.signature ?? "unknown"}(${j(r.data?.args ?? [])})${r.reason ? " reason=" + r.reason : ""}`
    return e.shortMessage
  }
  return String(e)
}

// The docs' advice for a status-0 receipt: eth_call the same transaction at the parent block.
async function replay(hash: `0x${string}`, blockNumber: bigint, gas: bigint) {
  const tx = await pub.getTransaction({ hash })
  try {
    const r = await pub.call({ to: tx.to!, data: tx.input, account: tx.from, value: tx.value, blockNumber, gas })
    console.log(`replay at block ${blockNumber}: no revert, returned ${r.data}`)
  } catch (e) {
    const data = (e as any)?.walk?.((x: any) => typeof x?.data === "string")?.data as `0x${string}` | undefined
    let decoded = "undecodable"
    if (data && data !== "0x") {
      try { const d = decodeErrorResult({ abi: ABI, data }); decoded = `${d.errorName}(${j(d.args ?? [])})` } catch { decoded = `raw ${data}` }
    } else decoded = "empty revert data"
    console.log(`replay at block ${blockNumber}: revert, ${decoded}`)
  }
}

async function state() {
  const [book, pos, acct, orders] = await Promise.all([
    ex.loadMarkets().then(() => ex.fetchOrderBook(`${base}/USDso:USDso`, 3)),
    client.getPerpPosition({ marginBank: m.marginBank, account: OWNER, pool }),
    client.getMarginAccount(m.marginBank, OWNER),
    client.getOpenOrders(OWNER).catch((e: Error) => `ERR ${e.message}`),
  ])
  const st = await client.getPerpState(pool)
  console.log("block", await pub.getBlockNumber(), "| bot gas", formatUnits(await pub.getBalance({ address: bot.address }), 18), "STT")
  console.log("mark", formatUnits(st.markPrice, qd), "index", formatUnits(st.indexPrice, qd), "bids", j(book.bids), "asks", j(book.asks))
  console.log("position", j(pos))
  console.log("margin", j({ unlocked: formatUnits(acct.unlockedCollateralBalance, qd), locked: formatUnits(acct.lockedCollateral, qd), equity: formatUnits(acct.equity, qd), withdrawable: formatUnits(acct.withdrawable, qd), imReq: formatUnits(acct.imReq, qd), mmReq: formatUnits(acct.mmReq, qd), status: acct.marginStatus }))
  console.log("openOrders(indexer)", typeof orders === "string" ? orders : j((orders as any[]).filter((o) => String(o.market?.id ?? o.marketId ?? o.pool ?? "").toLowerCase() === pool.toLowerCase() || true).slice(0, 10)))
}

async function send(functionName: "placeOrderFor" | "cancelOrderFor" | "reduceOrderFor", fnArgs: readonly unknown[]) {
  const gas = BigInt(opt("--gas") ?? "10000000")
  if (!flag("--nosim")) {
    try {
      const { result } = await pub.simulateContract({ address: pool, abi: ABI, functionName, args: fnArgs as never, account: bot, gas })
      console.log("simulate OK", j(result))
    } catch (e) {
      console.log("simulate REVERT", revertName(e))
      return
    }
  }
  const hash = await wallet.writeContract({ address: pool, abi: ABI, functionName, args: fnArgs as never, gas })
  const receipt = await pub.waitForTransactionReceipt({ hash })
  console.log("tx", hash, "status", receipt.status, "block", receipt.blockNumber, "gasUsed", receipt.gasUsed)
  if (receipt.status !== "success") {
    await replay(hash, receipt.blockNumber - 1n, gas)
    return
  }
  if (functionName === "placeOrderFor") {
    try { console.log("decoded", j(decodePlaceOrder(receipt, pool))) } catch (e) { console.log("decode failed", (e as Error).message) }
  }
}

async function priceArg(p: string): Promise<bigint> {
  if (p === "bid" || p === "ask" || p === "mark") {
    await ex.loadMarkets()
    const book = await ex.fetchOrderBook(`${base}/USDso:USDso`, 1)
    const st = await client.getPerpState(pool)
    const v = p === "mark" ? st.markPrice : parseUnits(String((p === "bid" ? book.bids : book.asks)[0][0]), qd)
    return (v / BigInt(m.tickSize)) * BigInt(m.tickSize)
  }
  return parseUnits(p, qd)
}

if (cmd === "state") await state()
else if (cmd === "place" || cmd === "raw") {
  const [side, q, p, t] = rest
  const quantity = cmd === "raw" ? BigInt(q) : parseUnits(q, bd)
  const price = cmd === "raw" ? BigInt(p) : await priceArg(p)
  const orderType = ORDER_TYPES[t as keyof typeof ORDER_TYPES]
  const expire = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 3600) * 1_000_000_000n
  console.log("placeOrderFor", j({ owner: OWNER, isBid: side === "buy", price, priceHuman: formatUnits(price, qd), quantity, qtyHuman: formatUnits(quantity, bd), orderType: t }))
  await send("placeOrderFor", [OWNER, side === "buy", 0n, price, quantity, expire, orderType, 0, "0x0000000000000000000000000000000000000000", 0n])
} else if (cmd === "replay") await replay(rest[0] as `0x${string}`, BigInt(rest[1]), 10_000_000n)
else if (cmd === "cancel") await send("cancelOrderFor", [OWNER, BigInt(rest[0])])
else if (cmd === "reduce") await send("reduceOrderFor", [OWNER, BigInt(rest[0]), BigInt(rest[1])])
else console.log("unknown command")
await ex.close()
