// exchange.createOrder on a perp market accepts amounts between one lot and minQuantity and hands them to the
// executor, which sends without simulating; the pool then reverts QuantityBelowMinimum. Nothing is sent here:
// the order is intercepted at the trader (the hand-off createOrder makes to the executor) and the exact captured
// order is then simulated on chain as the linked bot placing for the owner (eth_call).
//   node --env-file=../.env 020-createorder-below-min.ts [BASE] [amount]
import { SomniaMarkets, contractErrorsAbi } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { ContractFunctionRevertedError, createPublicClient, formatUnits, http, parseAbi } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { readFileSync } from "node:fs"
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.resolve("@somnia-chain/markets-sdk")), "utf8")).version
const OWNER = "0xB667DAae78712068Ef9c2Cab61c3217901a0309A" as const
const [base = "BTC", amountArg] = process.argv.slice(2)
const S = `${base}/USDso:USDso`
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))

const ex: any = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", account: OWNER } as any)
const markets = await ex.loadMarkets()
const m = markets[S], info = m.info
const lot = BigInt(info.lotSize), minQ = BigInt(info.minQuantity), d = info.baseDecimals
console.log(`markets-sdk ${version}; ${S}: lot ${formatUnits(lot, d)}, minQuantity ${formatUnits(minQ, d)} (= ${minQ / lot} lots), limits.amount.min ${m.limits.amount.min}`)

// Intercept the trader hand-off so nothing is signed or sent.
let captured: any = null
ex.traderFor = () => ({ placePerpOrder: async (p: any) => { captured = p; throw new Error("INTERCEPTED before the executor (nothing sent)") } })
const bid = (await ex.fetchOrderBook(S, 1)).bids[0][0]
const price = bid * 0.95 // rests well under the book
const tryCreate = async (amount: number) => {
  captured = null
  try { await ex.createOrder(S, "limit", "buy", amount, price); return "returned (unexpected)" }
  catch (e: any) { return e.message.startsWith("INTERCEPTED") ? `accepted by the SDK -> handed to the executor: ${j({ quantity: captured.quantity, price: captured.price, orderType: captured.orderType })}` : `rejected by the SDK: ${e.name}: ${e.message}` }
}
const below1Lot = Number(formatUnits(lot, d)) / 2
const subMin = amountArg ? Number(amountArg) : Number(formatUnits(minQ - lot, d))
console.log(`createOrder("${S}", "limit", "buy", ${below1Lot}, ${price.toFixed(1)}): ${await tryCreate(below1Lot)}`)
console.log(`createOrder("${S}", "limit", "buy", ${subMin}, ${price.toFixed(1)}): ${await tryCreate(subMin)}`)
const order = captured

// Simulate the captured order on chain, as the linked bot placing it for the owner.
const pub = createPublicClient({ chain: hidekiTestnet, transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const ABI = [...parseAbi(["function placeOrderFor(address owner, bool isBid, uint64 userData, uint256 price, uint256 quantity, uint64 expireTimestampNs, uint8 orderType, uint8 selfMatchingOption, address builder, uint96 builderFeeBpsTimes1k) payable returns (bool success, uint128 orderId)"]), ...contractErrorsAbi] as const
const bot = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as `0x${string}`)
const expire = BigInt(Math.floor(Date.now() / 1000) + 3600) * 1_000_000_000n
const block = await pub.getBlockNumber()
try {
  const { result } = await pub.simulateContract({ address: info.poolAddress, abi: ABI, functionName: "placeOrderFor", account: bot, gas: 10_000_000n, blockNumber: block,
    args: [OWNER, order.isBid, 0n, order.price, order.quantity, expire, order.orderType ?? 0, 0, "0x0000000000000000000000000000000000000000", 0n] })
  console.log(`eth_call placeOrderFor(captured order) @ block ${block}: success ${j(result)}`)
} catch (e: any) {
  const r = e.walk?.((x: unknown) => x instanceof ContractFunctionRevertedError)
  console.log(`eth_call placeOrderFor(captured order) @ block ${block}: REVERT ${r?.data?.errorName}(${j(r?.data?.args ?? [])})`)
}
await ex.close(); process.exit(0)
