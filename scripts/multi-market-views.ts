// Read-only: with positions open in several markets, compare every account/position view the SDK offers
// against each other and against the raw MarginBank, pinned to one block where the SDK allows it.
//   node multi-market-views.ts [owner]
import { SomniaMarkets } from "@somnia-chain/markets-sdk"
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains"
import { createPublicClient, formatUnits, http, parseAbi } from "viem"
const OWNER = (process.argv[2] ?? "0xB667DAae78712068Ef9c2Cab61c3217901a0309A") as `0x${string}`
const MB = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394" as const
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const f = (v: bigint | string | number | undefined | null, d = 18) => (v == null ? String(v) : formatUnits(BigInt(v), d))
const pub = createPublicClient({ transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const ex = new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql", account: OWNER } as any)
const c: any = ex.client
const perps: any[] = await c.listPerpMarkets()
const byPool = new Map(perps.map((m) => [m.poolAddress.toLowerCase(), m]))
const BANK = parseAbi([
  "function getAccountHealth(address account) view returns (int256 equity, uint256 imReq, uint256 mmReq, uint256 cmReq)",
  "function getActivePerpPools(address account) view returns (address[])",
])

// 1) analytics table (one block) and the bank's own figures at that block
const table: any = await c.listPerpPositionAnalytics({ marginBank: MB, account: OWNER })
const rows: any[] = table.positions ?? table.rows ?? table
const block: bigint = BigInt(table.asOfBlock ?? rows[0]?.asOfBlock)
const acct = await c.getMarginAccount(MB, OWNER)
let raw: any = null
try { raw = await pub.readContract({ address: MB, abi: BANK, functionName: "getAccountHealth", args: [OWNER], blockNumber: block }) } catch (e: any) { raw = "n/a: " + e.shortMessage?.split("\n")[0] }
console.log(`analytics asOfBlock ${block}; getMarginAccount asOfBlock ${acct.asOfBlock}`)
let sumContribution = 0n, sumIm = 0n, sumMm = 0n
for (const r of rows) {
  const m = byPool.get(String(r.pool).toLowerCase())
  sumContribution += BigInt(r.equityContribution); sumIm += BigInt(r.initialMarginRequirement); sumMm += BigInt(r.maintenanceMarginRequirement)
  console.log(`  ${m?.baseSymbol.padEnd(5)} size ${f(r.size, m?.baseDecimals)} entry ${f(r.avgEntryPrice)} mark ${f(r.markPrice)} uPnL ${f(r.unrealizedPnl)} funding ${f(r.accruedFunding)} contrib ${f(r.equityContribution)} IM ${f(r.initialMarginRequirement)} MM ${f(r.maintenanceMarginRequirement)}`)
}
const unlocked = BigInt(acct.unlockedCollateralBalance), locked = BigInt(acct.lockedCollateral)
console.log(`sum contributions ${f(sumContribution)}; unlocked ${f(unlocked)} locked ${f(locked)}`)
console.log(`unlocked + Σcontrib = ${f(unlocked + sumContribution)} | getMarginAccount.equity = ${f(acct.equity)} | raw getAccountHealth@block ${Array.isArray(raw) ? f(raw[0]) : raw}`)
console.log(`Σ IM ${f(sumIm)} vs imReq ${f(acct.imReq)} (raw ${Array.isArray(raw) ? f(raw[1]) : "-"}) | Σ MM ${f(sumMm)} vs mmReq ${f(acct.mmReq)} (raw ${Array.isArray(raw) ? f(raw[2]) : "-"})`)

// 2) liquidation price: accountPositions view vs getLiquidationPrice vs getPerpLeverage inputs
const snap: any = await c.accountPositions.getSnapshot(MB, OWNER)
console.log(`accountPositions snapshot block ${snap.data.blockNumber}; margin ${j({ equity: f(snap.data.margin.equity?.value ?? snap.data.margin.equity), imReq: f(snap.data.margin.imReq?.value ?? snap.data.margin.imReq), mmReq: f(snap.data.margin.mmReq?.value ?? snap.data.margin.mmReq) })}`)
for (const p of snap.data.positions) {
  const m = byPool.get(String(p.pool).toLowerCase())
  const lp = await c.getLiquidationPrice({ marginBank: MB, pool: p.pool, account: OWNER })
  const view = p.liquidationPrice?.value ?? p.liquidationPrice
  console.log(`  ${m?.baseSymbol.padEnd(5)} view liq ${j(view)} (${p.liquidationPrice?.status ?? ""}) | getLiquidationPrice ${lp == null ? lp : f(lp)} | view mark ${j(p.marks?.mark ?? p.marks)}`)
}
await ex.close(); process.exit(0)
