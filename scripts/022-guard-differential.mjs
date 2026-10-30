// Differential test of dreamdex-bot-kit's prepared-transaction check (checkPreparedTx / check_prepared_tx) across its
// JS, TS and Python implementations: the same input to all three, and the decision each one takes.
// Local only: the official-pool lookup is stubbed to true, nothing reaches a chain.
//   node 022-guard-differential.mjs <path to dreamdex-bot-kit>/examples
import { pathToFileURL } from "node:url"
import { execFileSync } from "node:child_process"

const KIT = process.argv[2]
const js = await import(pathToFileURL(`${KIT}/01-multi-strategy-ai/utils/prepared-tx-guard.js`).href)
const ts = await import(pathToFileURL(`${KIT}/03-monorepo-grid/packages/sdk/src/execution/prepared-tx-guard.ts`).href)
const PY_DIR = `${KIT}/04-python-ops/backend/trading`

const CHAIN = 50312
const POOL = "0xa936da11B57b50A344e1293AAaE5232885ea2bDE"
const word = (h) => h.replace(/^0x/, "").toLowerCase().padStart(64, "0")
const ORDER = js.SELECTORS.placeOrder + word("0x1").repeat(7) + word("0x0") + word("0x0") // no builder, no fee
const CANCEL = js.SELECTORS.cancelOrder + word("0x2a")
const base = { to: POOL, data: ORDER, value: "0", chainId: CHAIN }

const cases = [
  ["baseline order", base],
  ["data without 0x prefix", { ...base, data: ORDER.slice(2) }],
  ["data with 0X prefix", { ...base, data: "0X" + ORDER.slice(2) }],
  ["selector in upper case", { ...base, data: "0x" + ORDER.slice(2, 10).toUpperCase() + ORDER.slice(10) }],
  ["to in lower case", { ...base, to: POOL.toLowerCase() }],
  ["to with 0X prefix", { ...base, to: "0X" + POOL.slice(2) }],
  ["to with surrounding spaces", { ...base, to: ` ${POOL} ` }],
  ['chainId ""', { ...base, chainId: "" }],
  ["chainId missing", { to: POOL, data: ORDER, value: "0" }],
  ['chainId "0xc488" (hex string)', { ...base, chainId: "0xc488" }],
  ['chainId "50312" (decimal string)', { ...base, chainId: "50312" }],
  ['chainId "50312.0"', { ...base, chainId: "50312.0" }],
  ["chainId 50312.0 (float)", { ...base, chainId: 50312.0, _pyFloatChain: true }],
  ['chainId " 50312 "', { ...base, chainId: " 50312 " }],
  ['chainId "0XC488"', { ...base, chainId: "0XC488" }],
  ['value ""', { ...base, value: "" }],
  ['value "0x0"', { ...base, value: "0x0" }],
  ['value "0X0"', { ...base, value: "0X0" }],
  ['value "0x"', { ...base, value: "0x" }],
  ['value " 0 "', { ...base, value: " 0 " }],
  ['value "1e3"', { ...base, value: "1e3" }],
  ["value 1.5", { ...base, value: 1.5 }],
  ['value "-0"', { ...base, value: "-0" }],
  ['value "16" on cancelOrder (takes no coin)', { ...base, data: CANCEL, value: "16" }],
  ['value "0x10" on cancelOrder (takes no coin)', { ...base, data: CANCEL, value: "0x10" }],
  ['value "  " (spaces)', { ...base, value: "  " }],
]

const outcome = async (fn, tx) => {
  try { const r = await fn(tx, { allow: [js.SELECTORS.placeOrder, js.SELECTORS.cancelOrder], chainId: CHAIN, isKnownPool: async () => true }); return `accept(value=${r.value})` }
  catch (e) { return e instanceof js.PreparedTxRejected || e instanceof ts.PreparedTxRejected ? "REJECT" : `ERROR ${e.constructor.name}` }
}
const pyInput = JSON.stringify(cases.map(([, tx]) => { const { _pyFloatChain, ...t } = tx; return { tx: t, floatChain: !!_pyFloatChain } }))
const py = `import json, sys
sys.path.insert(0, r"${PY_DIR}")
from prepared_tx_guard import check_prepared_tx, SELECTORS, PreparedTxRejected
out = []
for c in json.loads(sys.stdin.read()):
    tx = c["tx"]
    if c["floatChain"]: tx["chainId"] = float(tx["chainId"])
    try:
        r = check_prepared_tx(tx, allow=(SELECTORS["placeOrder"], SELECTORS["cancelOrder"]), chain_id=${CHAIN}, is_known_pool=lambda a: True)
        out.append("accept(value=%d)" % r["value"])
    except PreparedTxRejected:
        out.append("REJECT")
    except Exception as e:
        out.append("ERROR " + type(e).__name__)
print(json.dumps(out))`
const pyOut = JSON.parse(execFileSync("python", ["-I", "-c", py], { input: pyInput }).toString())

let diffs = 0
console.log("case".padEnd(44), "| JS".padEnd(22), "| TS".padEnd(22), "| Python")
for (let i = 0; i < cases.length; i++) {
  const [label, tx] = cases[i]
  const { _pyFloatChain, ...t } = tx
  const a = await outcome(js.checkPreparedTx, t), b = await outcome(ts.checkPreparedTx, t), c = pyOut[i]
  const same = a === b && b === c
  if (!same) diffs++
  console.log(`${same ? "  " : "≠ "}${label.padEnd(42)} | ${a.padEnd(19)} | ${b.padEnd(19)} | ${c}`)
}
console.log(`\n${cases.length} inputs; implementations disagree on ${diffs}`)
