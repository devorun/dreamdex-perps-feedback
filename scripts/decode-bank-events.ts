// Decodes MarginBank events (FundingSettled, PositionUpdated, ...) from a transaction receipt.
import { marginBankEventsAbi } from "@somnia-chain/markets-sdk"
import { createPublicClient, http, parseEventLogs } from "viem"
const j = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
const pub = createPublicClient({ transport: http("https://api.hideki2.infra.testnet.somnia.network") })
const r = await pub.getTransactionReceipt({ hash: process.argv[2] as `0x${string}` })
for (const l of parseEventLogs({ abi: marginBankEventsAbi as any, logs: r.logs })) console.log((l as any).eventName, j((l as any).args))
